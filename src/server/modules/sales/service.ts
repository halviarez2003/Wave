import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import * as financeService from "@/server/modules/finance/service";
import { nextDocumentNumber } from "@/server/modules/shared/document-sequence";
import { defaultDueDate, daysOverdue, effectiveStatus } from "@/server/modules/shared/credit-terms";

import type { createSaleSchema, payReceivableSchema } from "./schema";
import type { z } from "zod";

export async function listSellableItems(db: ScopedPrisma) {
  const [quantityVariants, serializedUnits] = await Promise.all([
    db.productVariant.findMany({
      where: { isActive: true, product: { isActive: true, inventoryType: "QUANTITY" } },
      include: {
        product: { include: { category: true } },
        inventoryBalances: { include: { warehouse: true } },
      },
    }),
    db.inventoryUnit.findMany({
      where: { status: "AVAILABLE", variant: { product: { isActive: true } } },
      include: {
        variant: { include: { product: { include: { category: true } } } },
        warehouse: true,
      },
    }),
  ]);

  const quantityItems = quantityVariants.map((v) => {
    const label = v.label === "Único" ? v.product.name : `${v.product.name} — ${v.label}`;
    return {
      kind: "quantity" as const,
      variantId: v.id,
      label,
      categoryName: v.product.category.name,
      unitPrice: Number(v.salePrice),
      searchText: [v.product.name, v.product.brand, v.sku, v.label].filter(Boolean).join(" ").toLowerCase(),
      balances: v.inventoryBalances.map((b) => ({
        warehouseId: b.warehouseId,
        warehouseName: b.warehouse.name,
        quantity: b.quantity,
      })),
    };
  });

  const serializedItems = serializedUnits.map((u) => {
    const label =
      u.variant.label === "Único" ? u.variant.product.name : `${u.variant.product.name} — ${u.variant.label}`;
    return {
      kind: "unit" as const,
      variantId: u.productVariantId,
      unitId: u.id,
      label: `${label} (IMEI ${u.imei1 ?? u.serial ?? u.id.slice(-6)})`,
      categoryName: u.variant.product.category.name,
      unitPrice: Number(u.suggestedPrice ?? u.variant.salePrice),
      searchText: [label, u.imei1, u.imei2, u.serial, u.color].filter(Boolean).join(" ").toLowerCase(),
      warehouseId: u.warehouseId,
      warehouseName: u.warehouse.name,
    };
  });

  return { quantityItems, serializedItems };
}

export async function listSales(db: ScopedPrisma) {
  return db.sale.findMany({
    orderBy: { saleDate: "desc" },
    include: { customer: true, warehouse: true },
  });
}

export async function getSale(db: ScopedPrisma, saleId: string) {
  return db.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: true,
      warehouse: true,
      user: true,
      items: { include: { variant: { include: { product: true } }, inventoryUnit: true } },
      payments: { include: { account: true }, orderBy: { paymentDate: "asc" } },
      receivable: { include: { payments: { include: { account: true } } } },
    },
  });
}

type CreateSaleInput = z.infer<typeof createSaleSchema>;

/**
 * Crea una venta completa: descuenta inventario (cantidad, sin tocar el
 * costo promedio; o una unidad serializada específica, con su costo
 * individual), aplica los pagos a las cuentas correspondientes y, si queda
 * saldo, abre una cuenta por cobrar. `canEditPrice` viene de comprobar el
 * permiso `sales.editPrice` en el caller — si no lo tiene, el precio de
 * lista de cada variante gana sobre lo que mande el formulario, para que
 * la restricción sea real y no solo un campo deshabilitado en el cliente.
 */
