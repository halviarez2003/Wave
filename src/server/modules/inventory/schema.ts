import { z } from "zod";

export const unitConditionSchema = z.enum(["NEW", "USED", "REFURBISHED"]);

export const inventoryUnitStatusSchema = z.enum([
  "AVAILABLE",
  "RESERVED",
  "SOLD",
  "RETURNED",
  "DAMAGED",
  "IN_REPAIR",
  "LAYAWAY",
]);

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(1, { error: "Requerido" }).max(80),
  address: z.string().trim().max(200).optional(),
});

export const adjustQuantitySchema = z.object({
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  direction: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().int().positive({ error: "Debe ser mayor a 0" }),
  reason: z.string().trim().min(1, { error: "Explica el motivo del ajuste" }).max(200),
});

export const transferStockSchema = z
  .object({
    variantId: z.string().min(1),
    fromWarehouseId: z.string().min(1),
    toWarehouseId: z.string().min(1),
    quantity: z.coerce.number().int().positive({ error: "Debe ser mayor a 0" }),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    error: "El almacén de origen y destino deben ser distintos",
    path: ["toWarehouseId"],
  });

export const newUnitRowSchema = z.object({
  imei1: z.string().trim().max(40).optional(),
  imei2: z.string().trim().max(40).optional(),
  serial: z.string().trim().max(60).optional(),
  condition: unitConditionSchema.default("NEW"),
  batteryPercent: z.coerce.number().int().min(0).max(100).optional(),
  color: z.string().trim().max(40).optional(),
  capacity: z.string().trim().max(40).optional(),
  cost: z.coerce.number().nonnegative({ error: "Costo inválido" }),
  suggestedPrice: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().max(300).optional(),
});

export const addSerializedUnitsSchema = z.object({
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  units: z.array(newUnitRowSchema).min(1, { error: "Agrega al menos una unidad" }),
});

export const adjustUnitStatusSchema = z.object({
  unitId: z.string().min(1),
  status: inventoryUnitStatusSchema,
  reason: z.string().trim().max(200).optional(),
});

export type NewUnitRow = z.infer<typeof newUnitRowSchema>;
