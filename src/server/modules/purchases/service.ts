import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import * as inventoryService from "@/server/modules/inventory/service";
import * as financeService from "@/server/modules/finance/service";
import { nextDocumentNumber } from "@/server/modules/shared/document-sequence";
import { defaultDueDate, daysOverdue, effectiveStatus } from "@/server/modules/shared/credit-terms";

import type { createPurchaseSchema, payPayableSchema, voidPurchaseSchema } from "./schema";
import type { z } from "zod";

export async function listPurchases(db: ScopedPrisma) {
  return db.purchase.findMany({
    orderBy: { purchaseDate: "desc" },
    include: { supplier: true, warehouse: true },
  });
}

export async function getPurchase(db: ScopedPrisma, purchaseId: string) {
  return db.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      supplier: true,
      warehouse: true,
      user: true,
      items: {
        include: {
          variant: { include: { product: true } },
          inventoryUnits: true,
        },
      },
      payments: { include: { account: true }, orderBy: { paymentDate: "asc" } },
      payable: { include: { payments: { include: { account: true } } } },
    },
  });
}

type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export async function createPurchase(
  db: ScopedPrisma,
  companyId: string,
  userId: string,
  input: CreatePurchaseInput,
) {
  return db.$transaction(async (tx) => {
    await tx.supplier.findUniqueOrThrow({ where: { id: input.supplierId } });
    await tx.warehouse.findUniqueOrThrow({ where: { id: input.warehouseId } });

    const variants = await tx.productVariant.findMany({
      where: { id: { in: input.items.map((i) => i.variantId) } },
      include: { product: true },
    });
    const variantById = new Map(variants.map((v) => [v.id, v]));
    for (const item of input.items) {
      if (!variantById.has(item.variantId)) {
        throw new Error("Uno de los productos ya no existe.");
      }
    }

    const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
    const total = subtotal;

    const requestedPayment = input.paymentAccountId ? (input.paymentAmount ?? 0) : 0;
    if (requestedPayment > total) {
      throw new Error("El pago no puede ser mayor al total de la compra.");
    }
    const paidTotal = requestedPayment;
    const balanceDue = total - paidTotal;

    const number = await nextDocumentNumber(tx, companyId, "PURCHASE");

    const purchase = await tx.purchase.create({
      data: {
        companyId,
        number,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        subtotal,
        total,
        paidTotal,
        balanceDue,
        notes: input.notes,
        userId,
      },
    });

    for (const item of input.items) {
      const variant = variantById.get(item.variantId)!;
      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          productVariantId: item.variantId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          subtotal: item.quantity * item.unitCost,
        },
      });

      if (variant.product.inventoryType === "QUANTITY") {
        await inventoryService.receivePurchaseQuantity(tx, companyId, userId, {
          variantId: item.variantId,
          warehouseId: input.warehouseId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          purchaseId: purchase.id,
        });
      }
      // Serializado: no se crean unidades aquí. Cada IMEI se registra
      // después desde el detalle de la compra ("Recibir unidades"), que
      // llama a inventory.addSerializedUnits enlazando el id de este
      // purchaseItem.
    }

    if (paidTotal > 0 && input.paymentAccountId) {
      const financialTransaction = await financeService.recordTransaction(tx, companyId, {
        accountId: input.paymentAccountId,
        type: "PURCHASE_PAYMENT",
        amount: -paidTotal,
        relatedDocumentType: "PURCHASE",
        relatedDocumentId: purchase.id,
        description: `Pago compra #${number}`,
        userId,
      });

      await tx.purchasePayment.create({
        data: {
          purchaseId: purchase.id,
          accountId: input.paymentAccountId,
          amount: paidTotal,
          financialTransactionId: financialTransaction.id,
        },
      });
    }

    if (balanceDue > 0) {
      await tx.accountPayable.create({
        data: {
          companyId,
          supplierId: input.supplierId,
          purchaseId: purchase.id,
          totalAmount: total,
          paidAmount: paidTotal,
          balance: balanceDue,
          dueDate: input.dueDate ?? defaultDueDate(),
          status: paidTotal > 0 ? "PARTIAL" : "PENDING",
        },
      });
    }

    return purchase;
  });
}

