import { z } from "zod";

export const purchaseLineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive({ error: "Cantidad inválida" }),
  unitCost: z.coerce.number().nonnegative({ error: "Costo inválido" }),
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().min(1, { error: "Selecciona un proveedor" }),
  warehouseId: z.string().min(1, { error: "Selecciona un almacén" }),
  notes: z.string().trim().max(500).optional(),
  items: z.array(purchaseLineSchema).min(1, { error: "Agrega al menos un producto" }),
  paymentAccountId: z.string().optional(),
  paymentAmount: z.coerce.number().nonnegative().optional(),
  dueDate: z.coerce.date().optional(),
});

export const payPayableSchema = z.object({
  payableId: z.string().min(1),
  accountId: z.string().min(1),
  amount: z.coerce.number().positive({ error: "Debe ser mayor a 0" }),
});

export const voidPurchaseSchema = z.object({
  purchaseId: z.string().min(1),
  reason: z.string().trim().min(1, { error: "Indica un motivo" }).max(500),
});

export type PurchaseLine = z.infer<typeof purchaseLineSchema>;
