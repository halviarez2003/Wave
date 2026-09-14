import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import type {
  NewUnitRow,
  adjustQuantitySchema,
  adjustUnitStatusSchema,
  createWarehouseSchema,
  transferStockSchema,
} from "./schema";
import type { z } from "zod";

export async function listWarehouses(db: ScopedPrisma) {
  return db.warehouse.findMany({ orderBy: { name: "asc" } });
}

export async function createWarehouse(
  db: ScopedPrisma,
  companyId: string,
  input: z.infer<typeof createWarehouseSchema>,
) {
  return db.warehouse.create({ data: { companyId, name: input.name, address: input.address } });
}

export async function listVariantsForPicker(db: ScopedPrisma) {
  const variants = await db.productVariant.findMany({
    where: { product: { isActive: true } },
    include: { product: { include: { category: true } } },
    orderBy: { createdAt: "desc" },
  });

  return variants.map((v) => ({
    id: v.id,
    label: v.label === "Único" ? v.product.name : `${v.product.name} — ${v.label}`,
    categoryName: v.product.category.name,
    inventoryType: v.product.inventoryType,
  }));
}

export async function getVariantDetail(db: ScopedPrisma, variantId: string) {
  return db.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: { include: { category: true } },
      inventoryBalances: { include: { warehouse: true }, orderBy: { warehouseId: "asc" } },
      inventoryUnits: { include: { warehouse: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getVariantKardex(db: ScopedPrisma, variantId: string) {
  return db.inventoryMovement.findMany({
    where: { productVariantId: variantId },
    include: { warehouse: true, user: true, inventoryUnit: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listMovements(db: ScopedPrisma, search?: string) {
  return db.inventoryMovement.findMany({
    where: search
      ? {
          variant: {
            OR: [
              { label: { contains: search, mode: "insensitive" } },
              { product: { name: { contains: search, mode: "insensitive" } } },
            ],
          },
        }
      : undefined,
    include: {
      variant: { include: { product: true } },
      warehouse: true,
      user: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

// Tipado como el subconjunto del cliente que usa (no como ScopedPrisma
// completo): dentro de $transaction, `tx` no expone $transaction/$extends,
// así que basta con pedir el delegate de InventoryBalance.
async function getOrCreateBalance(
  tx: Pick<ScopedPrisma, "inventoryBalance">,
  companyId: string,
  variantId: string,
  warehouseId: string,
) {
  const existing = await tx.inventoryBalance.findUnique({
    where: { productVariantId_warehouseId: { productVariantId: variantId, warehouseId } },
  });
  if (existing) return existing;
  return tx.inventoryBalance.create({
    data: { companyId, productVariantId: variantId, warehouseId, quantity: 0, averageCost: 0 },
  });
}

export async function adjustQuantity(
  db: ScopedPrisma,
  companyId: string,
  userId: string,
  input: z.infer<typeof adjustQuantitySchema>,
) {
  return db.$transaction(async (tx) => {
    const balance = await getOrCreateBalance(tx, companyId, input.variantId, input.warehouseId);
    const delta = input.direction === "IN" ? input.quantity : -input.quantity;

    if (delta < 0) {
      // decremento atómico y guardado: si otra transacción concurrente ya
      // dejó el balance por debajo de lo requerido, count será 0 y abortamos
      // en vez de arriesgar stock negativo.
      const result = await tx.inventoryBalance.updateMany({
        where: { id: balance.id, quantity: { gte: input.quantity } },
        data: { quantity: { decrement: input.quantity } },
      });
      if (result.count === 0) {
        throw new Error("Stock insuficiente para este ajuste.");
      }
    } else {
      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { quantity: { increment: input.quantity } },
      });
    }

    const stockBefore = balance.quantity;
    const stockAfter = stockBefore + delta;

    return tx.inventoryMovement.create({
      data: {
        companyId,
        productVariantId: input.variantId,
        warehouseId: input.warehouseId,
        type: delta >= 0 ? "ADJUSTMENT_POSITIVE" : "ADJUSTMENT_NEGATIVE",
        quantity: Math.abs(delta),
        stockBefore,
        stockAfter,
        unitCost: balance.averageCost,
        totalValue: Number(balance.averageCost) * Math.abs(delta),
        reason: input.reason,
        userId,
      },
    });
  });
}

export async function transferStock(
  db: ScopedPrisma,
  companyId: string,
  userId: string,
  input: z.infer<typeof transferStockSchema>,
) {
  return db.$transaction(async (tx) => {
    const source = await getOrCreateBalance(tx, companyId, input.variantId, input.fromWarehouseId);
    const dest = await getOrCreateBalance(tx, companyId, input.variantId, input.toWarehouseId);

    const result = await tx.inventoryBalance.updateMany({
      where: { id: source.id, quantity: { gte: input.quantity } },
      data: { quantity: { decrement: input.quantity } },
    });
    if (result.count === 0) {
      throw new Error("Stock insuficiente en el almacén de origen.");
    }

    const sourceCost = Number(source.averageCost);
    const destQtyBefore = dest.quantity;
    const destCostBefore = Number(dest.averageCost);
    const newDestQty = destQtyBefore + input.quantity;
    const newDestAvgCost =
      newDestQty === 0
        ? 0
        : (destQtyBefore * destCostBefore + input.quantity * sourceCost) / newDestQty;

    await tx.inventoryBalance.update({
      where: { id: dest.id },
      data: { quantity: { increment: input.quantity }, averageCost: newDestAvgCost },
    });

    const transferGroupId = crypto.randomUUID();
    const reason = input.reason ?? "Transferencia entre almacenes";

    await tx.inventoryMovement.create({
      data: {
        companyId,
        productVariantId: input.variantId,
        warehouseId: input.fromWarehouseId,
        type: "TRANSFER_OUT",
        quantity: input.quantity,
        stockBefore: source.quantity,
        stockAfter: source.quantity - input.quantity,
        unitCost: sourceCost,
        totalValue: sourceCost * input.quantity,
        relatedDocumentType: "TRANSFER",
        relatedDocumentId: transferGroupId,
        reason,
        userId,
      },
    });

    return tx.inventoryMovement.create({
      data: {
        companyId,
        productVariantId: input.variantId,
        warehouseId: input.toWarehouseId,
        type: "TRANSFER_IN",
        quantity: input.quantity,
        stockBefore: destQtyBefore,
        stockAfter: newDestQty,
        unitCost: sourceCost,
        totalValue: sourceCost * input.quantity,
        relatedDocumentType: "TRANSFER",
        relatedDocumentId: transferGroupId,
        reason,
        userId,
      },
    });
  });
}

export async function addSerializedUnits(
  db: ScopedPrisma,
  companyId: string,
  userId: string,
  variantId: string,
  warehouseId: string,
  units: NewUnitRow[],
) {
  return db.$transaction(async (tx) => {
    const created = [];
    for (const unit of units) {
      const inventoryUnit = await tx.inventoryUnit.create({
        data: {
          companyId,
          productVariantId: variantId,
          warehouseId,
          imei1: unit.imei1 || undefined,
          imei2: unit.imei2 || undefined,
          serial: unit.serial || undefined,
          condition: unit.condition,
          batteryPercent: unit.batteryPercent,
          color: unit.color,
          capacity: unit.capacity,
          cost: unit.cost,
          suggestedPrice: unit.suggestedPrice,
          notes: unit.notes,
          status: "AVAILABLE",
        },
      });

      await tx.inventoryMovement.create({
        data: {
          companyId,
          productVariantId: variantId,
          inventoryUnitId: inventoryUnit.id,
          warehouseId,
          type: "MANUAL_IN",
          quantity: 1,
          stockBefore: 0,
          stockAfter: 1,
          unitCost: unit.cost,
          totalValue: unit.cost,
          reason: "Alta de unidad serializada",
          userId,
        },
      });

      created.push(inventoryUnit);
    }
    return created;
  });
}

const STATUS_TO_MOVEMENT_TYPE = {
  DAMAGED: "DAMAGE",
  RETURNED: "SALE_RETURN",
  IN_REPAIR: "ADJUSTMENT_NEGATIVE",
  LAYAWAY: "ADJUSTMENT_NEGATIVE",
  RESERVED: "ADJUSTMENT_NEGATIVE",
  AVAILABLE: "ADJUSTMENT_POSITIVE",
  SOLD: "SALE",
} as const;

export async function adjustUnitStatus(
  db: ScopedPrisma,
  companyId: string,
  userId: string,
  input: z.infer<typeof adjustUnitStatusSchema>,
) {
  return db.$transaction(async (tx) => {
    const unit = await tx.inventoryUnit.findUniqueOrThrow({ where: { id: input.unitId } });
    const wasAvailable = unit.status === "AVAILABLE";
    const willBeAvailable = input.status === "AVAILABLE";

    await tx.inventoryUnit.update({ where: { id: unit.id }, data: { status: input.status } });

    if (wasAvailable === willBeAvailable) {
      // no cambia el conteo de disponibles (p. ej. RESERVED -> LAYAWAY):
      // se dejó el registro de la unidad, pero no hace falta movimiento de
      // stock porque no entra ni sale de "disponible".
      return unit;
    }

    return tx.inventoryMovement.create({
      data: {
        companyId,
        productVariantId: unit.productVariantId,
        inventoryUnitId: unit.id,
        warehouseId: unit.warehouseId,
        type: STATUS_TO_MOVEMENT_TYPE[input.status],
        quantity: 1,
        stockBefore: wasAvailable ? 1 : 0,
        stockAfter: willBeAvailable ? 1 : 0,
        unitCost: unit.cost,
        totalValue: Number(unit.cost),
        reason: input.reason ?? `Cambio de estado a ${input.status}`,
        userId,
      },
    });
  });
}