export async function payPayable(
  db: ScopedPrisma,
  companyId: string,
  userId: string,
  input: z.infer<typeof payPayableSchema>,
) {
  return db.$transaction(async (tx) => {
    const payable = await tx.accountPayable.findUniqueOrThrow({
      where: { id: input.payableId },
      include: { purchase: true },
    });

    if (input.amount > Number(payable.balance)) {
      throw new Error("El monto excede el saldo pendiente.");
    }

    const financialTransaction = await financeService.recordTransaction(tx, companyId, {
      accountId: input.accountId,
      type: "PAYABLE_PAYMENT",
      amount: -input.amount,
      relatedDocumentType: "PURCHASE",
      relatedDocumentId: payable.purchaseId,
      description: `Pago a proveedor — compra #${payable.purchase.number}`,
      userId,
    });

    const newPaidAmount = Number(payable.paidAmount) + input.amount;
    const newBalance = Number(payable.totalAmount) - newPaidAmount;

    await tx.accountPayable.update({
      where: { id: payable.id },
      data: {
        paidAmount: newPaidAmount,
        balance: newBalance,
        status: newBalance <= 0 ? "PAID" : "PARTIAL",
      },
    });

    await tx.payablePayment.create({
      data: {
        accountPayableId: payable.id,
        amount: input.amount,
        accountId: input.accountId,
        userId,
        financialTransactionId: financialTransaction.id,
      },
    });

    await tx.purchase.update({
      where: { id: payable.purchaseId },
      data: { paidTotal: { increment: input.amount }, balanceDue: { decrement: input.amount } },
    });

    return financialTransaction;
  });
}

export type PayableStatusFilter = "ALL" | "PENDING" | "PARTIAL" | "OVERDUE" | "PAID";

export async function listPayables(db: ScopedPrisma, status: PayableStatusFilter = "ALL") {
  const payables = await db.accountPayable.findMany({
    where: { status: { not: "PAID" } },
    include: { supplier: true, purchase: true },
    orderBy: { issueDate: "asc" },
  });

  const rows = payables.map((p) => {
    const balance = Number(p.balance);
    const status = effectiveStatus(p.status, balance, p.dueDate);
    return {
      id: p.id,
      supplier: p.supplier,
      purchaseId: p.purchaseId,
      purchaseNumber: p.purchase.number,
      totalAmount: Number(p.totalAmount),
      paidAmount: Number(p.paidAmount),
      balance,
      issueDate: p.issueDate,
      dueDate: p.dueDate,
      daysOverdue: daysOverdue(p.dueDate),
      status,
    };
  });

  const filtered = status === "ALL" ? rows : rows.filter((p) => p.status === status);

  const totals = {
    pending: rows.reduce((sum, p) => sum + p.balance, 0),
    overdue: rows.filter((p) => p.status === "OVERDUE").reduce((sum, p) => sum + p.balance, 0),
    supplierCount: new Set(rows.map((p) => p.supplier.id)).size,
  };

  return { rows: filtered, totals };
}

/**
 * Anula una compra completada: nunca borra la compra ni sus líneas.
 * Para cantidad, revierte el costo promedio ponderado con la fórmula
 * inversa a la de recepción — exige que quede stock suficiente de esa
 * variante (si ya se vendió parte, el costeo promedio perdió
 * trazabilidad de lote y no se puede revertir con certeza, así que se
 * bloquea en vez de adivinar). Para serializados, exige que ninguna
 * unidad de esa línea se haya vendido; las que siguen disponibles
 * pasan a RETURNED (no hay un estado "anulado" propio en el enum).
 * Igual que en ventas, se bloquea si ya se pagó parte de la cuenta por
 * pagar.
 */
