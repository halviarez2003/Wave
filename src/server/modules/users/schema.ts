import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(1, { error: "Requerido" }).max(120),
  email: z.email({ error: "Email inválido" }),
  password: z.string().min(8, { error: "Mínimo 8 caracteres" }).max(100),
  roleId: z.string().min(1, { error: "Selecciona un rol" }),
});

export const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1, { error: "Requerido" }).max(120),
  roleId: z.string().min(1, { error: "Selecciona un rol" }),
  isActive: z.coerce.boolean(),
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, { error: "Mínimo 8 caracteres" }).max(100),
});
