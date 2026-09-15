import { beforeAll, describe, expect, it } from "vitest";

import * as inventoryService from "@/server/modules/inventory/service";
import { createSerializedVariant, createTestContext, type TestContext } from "../fixtures";

describe("IMEI/serial duplicado", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it("rechaza un IMEI duplicado dentro de la misma empresa", async () => {
    const variant = await createSerializedVariant(ctx, 100);
    const imei = `DUP-IMEI-${Date.now()}`;

    await inventoryService.addSerializedUnits(ctx.db, ctx.companyId, ctx.userId, variant.id, ctx.warehouseId, [
      { imei1: imei, cost: 50, condition: "NEW" },
    ]);

    await expect(
      inventoryService.addSerializedUnits(ctx.db, ctx.companyId, ctx.userId, variant.id, ctx.warehouseId, [
        { imei1: imei, cost: 60, condition: "NEW" },
      ]),
    ).rejects.toThrow();
  });

  it("rechaza un serial duplicado dentro de la misma empresa", async () => {
    const variant = await createSerializedVariant(ctx, 100);
    const serial = `DUP-SERIAL-${Date.now()}`;

    await inventoryService.addSerializedUnits(ctx.db, ctx.companyId, ctx.userId, variant.id, ctx.warehouseId, [
      { serial, cost: 50, condition: "NEW" },
    ]);

    await expect(
      inventoryService.addSerializedUnits(ctx.db, ctx.companyId, ctx.userId, variant.id, ctx.warehouseId, [
        { serial, cost: 60, condition: "NEW" },
      ]),
    ).rejects.toThrow();
  });

  it("el mismo IMEI sí se permite en dos empresas distintas — el único es por (companyId, imei1)", async () => {
    const otherCtx = await createTestContext();
    const variant1 = await createSerializedVariant(ctx, 100);
    const variant2 = await createSerializedVariant(otherCtx, 100);
    const sharedImei = `SHARED-IMEI-${Date.now()}`;

    await inventoryService.addSerializedUnits(ctx.db, ctx.companyId, ctx.userId, variant1.id, ctx.warehouseId, [
      { imei1: sharedImei, cost: 50, condition: "NEW" },
    ]);

    await expect(
      inventoryService.addSerializedUnits(
        otherCtx.db,
        otherCtx.companyId,
        otherCtx.userId,
        variant2.id,
        otherCtx.warehouseId,
        [{ imei1: sharedImei, cost: 50, condition: "NEW" }],
      ),
    ).resolves.toBeDefined();
  });
});
