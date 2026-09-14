import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, { error: "Requerido" }).max(120),
  document: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(120).optional(),
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
});
