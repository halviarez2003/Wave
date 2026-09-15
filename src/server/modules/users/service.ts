import "server-only";

import bcrypt from "bcryptjs";

import type { ScopedPrisma } from "@/lib/prisma";

import type { createUserSchema, resetPasswordSchema, updateUserSchema } from "./schema";
import type { z } from "zod";

export async function listUsers(db: ScopedPrisma) {
  return db.user.findMany({ include: { role: true }, orderBy: { name: "asc" } });
}

export async function createUser(
  db: ScopedPrisma,
  companyId: string,
  input: z.infer<typeof createUserSchema>,
) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return db.user.create({
    data: {
      companyId,
      name: input.name,
      email: input.email,
      passwordHash,
      roleId: input.roleId,
    },
  });
}

/**
 * Los permisos de un usuario se cachean en el JWT al iniciar sesión
 * (src/auth.ts) — cambiar su rol aquí no afecta una sesión ya abierta,
 * solo el próximo login. Es una limitación conocida del MVP, documentada
 * en la UI de Configuración.
 */
export async function updateUser(db: ScopedPrisma, input: z.infer<typeof updateUserSchema>) {
  return db.user.update({
    where: { id: input.userId },
    data: { name: input.name, roleId: input.roleId, isActive: input.isActive },
  });
}

export async function resetPassword(db: ScopedPrisma, input: z.infer<typeof resetPasswordSchema>) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return db.user.update({ where: { id: input.userId }, data: { passwordHash } });
}
