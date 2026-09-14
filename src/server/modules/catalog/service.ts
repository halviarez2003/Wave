import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import type {
  AttributeValueInput,
  createAttributeDefinitionSchema,
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
} from "./schema";
import type { z } from "zod";

export async function listCategories(db: ScopedPrisma) {
  return db.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { attributeDefinitions: true, products: true } },
    },
  });
}

export async function listCategoriesWithAttributes(db: ScopedPrisma) {
  return db.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      attributeDefinitions: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function getCategoryWithAttributes(db: ScopedPrisma, categoryId: string) {
  return db.category.findUnique({
    where: { id: categoryId },
    include: {
      attributeDefinitions: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function createCategory(
  db: ScopedPrisma,
  companyId: string,
  input: z.infer<typeof createCategorySchema>,
) {
  const count = await db.category.count();
  return db.category.create({
    data: { companyId, name: input.name, icon: input.icon, sortOrder: count },
  });
}

export async function createAttributeDefinition(
  db: ScopedPrisma,
  companyId: string,
  input: z.infer<typeof createAttributeDefinitionSchema>,
) {
  const sortOrder = await db.attributeDefinition.count({
    where: { categoryId: input.categoryId },
  });

  const options =
    input.dataType === "SELECT"
      ? (input.options ?? "")
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : undefined;

  return db.attributeDefinition.create({
    data: {
      companyId,
      categoryId: input.categoryId,
      key: input.key,
      label: input.label,
      dataType: input.dataType,
      options,
      isRequired: input.isRequired,
      showInList: input.showInList,
      sortOrder,
    },
  });
}

export async function listProducts(db: ScopedPrisma) {
  const products = await db.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      variants: {
        include: {
          inventoryBalances: true,
          inventoryUnits: { where: { status: "AVAILABLE" } },
        },
      },
    },
  });

  return products.map((product) => {
    const stock = product.variants.reduce((sum, variant) => {
      if (product.inventoryType === "QUANTITY") {
        return sum + variant.inventoryBalances.reduce((s, b) => s + b.quantity, 0);
      }
      return sum + variant.inventoryUnits.length;
    }, 0);

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      isActive: product.isActive,
      inventoryType: product.inventoryType,
      categoryName: product.category.name,
      salePrice: product.variants[0]?.salePrice ?? null,
      stock,
    };
  });
}

export async function getProduct(db: ScopedPrisma, productId: string) {
  return db.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      variants: {
        include: {
          attributeValues: { include: { attribute: true } },
          inventoryBalances: { include: { warehouse: true } },
          inventoryUnits: { where: { status: "AVAILABLE" } },
        },
      },
    },
  });
}

type CreateProductInput = z.infer<typeof createProductSchema> & {
  attributeValues: AttributeValueInput[];
};

/**
 * Crea Product + su ProductVariant "Único" + valores de atributo, y si se
 * dio cantidad/costo inicial (solo para inventario por cantidad), abre el
 * InventoryBalance con un InventoryMovement MANUAL_IN — nunca stock sin
 * movimiento (docs/01-arquitectura.md, sección 2). Para SERIALIZED, el
 * stock inicial se carga unidad por unidad desde Inventario (Fase 7/8), no
 * aquí.
 */
export async function createProduct(
  db: ScopedPrisma,
  companyId: string,
  input: CreateProductInput,
) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        companyId,
        name: input.name,
        categoryId: input.categoryId,
        brand: input.brand,
        inventoryType: input.inventoryType,
      },
    });

    const variant = await tx.productVariant.create({
      data: {
        productId: product.id,
        label: "Único",
        sku: input.sku,
        salePrice: input.salePrice,
        lastCost: input.initialCost,
      },
    });

    if (input.attributeValues.length > 0) {
      await tx.productAttributeValue.createMany({
        data: input.attributeValues.map((v) => ({
          productVariantId: variant.id,
          attributeDefinitionId: v.attributeDefinitionId,
          value: v.value,
        })),
      });
    }

    if (input.inventoryType === "QUANTITY" && input.initialQuantity && input.initialQuantity > 0) {
      const warehouse = await tx.warehouse.findFirstOrThrow({ where: { isDefault: true } });
      const cost = input.initialCost ?? 0;
      const totalValue = cost * input.initialQuantity;

      await tx.inventoryBalance.create({
        data: {
          companyId,
          productVariantId: variant.id,
          warehouseId: warehouse.id,
          quantity: input.initialQuantity,
          averageCost: cost,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          companyId,
          productVariantId: variant.id,
          warehouseId: warehouse.id,
          type: "MANUAL_IN",
          quantity: input.initialQuantity,
          stockBefore: 0,
          stockAfter: input.initialQuantity,
          unitCost: cost,
          totalValue,
          reason: "Inventario inicial al crear el producto",
        },
      });
    }

    return product;
  });
}

export async function updateProduct(
  db: ScopedPrisma,
  input: z.infer<typeof updateProductSchema>,
) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: input.productId },
      data: { name: input.name, brand: input.brand, isActive: input.isActive },
      include: { variants: true },
    });

    const firstVariant = product.variants[0];
    if (firstVariant) {
      await tx.productVariant.update({
        where: { id: firstVariant.id },
        data: { salePrice: input.salePrice },
      });
    }

    return product;
  });
}
