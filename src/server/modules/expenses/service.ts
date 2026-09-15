import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import * as financeService from "@/server/modules/finance/service";

import type { createExpenseCategorySchema, createExpenseSchema } from "./schema";
import type { z } from "zod";

export async function listExpenseCategories(db: ScopedPrisma) {
  return db.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function createExpenseCategory(
  db: ScopedPrisma,
  companyId: string,
  input: z.infer<typeof createExpenseCategorySchema>,
) {
  return db.expenseCategory.create({ data: { companyId, name: input.name } });
}

export type ExpenseFilters = { categoryId?: string; from?: Date; to?: Date };

export async function listExpenses(db: ScopedPrisma, filters: ExpenseFilters = {}) {
  return db.expense.findMany({
    where: {
      expenseCategoryId: filters.categoryId,
      expenseDate: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
    },
    include: { category: true, account: true, supplier: true, user: true },
    orderBy: { expenseDate: "desc" },
    take: 200,
  });
}

/**
 * Registra un gasto: crea el documento y, a partir de él, un
 * FinancialTransaction (EXPENSE, monto negativo) contra la cuenta
 * elegida — el mismo orden que compras/ventas: primero el documento,
 * luego el movimiento de dinero que lo referencia.
 */
export async function createExpense(
  db: ScopedPrisma,
  companyId: string,
  userId: string,
  input: z.infer<typeof createExpenseSchema>,
) {
  return db.$transaction(async (tx) => {
    await tx.expenseCategory.findUniqueOrThrow({ where: { id: input.expenseCategoryId } });
    if (input.supplierId) {
      await tx.supplier.findUniqueOrThrow({ where: { id: input.supplierId } });
    }

    const expense = await tx.expense.create({
      data: {
        companyId,
        description: input.description,
        expenseCategoryId: input.expenseCategoryId,
        type: input.type,
        amount: input.amount,
        expenseDate: input.expenseDate ?? new Date(),
        accountId: input.accountId,
        supplierId: input.supplierId,
        notes: input.notes,
        userId,
      },
    });

    const financialTransaction = await financeService.recordTransaction(tx, companyId, {
      accountId: input.accountId,
      type: "EXPENSE",
      amount: -input.amount,
      relatedDocumentType: "EXPENSE",
      relatedDocumentId: expense.id,
      description: input.description,
      userId,
    });

    return tx.expense.update({
      where: { id: expense.id },
      data: { financialTransactionId: financialTransaction.id },
    });
  });
}
