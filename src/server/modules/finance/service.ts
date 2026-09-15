import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import type { FinancialTransactionType } from "@/generated/prisma/enums";

import type { createAccountSchema, transferSchema } from "./schema";
import type { z } from "zod";

export async function listAccounts(db: ScopedPrisma) {
  return db.account.findMany({ orderBy: { name: "asc" }, include: { currency: true } });
}

export async function getAccount(db: ScopedPrisma, accountId: string) {
  return db.account.findUnique({
    where: { id: accountId },
    include: { currency: true },
  });
}

export async function createAccount(
  db: ScopedPrisma,
  companyId: string,
  input: z.infer<typeof createAccountSchema>,
) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  if (!company.baseCurrencyId) {
    throw new Error("La empresa no tiene una moneda base configurada.");
  }

  return db.account.create({
    data: {
      companyId,
      name: input.name,
      type: input.type,
      currencyId: company.baseCurrencyId,
    },
  });
}

export async function listTransactions(db: ScopedPrisma, accountId?: string) {
  return db.financialTransaction.findMany({
    where: accountId ? { accountId } : undefined,
    include: { account: true, user: true },
    orderBy: { transactionDate: "desc" },
    take: 200,
  });
}

/**
 * Transferencia entre cuentas propias: dos FinancialTransaction
 * (TRANSFER_OUT / TRANSFER_IN) correlacionados por transferGroupId, sin
 * afectar ninguna cifra de ventas/utilidad — solo mueve dinero entre
 * cuentas que ya eran de la empresa.
 */
export async function transferBetweenAccounts(
  db: ScopedPrisma,
  companyId: string,
  userId: string,
  input: z.infer<typeof transferSchema>,
) {
  return db.$transaction(async (tx) => {
    const transferGroupId = crypto.randomUUID();
    const description = input.description ?? "Transferencia entre cuentas";

    await recordTransaction(tx, companyId, {
      accountId: input.fromAccountId,
      type: "TRANSFER_OUT",
      amount: -input.amount,
      relatedDocumentType: "TRANSFER",
      relatedDocumentId: transferGroupId,
      transferGroupId,
      description,
      userId,
    });

    return recordTransaction(tx, companyId, {
      accountId: input.toAccountId,
      type: "TRANSFER_IN",
      amount: input.amount,
      relatedDocumentType: "TRANSFER",
      relatedDocumentId: transferGroupId,
      transferGroupId,
      description,
      userId,
    });
  });
}

export type RecordTransactionInput = {
  accountId: string;
  type: FinancialTransactionType;
  amount: number; // firmado: positivo = entra a la cuenta, negativo = sale
  relatedDocumentType?: string;
  relatedDocumentId?: string;
  transferGroupId?: string;
  description?: string;
  reference?: string;
  userId?: string;
};

/**
 * Ledger central de dinero: toda entrada/salida de una cuenta pasa por
 * aquí. `Account.balance` es un caché que solo se escribe junto al
 * FinancialTransaction que lo origina (docs/01-arquitectura.md, principio
 * de integridad #1). A diferencia del inventario, no se bloquea un saldo
 * negativo: el dinero es una cifra contable, no un conteo físico, así que
 * dejar que quede en rojo es información útil, no un error a impedir.
 *
 * Pensada para usarse dentro de la transacción de otro módulo (compras,
 * ventas, gastos...) — por eso recibe `tx` ya abierto, no abre la suya.
 */
export async function recordTransaction(
  tx: Pick<ScopedPrisma, "account" | "financialTransaction">,
  companyId: string,
  input: RecordTransactionInput,
) {
  const account = await tx.account.findUniqueOrThrow({ where: { id: input.accountId } });
  const balanceBefore = Number(account.balance);
  const balanceAfter = balanceBefore + input.amount;

  await tx.account.update({
    where: { id: account.id },
    data: { balance: { increment: input.amount } },
  });

  return tx.financialTransaction.create({
    data: {
      companyId,
      accountId: account.id,
      type: input.type,
      amount: input.amount,
      balanceBefore,
      balanceAfter,
      relatedDocumentType: input.relatedDocumentType,
      relatedDocumentId: input.relatedDocumentId,
      transferGroupId: input.transferGroupId,
      description: input.description,
      reference: input.reference,
      userId: input.userId,
    },
  });
}
