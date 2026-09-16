import { z } from "zod";

export const attributeDataTypeSchema = z.enum(["TEXT", "NUMBER", "BOOLEAN", "DATE", "SELECT"]);

export const inventoryTypeSchema = z.enum(["QUANTITY", "SERIALIZED"]);

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, { error: "Requerido" }).max(80),
  icon: z.string().trim().max(40).optional(),
});

export const createAttributeDefinitionSchema = z.object({
  categoryId: z.string().min(1),
  key: z
    .string()
    .trim()
    .min(1, { error: "Requerido" })
    .max(60)
    .regex(/^[a-z0-9_]+$/, { error: "Usa minúsculas, números y guion bajo" }),
  label: z.string().trim().min(1, { error: "Requerido" }).max(80),
  dataType: attributeDataTypeSchema,
  options: z.string().trim().max(500).optional(),
  isRequired: z.boolean().default(false),
  showInList: z.boolean().default(false),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, { error: "Requerido" }).max(120),
  categoryId: z.string().min(1, { error: "Selecciona una categoría" }),
  brand: z.string().trim().max(80).optional(),
  inventoryType: inventoryTypeSchema,
  sku: z.string().trim().max(60).optional(),
  salePrice: z.coerce.number({ error: "Precio inválido" }).nonnegative(),
  initialQuantity: z.coerce.number().int().nonnegative().optional(),
  initialCost: z.coerce.number().nonnegative().optional(),
});

export const updateProductSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(1, { error: "Requerido" }).max(120),
  brand: z.string().trim().max(80).optional(),
  isActive: z.boolean(),
  salePrice: z.coerce.number({ error: "Precio inválido" }).nonnegative(),
});

export type AttributeValueInput = { attributeDefinitionId: string; value: string };
