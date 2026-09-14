"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";

import {
  addSerializedUnitsSchema,
  adjustQuantitySchema,
  adjustUnitStatusSchema,
  createWarehouseSchema,
  transferStockSchema,
} from "./schema";
import * as inventoryService from "./service";

export type ActionState = { error?: string; success?: string } | undefined;

export async function createWarehouseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("settings.manage");
  const parsed = createWarehouseSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  await inventoryService.createWarehouse(db, session.user.companyId, parsed.data);
  revalidatePath("/inventario/almacenes");
  return { success: "Almacén creado." };
}

export async function adjustQuantityAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("inventory.adjust");
  const variantId = formData.get("variantId") as string;
  const parsed = adjustQuantitySchema.safeParse({
    variantId,
    warehouseId: formData.get("warehouseId"),
    direction: formData.get("direction"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await inventoryService.adjustQuantity(db, session.user.companyId, session.user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo aplicar el ajuste." };
  }

  revalidatePath(`/inventario/ajustes/${variantId}`);
  revalidatePath(`/inventario/kardex/${variantId}`);
  revalidatePath("/inventario/movimientos");
  return { success: "Ajuste aplicado." };
}

export async function transferStockAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("inventory.transfer");
  const variantId = formData.get("variantId") as string;
  const parsed = transferStockSchema.safeParse({
    variantId,
    fromWarehouseId: formData.get("fromWarehouseId"),
    toWarehouseId: formData.get("toWarehouseId"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await inventoryService.transferStock(db, session.user.companyId, session.user.id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo transferir el stock." };
  }

  revalidatePath(`/inventario/ajustes/${variantId}`);
  revalidatePath(`/inventario/kardex/${variantId}`);
  revalidatePath("/inventario/movimientos");
  return { success: "Transferencia aplicada." };
}

export async function addSerializedUnitsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("inventory.adjust");
  const variantId = formData.get("variantId") as string;
  const warehouseId = formData.get("warehouseId") as string;
  const unitsRaw = formData.get("unitsJson");

  let unitsJson: unknown;
  try {
    unitsJson = JSON.parse(typeof unitsRaw === "string" ? unitsRaw : "[]");
  } catch {
    return { error: "No se pudieron leer las filas de unidades." };
  }

  const parsed = addSerializedUnitsSchema.safeParse({ variantId, warehouseId, units: unitsJson });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await inventoryService.addSerializedUnits(
      db,
      session.user.companyId,
      session.user.id,
      parsed.data.variantId,
      parsed.data.warehouseId,
      parsed.data.units,
    );
  } catch {
    return { error: "Alguna unidad tiene un IMEI o serial ya registrado." };
  }

  revalidatePath(`/inventario/ajustes/${variantId}`);
  revalidatePath(`/inventario/kardex/${variantId}`);
  revalidatePath("/inventario/productos");
  return { success: "Unidades agregadas." };
}

export async function adjustUnitStatusAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("inventory.adjust");
  const variantId = formData.get("variantId") as string;
  const parsed = adjustUnitStatusSchema.safeParse({
    unitId: formData.get("unitId"),
    status: formData.get("status"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  await inventoryService.adjustUnitStatus(db, session.user.companyId, session.user.id, parsed.data);
  revalidatePath(`/inventario/ajustes/${variantId}`);
  revalidatePath(`/inventario/kardex/${variantId}`);
  return { success: "Estado actualizado." };
}
