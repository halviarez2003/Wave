import { z } from "zod";

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(1, { error: "El nombre es obligatorio" }).max(80),
});

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1, { error: "La descripción es obligatoria" }).max(200),
  expenseCategoryId: z.string().min(1, { error: "Selecciona una categoría" }),
  type: z.enum(["FIXED", "VARIABLE"], { error: "Tipo inválido" }),
  amount: z.coerce.number().positive({ error: "Monto inválido" }),
  accountId: z.string().min(1, { error: "Selecciona una cuenta" }),
  supplierId: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
  expenseDate: z.coerce.date().optional(),
});
