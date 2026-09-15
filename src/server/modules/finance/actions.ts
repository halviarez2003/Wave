"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";

import { createAccountSchema, transferSchema } from "./schema";
import * as financeService from "./service";

export type ActionState = { error?: string; success?: string } | undefined;

export async function createAccountAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("accounts.manage");
  const parsed = createAccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  await financeService.createAccount(db, session.user.companyId, parsed.data);
  revalidatePath("/cuentas");
  return undefined;
}

export async function transferAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("accounts.transfer");
  const parsed = transferSchema.safeParse({
    fromAccountId: formData.get("fromAccountId"),
    toAccountId: formData.get("toAccountId"),
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await financeService.transferBetweenAccounts(
      db,
      session.user.companyId,
      session.user.id,
      parsed.data,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo transferir." };
  }

  revalidatePath("/cuentas");
  revalidatePath("/cuentas/movimientos");
  return { success: "Transferencia realizada." };
}
