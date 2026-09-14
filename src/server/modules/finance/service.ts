import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import type { FinancialTransactionType } from "@/generated/prisma/enums";

export type RecordTransactionInput = {
  accountId: string;
  type: FinancialTransactionType;
  amount: number; // firmado: positivo = entra a la cuenta, negativo = sale
  relatedDocumentType?: string;
  relatedDocumentId?: string;
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
      description: input.description,
      reference: input.reference,
      userId: input.userId,
    },
  });
}
