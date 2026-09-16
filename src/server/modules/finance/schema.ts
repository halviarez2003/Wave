import { z } from "zod";

export const accountTypeSchema = z.enum(["CASH", "BANK", "WALLET", "POS", "OTHER"]);

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, { error: "Requerido" }).max(80),
  type: accountTypeSchema,
});

export const transferSchema = z
  .object({
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
    amount: z.coerce.number().positive({ error: "Debe ser mayor a 0" }),
    description: z.string().trim().max(200).optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    error: "La cuenta de origen y destino deben ser distintas",
    path: ["toAccountId"],
  });
