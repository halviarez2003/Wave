"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";

import { createPurchaseSchema, payPayableSchema } from "./schema";
import * as purchasesService from "./service";

export type ActionState = { error?: string; success?: string } | undefined;

export async function createPurchaseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("purchases.create");

  let items: unknown;
  try {
    items = JSON.parse((formData.get("itemsJson") as string | null) ?? "[]");
  } catch {
    return { error: "No se pudieron leer las líneas de la compra." };
  }

  const parsed = createPurchaseSchema.safeParse({
    supplierId: formData.get("supplierId"),
    warehouseId: formData.get("warehouseId"),
    notes: formData.get("notes") || undefined,
    items,
    paymentAccountId: formData.get("paymentAccountId") || undefined,
    paymentAmount: formData.get("paymentAmount") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  let purchase;
  try {
    purchase = await purchasesService.createPurchase(
      db,
      session.user.companyId,
      session.user.id,
      parsed.data,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo registrar la compra." };
  }

  revalidatePath("/compras");
  redirect(`/compras/${purchase.id}`);
}

export async function payPayableAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("purchases.pay");
  const purchaseId = formData.get("purchaseId") as string;
  const parsed = payPayableSchema.safeParse({
    payableId: formData.get("payableId"),
    accountId: formData.get("accountId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await purchasesService.payPayable(db, session.user.companyId, session.user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo registrar el pago." };
  }

  revalidatePath(`/compras/${purchaseId}`);
  revalidatePath("/proveedores");
  return { success: "Pago registrado." };
}