export async function createSale(
  db: ScopedPrisma,
  companyId: string,
  userId: string,
  input: CreateSaleInput,
  canEditPrice: boolean,
) {
  return db.$transaction(async (tx) => {
    await tx.warehouse.findUniqueOrThrow({ where: { id: input.warehouseId } });
    if (input.customerId) {
      await tx.customer.findUniqueOrThrow({ where: { id: input.customerId } });
    }

    const variantIds = [...new Set(input.items.map((i) => i.variantId))];
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const lines: Array<{
      variantId: string;
      unitId?: string;
      quantity: number;
      unitPrice: number;
      unitCost: number;
    }> = [];

    for (const item of input.items) {
      const variant = variantById.get(item.variantId);
      if (!variant) throw new Error("Uno de los productos ya no existe.");
      const unitPrice = canEditPrice ? item.unitPrice : Number(variant.salePrice);

      if (variant.product.inventoryType === "QUANTITY") {
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            productVariantId_warehouseId: {
              productVariantId: item.variantId,
              warehouseId: input.warehouseId,
            },
          },
        });
        if (!balance || balance.quantity < item.quantity) {
          throw new Error(`Stock insuficiente de "${variant.label}".`);
        }

        const claimed = await tx.inventoryBalance.updateMany({
          where: { id: balance.id, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });
        if (claimed.count === 0) {
          throw new Error(`Stock insuficiente de "${variant.label}".`);
        }

        const unitCost = Number(balance.averageCost);
        await tx.inventoryMovement.create({
          data: {
            companyId,
            productVariantId: item.variantId,
            warehouseId: input.warehouseId,
            type: "SALE",
            quantity: item.quantity,
            stockBefore: balance.quantity,
            stockAfter: balance.quantity - item.quantity,
            unitCost,
            totalValue: unitCost * item.quantity,
            reason: "Venta",
            userId,
          },
        });

        lines.push({ variantId: item.variantId, quantity: item.quantity, unitPrice, unitCost });
      } else {
        if (!item.unitId) {
          throw new Error(`Selecciona una unidad para "${variant.label}".`);
        }

        const claimed = await tx.inventoryUnit.updateMany({
          where: { id: item.unitId, status: "AVAILABLE" },
          data: { status: "SOLD" },
        });
        if (claimed.count === 0) {
          throw new Error(`Esa unidad de "${variant.label}" ya no está disponible.`);
        }
        const unit = await tx.inventoryUnit.findUniqueOrThrow({ where: { id: item.unitId } });
        const unitCost = Number(unit.cost);

        await tx.inventoryMovement.create({
          data: {
            companyId,
            productVariantId: item.variantId,
            inventoryUnitId: unit.id,
            warehouseId: unit.warehouseId,
            type: "SALE",
            quantity: 1,
            stockBefore: 1,
            stockAfter: 0,
            unitCost,
            totalValue: unitCost,
            reason: "Venta",
            userId,
          },
        });

        lines.push({ variantId: item.variantId, unitId: unit.id, quantity: 1, unitPrice, unitCost });
      }
    }

    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const totalCost = lines.reduce((sum, l) => sum + l.unitCost * l.quantity, 0);
    const discount = input.discount ?? 0;
    const total = subtotal - discount;
    const totalProfit = total - totalCost;

    const payments = input.payments ?? [];
    const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    if (paidTotal > total) {
      throw new Error("Los pagos superan el total de la venta.");
    }
    const balanceDue = total - paidTotal;
    if (balanceDue > 0 && !input.customerId) {
      throw new Error("Selecciona un cliente para vender a crédito.");
    }

    const number = await nextDocumentNumber(tx, companyId, "SALE");

    const sale = await tx.sale.create({
      data: {
        companyId,
        number,
        customerId: input.customerId,
        warehouseId: input.warehouseId,
        subtotal,
        discount,
        total,
        totalCost,
        totalProfit,
        paidTotal,
        balanceDue,
        notes: input.notes,
        userId,
      },
    });

    for (const line of lines) {
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productVariantId: line.variantId,
          inventoryUnitId: line.unitId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          unitCost: line.unitCost,
          subtotal: line.unitPrice * line.quantity,
          profit: (line.unitPrice - line.unitCost) * line.quantity,
        },
      });
    }

    for (const payment of payments) {
      const financialTransaction = await financeService.recordTransaction(tx, companyId, {
        accountId: payment.accountId,
        type: "SALE_INCOME",
        amount: payment.amount,
        relatedDocumentType: "SALE",
        relatedDocumentId: sale.id,
        description: `Venta #${number}`,
        userId,
      });
      await tx.salePayment.create({
        data: {
          saleId: sale.id,
          accountId: payment.accountId,
          amount: payment.amount,
          financialTransactionId: financialTransaction.id,
        },
      });
    }

    if (balanceDue > 0) {
      await tx.accountReceivable.create({
        data: {
          companyId,
          customerId: input.customerId!,
          saleId: sale.id,
          totalAmount: total,
          paidAmount: paidTotal,
          balance: balanceDue,
          dueDate: input.dueDate ?? defaultDueDate(),
          status: paidTotal > 0 ? "PARTIAL" : "PENDING",
        },
      });
    }

    return sale;
  });
}

