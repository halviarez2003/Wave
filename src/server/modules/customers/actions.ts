"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";

import { createCustomerSchema } from "./schema";
import * as customersService from "./service";

export type ActionState = { error?: string } | undefined;

export async function createCustomerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("customers.manage");
  const parsed = createCustomerSchema.safeParse({
    name: formData.get("name"),
    document: formData.get("document") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    address: formData.get("address") || undefined,
    notes: formData.get("notes") || undefined,
    creditLimit: formData.get("creditLimit") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  await customersService.createCustomer(db, session.user.companyId, parsed.data);
  revalidatePath("/clientes");
  return undefined;
}
