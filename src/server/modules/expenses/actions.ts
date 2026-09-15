"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";

import { createExpenseCategorySchema, createExpenseSchema } from "./schema";
import * as expensesService from "./service";

export type ActionState = { error?: string; success?: string } | undefined;

export async function createExpenseCategoryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("settings.manage");
  const parsed = createExpenseCategorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await expensesService.createExpenseCategory(db, session.user.companyId, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la categoría." };
  }

  revalidatePath("/gastos");
  return { success: "Categoría creada." };
}

export async function createExpenseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("expenses.create");
  const parsed = createExpenseSchema.safeParse({
    description: formData.get("description"),
    expenseCategoryId: formData.get("expenseCategoryId"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    accountId: formData.get("accountId"),
    supplierId: formData.get("supplierId") || undefined,
    notes: formData.get("notes") || undefined,
    expenseDate: formData.get("expenseDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await expensesService.createExpense(db, session.user.companyId, session.user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo registrar el gasto." };
  }

  revalidatePath("/gastos");
  revalidatePath("/cuentas");
  return { success: "Gasto registrado." };
}
