import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";

import type { createRoleSchema, updateRolePermissionsSchema } from "./schema";
import type { z } from "zod";

export async function listAllPermissions(db: ScopedPrisma) {
  return db.permission.findMany({ orderBy: { code: "asc" } });
}

export async function listRolesWithPermissions(db: ScopedPrisma) {
  return db.role.findMany({
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getRoleWithPermissions(db: ScopedPrisma, roleId: string) {
  return db.role.findUnique({
    where: { id: roleId },
    include: { permissions: { include: { permission: true } } },
  });
}

export async function createRole(
  db: ScopedPrisma,
  companyId: string,
  input: z.infer<typeof createRoleSchema>,
) {
  return db.$transaction(async (tx) => {
    const role = await tx.role.create({ data: { companyId, name: input.name, isSystem: false } });

    if (input.permissionCodes.length > 0) {
      const permissions = await tx.permission.findMany({ where: { code: { in: input.permissionCodes } } });
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }

    return role;
  });
}

/**
 * Reemplaza el set completo de permisos de un rol. `role.findUniqueOrThrow`
 * primero es lo que hace esto seguro entre empresas: Role sí está en
 * TENANT_MODELS, así que si `roleId` fuera de otra empresa esto tira antes
 * de tocar RolePermission (que no tiene companyId propio — se alcanza
 * siempre a través de un Role ya validado).
 */
export async function updateRolePermissions(
  db: ScopedPrisma,
  input: z.infer<typeof updateRolePermissionsSchema>,
) {
  return db.$transaction(async (tx) => {
    await tx.role.findUniqueOrThrow({ where: { id: input.roleId } });

    await tx.rolePermission.deleteMany({ where: { roleId: input.roleId } });

    if (input.permissionCodes.length > 0) {
      const permissions = await tx.permission.findMany({ where: { code: { in: input.permissionCodes } } });
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: input.roleId, permissionId: p.id })),
      });
    }

    return tx.role.findUniqueOrThrow({
      where: { id: input.roleId },
      include: { permissions: { include: { permission: true } } },
    });
  });
}
