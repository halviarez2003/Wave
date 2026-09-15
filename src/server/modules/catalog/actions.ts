"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";

import {
  createAttributeDefinitionSchema,
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
} from "./schema";
import * as catalogService from "./service";
import type { AttributeValueInput } from "./schema";

export type ActionState = { error?: string } | undefined;

export async function createCategoryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("settings.manage");
  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  await catalogService.createCategory(db, session.user.companyId, parsed.data);
  revalidatePath("/inventario/categorias");
  redirect("/inventario/categorias");
}

export async function createAttributeDefinitionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("settings.manage");
  const categoryId = formData.get("categoryId");
  const parsed = createAttributeDefinitionSchema.safeParse({
    categoryId,
    key: formData.get("key"),
    label: formData.get("label"),
    dataType: formData.get("dataType"),
    options: formData.get("options") || undefined,
    isRequired: formData.get("isRequired") === "on",
    showInList: formData.get("showInList") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  try {
    await catalogService.createAttributeDefinition(db, session.user.companyId, parsed.data);
  } catch {
    return { error: "Ya existe un atributo con esa clave en esta categoría." };
  }
  revalidatePath(`/inventario/categorias/${categoryId}`);
  return undefined;
}

async function parseDynamicAttributeValues(
  db: ReturnType<typeof getScopedPrisma>,
  categoryId: string,
  formData: FormData,
): Promise<{ ok: true; values: AttributeValueInput[] } | { ok: false; error: string }> {
  const category = await catalogService.getCategoryWithAttributes(db, categoryId);
  if (!category) {
    return { ok: false, error: "Categoría inválida." };
  }

  const values: AttributeValueInput[] = [];
  for (const def of category.attributeDefinitions) {
    const raw = formData.get(`attr_${def.id}`);
    const value = typeof raw === "string" ? raw.trim() : "";

    if (!value) {
      if (def.isRequired) {
        return { ok: false, error: `"${def.label}" es requerido.` };
      }
      continue;
    }

    if (def.dataType === "NUMBER" && Number.isNaN(Number(value))) {
      return { ok: false, error: `"${def.label}" debe ser numérico.` };
    }

    if (def.dataType === "SELECT") {
      const options = Array.isArray(def.options) ? (def.options as string[]) : [];
      if (!options.includes(value)) {
        return { ok: false, error: `"${def.label}" no es una opción válida.` };
      }
    }

    values.push({ attributeDefinitionId: def.id, value });
  }

  return { ok: true, values };
}

export async function createProductAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("inventory.create");
  const parsed = createProductSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    brand: formData.get("brand") || undefined,
    inventoryType: formData.get("inventoryType"),
    sku: formData.get("sku") || undefined,
    salePrice: formData.get("salePrice"),
    initialQuantity: formData.get("initialQuantity") || undefined,
    initialCost: formData.get("initialCost") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  const attrResult = await parseDynamicAttributeValues(db, parsed.data.categoryId, formData);
  if (!attrResult.ok) {
    return { error: attrResult.error };
  }

  const product = await catalogService.createProduct(db, session.user.companyId, {
    ...parsed.data,
    attributeValues: attrResult.values,
  });

  revalidatePath("/inventario/productos");
  redirect(`/inventario/productos/${product.id}`);
}

export async function updateProductAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission("inventory.create");
  const parsed = updateProductSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    brand: formData.get("brand") || undefined,
    isActive: formData.get("isActive") === "on",
    salePrice: formData.get("salePrice"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getScopedPrisma(session.user.companyId);
  await catalogService.updateProduct(db, parsed.data);
  revalidatePath("/inventario/productos");
  revalidatePath(`/inventario/productos/${parsed.data.productId}`);
  return undefined;
}
