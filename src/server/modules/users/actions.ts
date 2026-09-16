"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";

import { createUserSchema, resetPasswordSchema, updateUserSchema } from "./schema";
import * as usersService from "./service";

export type ActionState = { error?: string; success?: string } | undefined;

export async function createUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("users.manage");
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await usersService.createUser(db, session.user.companyId, parsed.data);
  } catch {
    return { error: "Ya existe un usuario con ese email." };
  }

  revalidatePath("/configuracion/usuarios");
  return { success: "Usuario creado." };
}

export async function updateUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("users.manage");
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    roleId: formData.get("roleId"),
    isActive: formData.get("isActive") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  if (parsed.data.userId === session.user.id && !parsed.data.isActive) {
    return { error: "No podés desactivar tu propia cuenta." };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await usersService.updateUser(db, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el usuario." };
  }

  revalidatePath("/configuracion/usuarios");
  return { success: "Usuario actualizado." };
}

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("users.manage");
  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await usersService.resetPassword(db, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo restablecer la contraseña." };
  }

  return { success: "Contraseña actualizada." };
}
