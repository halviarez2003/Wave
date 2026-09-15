import { z } from "zod";

export const saleLineSchema = z
  .object({
    variantId: z.string().min(1),
    unitId: z.string().optional(), // presente si la variante es serializada
    quantity: z.coerce.number().int().positive({ error: "Cantidad inválida" }),
    unitPrice: z.coerce.number().nonnegative({ error: "Precio inválido" }),
  })
  .refine((data) => !data.unitId || data.quantity === 1, {
    error: "Una unidad serializada se vende de a una.",
    path: ["quantity"],
  });

export const salePaymentLineSchema = z.object({
  accountId: z.string().min(1),
  amount: z.coerce.number().positive({ error: "Monto inválido" }),
});

export const createSaleSchema = z.object({
  customerId: z.string().optional(),
  warehouseId: z.string().min(1, { error: "Selecciona un almacén" }),
  discount: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(saleLineSchema).min(1, { error: "Agrega al menos un producto" }),
  payments: z.array(salePaymentLineSchema).optional(),
  dueDate: z.coerce.date().optional(),
});

export const payReceivableSchema = z.object({
  receivableId: z.string().min(1),
  accountId: z.string().min(1),
  amount: z.coerce.number().positive({ error: "Debe ser mayor a 0" }),
});

export type SaleLine = z.infer<typeof saleLineSchema>;
export type SalePaymentLine = z.infer<typeof salePaymentLineSchema>;