export async function voidPurchase(
  db: ScopedPrisma,
  companyId: string,
  userId: string,
  input: z.infer<typeof voidPurchaseSchema>,
) {
  return db.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUniqueOrThrow({
      where: { id: input.purchaseId },
      include: {
        items: { include: { variant: { include: { product: true } }, inventoryUnits: true } },
        payments: true,
        payable: true,
      },
    });

    if (purchase.status === "VOIDED") {
      throw new Error("Esta compra ya está anulada.");
    }
    if (purchase.payable && Number(purchase.payable.paidAmount) > 0) {
      throw new Error("No se puede anular: ya se pagó parte de la cuenta por pagar de esta compra.");
    }

    for (const item of purchase.items) {
      if (item.variant.product.inventoryType === "QUANTITY") {
        const balance = await tx.inventoryBalance.findUniqueOrThrow({
          where: {
            productVariantId_warehouseId: {
              productVariantId: item.productVariantId,
              warehouseId: purchase.warehouseId,
            },
          },
        });
        if (balance.quantity < item.quantity) {
          throw new Error(
            `No queda stock suficiente de "${item.variant.label}" para anular esta línea (parte ya se vendió o se movió).`,
          );
        }

        const newQuantity = balance.quantity - item.quantity;
        const newAverageCost =
          newQuantity === 0
            ? 0
            : (balance.quantity * Number(balance.averageCost) - item.quantity * Number(item.unitCost)) /
              newQuantity;

        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: { quantity: newQuantity, averageCost: newAverageCost },
        });

        await tx.inventoryMovement.create({
          data: {
            companyId,
            productVariantId: item.productVariantId,
            warehouseId: purchase.warehouseId,
            type: "VOID_PURCHASE",
            quantity: item.quantity,
            stockBefore: balance.quantity,
            stockAfter: newQuantity,
            unitCost: Number(item.unitCost),
            totalValue: Number(item.unitCost) * item.quantity,
            relatedDocumentType: "PURCHASE",
            relatedDocumentId: purchase.id,
            reason: `Anulación compra #${purchase.number}: ${input.reason}`,
            userId,
          },
        });
      } else {
        for (const unit of item.inventoryUnits) {
          if (unit.status !== "AVAILABLE") {
            throw new Error(
              `Una unidad de "${item.variant.label}" ya no está disponible; no se puede anular esta línea.`,
            );
          }
        }
        for (const unit of item.inventoryUnits) {
          await tx.inventoryUnit.update({ where: { id: unit.id }, data: { status: "RETURNED" } });
          await tx.inventoryMovement.create({
            data: {
              companyId,
              productVariantId: item.productVariantId,
              inventoryUnitId: unit.id,
              warehouseId: unit.warehouseId,
              type: "VOID_PURCHASE",
              quantity: 1,
              stockBefore: 1,
              stockAfter: 0,
              unitCost: Number(unit.cost),
              totalValue: Number(unit.cost),
              relatedDocumentType: "PURCHASE",
              relatedDocumentId: purchase.id,
              reason: `Anulación compra #${purchase.number}: ${input.reason}`,
              userId,
            },
          });
        }
      }
    }

    for (const payment of purchase.payments) {
      await financeService.recordTransaction(tx, companyId, {
        accountId: payment.accountId,
        type: "ADJUSTMENT",
        amount: Number(payment.amount),
        relatedDocumentType: "PURCHASE",
        relatedDocumentId: purchase.id,
        description: `Anulación compra #${purchase.number}: ${input.reason}`,
        userId,
      });
    }

    if (purchase.payable) {
      await tx.accountPayable.update({
        where: { id: purchase.payable.id },
        data: { totalAmount: 0, balance: 0, status: "PAID" },
      });
    }

    return tx.purchase.update({
      where: { id: purchase.id },
      data: { status: "VOIDED", voidedAt: new Date(), voidReason: input.reason },
    });
  });
}
