import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import * as inventoryService from "@/server/modules/inventory/service";
import * as financeService from "@/server/modules/finance/service";

import type { createPurchaseSchema, payPayableSchema } from "./schema";
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

async function nextPurchaseNumber(
  tx: Pick<ScopedPrisma, "documentSequence">,
  companyId: string,
) {
  const updated = await tx.documentSequence.update({
    where: { companyId_type: { companyId, type: "PURCHASE" } },
    data: { nextNumber: { increment: 1 } },
  });
  return updated.nextNumber - 1;
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

    const number = await nextPurchaseNumber(tx, companyId);

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
