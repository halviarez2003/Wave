import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, { error: "Requerido" }).max(60),
  permissionCodes: z.array(z.string()).default([]),
});

export const updateRolePermissionsSchema = z.object({
  roleId: z.string().min(1),
  permissionCodes: z.array(z.string()).default([]),
});
