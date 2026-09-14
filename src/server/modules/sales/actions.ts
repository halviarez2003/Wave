"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission, requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";

import { createSaleSchema, payReceivableSchema } from "./schema";
import * as salesService from "./service";

export type ActionState = { error?: string; success?: string } | undefined;

export async function createSaleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("sales.create");

  let items: unknown;
  let payments: unknown;
  try {
    items = JSON.parse((formData.get("itemsJson") as string | null) ?? "[]");
    payments = JSON.parse((formData.get("paymentsJson") as string | null) ?? "[]");
  } catch {
    return { error: "No se pudieron leer las líneas de la venta." };
  }

  const parsed = createSaleSchema.safeParse({
    customerId: formData.get("customerId") || undefined,
    warehouseId: formData.get("warehouseId"),
    discount: formData.get("discount") || undefined,
    notes: formData.get("notes") || undefined,
    items,
    payments,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const canEditPrice = hasPermission(session, "sales.editPrice");
  const db = getScopedPrisma(session.user.companyId);
  let sale;
  try {
    sale = await salesService.createSale(
      db,
      session.user.companyId,
      session.user.id,
      parsed.data,
      canEditPrice,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo registrar la venta." };
  }

  revalidatePath("/ventas");
  redirect(`/ventas/${sale.id}`);
}

export async function payReceivableAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("sales.collect");
  const saleId = formData.get("saleId") as string;
  const parsed = payReceivableSchema.safeParse({
    receivableId: formData.get("receivableId"),
    accountId: formData.get("accountId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await salesService.payReceivable(db, session.user.companyId, session.user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo registrar el cobro." };
  }

  revalidatePath(`/ventas/${saleId}`);
  revalidatePath("/clientes");
  return { success: "Cobro registrado." };
}