export async function payReceivable(
  db: ScopedPrisma,
  companyId: string,
  userId: string,
  input: z.infer<typeof payReceivableSchema>,
) {
  return db.$transaction(async (tx) => {
    const receivable = await tx.accountReceivable.findUniqueOrThrow({
      where: { id: input.receivableId },
      include: { sale: true },
    });

    if (input.amount > Number(receivable.balance)) {
      throw new Error("El monto excede el saldo pendiente.");
    }

    const financialTransaction = await financeService.recordTransaction(tx, companyId, {
      accountId: input.accountId,
      type: "RECEIVABLE_PAYMENT",
      amount: input.amount,
      relatedDocumentType: "SALE",
      relatedDocumentId: receivable.saleId,
      description: `Cobro — venta #${receivable.sale.number}`,
      userId,
    });

    const newPaidAmount = Number(receivable.paidAmount) + input.amount;
    const newBalance = Number(receivable.totalAmount) - newPaidAmount;

    await tx.accountReceivable.update({
      where: { id: receivable.id },
      data: {
        paidAmount: newPaidAmount,
        balance: newBalance,
        status: newBalance <= 0 ? "PAID" : "PARTIAL",
      },
    });

    await tx.receivablePayment.create({
      data: {
        accountReceivableId: receivable.id,
        amount: input.amount,
        accountId: input.accountId,
        userId,
        financialTransactionId: financialTransaction.id,
      },
    });

    await tx.sale.update({
      where: { id: receivable.saleId },
      data: { paidTotal: { increment: input.amount }, balanceDue: { decrement: input.amount } },
    });

    return financialTransaction;
  });
}

export type ReceivableStatusFilter = "ALL" | "PENDING" | "PARTIAL" | "OVERDUE" | "PAID";

/**
 * Cuentas por cobrar con estado efectivo (OVERDUE derivado de dueDate,
 * nunca persistido) y días de atraso. `status` filtra sobre ese estado
 * efectivo, no sobre la columna cruda.
 */
export async function listReceivables(db: ScopedPrisma, status: ReceivableStatusFilter = "ALL") {
  const receivables = await db.accountReceivable.findMany({
    where: { status: { not: "PAID" } },
    include: { customer: true, sale: true },
    orderBy: { issueDate: "asc" },
  });

  const rows = receivables.map((r) => {
    const balance = Number(r.balance);
    const status = effectiveStatus(r.status, balance, r.dueDate);
    return {
      id: r.id,
      customer: r.customer,
      saleId: r.saleId,
      saleNumber: r.sale.number,
      totalAmount: Number(r.totalAmount),
      paidAmount: Number(r.paidAmount),
      balance,
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      daysOverdue: daysOverdue(r.dueDate),
      status,
    };
  });

  const filtered = status === "ALL" ? rows : rows.filter((r) => r.status === status);

  const totals = {
    pending: rows.reduce((sum, r) => sum + r.balance, 0),
    overdue: rows.filter((r) => r.status === "OVERDUE").reduce((sum, r) => sum + r.balance, 0),
    customerCount: new Set(rows.map((r) => r.customer.id)).size,
  };

  return { rows: filtered, totals };
}
