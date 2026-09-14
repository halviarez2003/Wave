"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";

import { createSupplierSchema } from "./schema";
import * as suppliersService from "./service";

export type ActionState = { error?: string } | undefined;

export async function createSupplierAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("suppliers.manage");
  const parsed = createSupplierSchema.safeParse({
    name: formData.get("name"),
    document: formData.get("document") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    address: formData.get("address") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  await suppliersService.createSupplier(db, session.user.companyId, parsed.data);
  revalidatePath("/proveedores");
  return undefined;
}
