import { beforeAll, describe, expect, it } from "vitest";

import * as inventoryService from "@/server/modules/inventory/service";
import * as reportsService from "@/server/modules/reports/service";
import { createQuantityVariant, createSerializedVariant, createTestContext, type TestContext } from "../fixtures";

describe("valorización de inventario", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it("coincide con la suma manual de balances por cantidad y unidades serializadas disponibles", async () => {
    const quantityVariant = await createQuantityVariant(ctx, 20);
    await inventoryService.receivePurchaseQuantity(ctx.db, ctx.companyId, ctx.userId, {
      variantId: quantityVariant.id,
      warehouseId: ctx.warehouseId,
      quantity: 10,
      unitCost: 6,
      purchaseId: "test-po",
    });

    const serializedVariant = await createSerializedVariant(ctx, 300);
    await inventoryService.addSerializedUnits(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      serializedVariant.id,
      ctx.warehouseId,
      [{ imei1: `VALUATION-${Date.now()}`, cost: 150, suggestedPrice: 300, condition: "NEW" }],
    );

    const report = await reportsService.getInventoryValuationReport(ctx.db);

    const expectedCostValue = 10 * 6 + 150; // 60 + 150
    const expectedSaleValue = 10 * 20 + 300; // 200 + 300

    expect(report.totalCostValue).toBeCloseTo(expectedCostValue, 4);
    expect(report.totalSaleValue).toBeCloseTo(expectedSaleValue, 4);
  });
});
