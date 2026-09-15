"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";

import { createRoleSchema, updateRolePermissionsSchema } from "./schema";
import * as rolesService from "./service";

export type ActionState = { error?: string; success?: string } | undefined;

function readPermissionCodes(formData: FormData): string[] {
  try {
    const raw = formData.get("permissionCodesJson");
    const parsed = JSON.parse(typeof raw === "string" ? raw : "[]");
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export async function createRoleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("settings.manage");
  const parsed = createRoleSchema.safeParse({
    name: formData.get("name"),
    permissionCodes: readPermissionCodes(formData),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await rolesService.createRole(db, session.user.companyId, parsed.data);
  } catch {
    return { error: "Ya existe un rol con ese nombre." };
  }

  revalidatePath("/configuracion/roles");
  return { success: "Rol creado." };
}

export async function updateRolePermissionsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("settings.manage");
  const parsed = updateRolePermissionsSchema.safeParse({
    roleId: formData.get("roleId"),
    permissionCodes: readPermissionCodes(formData),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await rolesService.updateRolePermissions(db, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudieron actualizar los permisos." };
  }

  revalidatePath("/configuracion/roles");
  revalidatePath(`/configuracion/roles/${parsed.data.roleId}`);
  return { success: "Permisos actualizados." };
}
