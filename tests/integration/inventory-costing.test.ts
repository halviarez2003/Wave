import { beforeAll, describe, expect, it } from "vitest";

import * as inventoryService from "@/server/modules/inventory/service";
import { createQuantityVariant, createSerializedVariant, createTestContext, type TestContext } from "../fixtures";

describe("costeo de inventario", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it("recalcula el costo promedio ponderado tras compras sucesivas a distinto costo", async () => {
    const variant = await createQuantityVariant(ctx, 100);

    await inventoryService.receivePurchaseQuantity(ctx.db, ctx.companyId, ctx.userId, {
      variantId: variant.id,
      warehouseId: ctx.warehouseId,
      quantity: 10,
      unitCost: 5,
      purchaseId: "test-po-1",
    });

    let balance = await ctx.db.inventoryBalance.findUniqueOrThrow({
      where: { productVariantId_warehouseId: { productVariantId: variant.id, warehouseId: ctx.warehouseId } },
    });
    expect(balance.quantity).toBe(10);
    expect(Number(balance.averageCost)).toBeCloseTo(5, 4);

    await inventoryService.receivePurchaseQuantity(ctx.db, ctx.companyId, ctx.userId, {
      variantId: variant.id,
      warehouseId: ctx.warehouseId,
      quantity: 10,
      unitCost: 7,
      purchaseId: "test-po-2",
    });

    balance = await ctx.db.inventoryBalance.findUniqueOrThrow({
      where: { productVariantId_warehouseId: { productVariantId: variant.id, warehouseId: ctx.warehouseId } },
    });
    expect(balance.quantity).toBe(20);
    // (10*5 + 10*7) / 20 = 6
    expect(Number(balance.averageCost)).toBeCloseTo(6, 4);
  });

  it("cada unidad serializada mantiene su propio costo — nunca se promedia", async () => {
    const variant = await createSerializedVariant(ctx, 200);

    await inventoryService.addSerializedUnits(ctx.db, ctx.companyId, ctx.userId, variant.id, ctx.warehouseId, [
      { imei1: `COST-A-${Date.now()}`, cost: 50, condition: "NEW" },
      { imei1: `COST-B-${Date.now()}`, cost: 80, condition: "NEW" },
    ]);

    const units = await ctx.db.inventoryUnit.findMany({
      where: { productVariantId: variant.id },
      orderBy: { cost: "asc" },
    });
    expect(units.map((u) => Number(u.cost))).toEqual([50, 80]);
  });
});
