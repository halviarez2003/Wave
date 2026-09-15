import { beforeAll, describe, expect, it } from "vitest";

import * as inventoryService from "@/server/modules/inventory/service";
import * as salesService from "@/server/modules/sales/service";
import {
  createQuantityVariant,
  createSecondAccount,
  createSerializedVariant,
  createTestContext,
  type TestContext,
} from "../fixtures";

describe("ventas", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it("venta por cantidad decrementa el balance y usa el costo promedio como unitCost (nunca el precio)", async () => {
    const variant = await createQuantityVariant(ctx, 100);
    await inventoryService.receivePurchaseQuantity(ctx.db, ctx.companyId, ctx.userId, {
      variantId: variant.id,
      warehouseId: ctx.warehouseId,
      quantity: 10,
      unitCost: 6,
      purchaseId: "test-po",
    });

    const account = await createSecondAccount(ctx, "Cta venta cantidad");
    const sale = await salesService.createSale(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      {
        warehouseId: ctx.warehouseId,
        customerId: ctx.customerId,
        items: [{ variantId: variant.id, quantity: 3, unitPrice: 100 }],
        payments: [{ accountId: account.id, amount: 300 }],
      },
      true,
    );

    expect(Number(sale.totalCost)).toBeCloseTo(3 * 6, 4);
    expect(Number(sale.totalProfit)).toBeCloseTo(300 - 18, 4);
    expect(Number(sale.balanceDue)).toBe(0);

    const balance = await ctx.db.inventoryBalance.findUniqueOrThrow({
      where: { productVariantId_warehouseId: { productVariantId: variant.id, warehouseId: ctx.warehouseId } },
    });
    expect(balance.quantity).toBe(7);
  });

  it("venta serializada reclama la unidad AVAILABLE→SOLD y usa su costo individual", async () => {
    const variant = await createSerializedVariant(ctx, 500);
    const [unit] = await inventoryService.addSerializedUnits(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      variant.id,
      ctx.warehouseId,
      [{ imei1: `SALE-UNIT-${Date.now()}`, cost: 200, condition: "NEW" }],
    );

    const account = await createSecondAccount(ctx, "Cta venta serializada");
    const sale = await salesService.createSale(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      {
        warehouseId: ctx.warehouseId,
        customerId: ctx.customerId,
        items: [{ variantId: variant.id, unitId: unit.id, quantity: 1, unitPrice: 500 }],
        payments: [{ accountId: account.id, amount: 500 }],
      },
      true,
    );

    expect(Number(sale.totalCost)).toBe(200);
    expect(Number(sale.totalProfit)).toBe(300);

    const reloadedUnit = await ctx.db.inventoryUnit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(reloadedUnit.status).toBe("SOLD");

    // Una segunda venta sobre la misma unidad ya vendida debe fallar —
    // reclamo atómico contra doble venta.
    await expect(
      salesService.createSale(
        ctx.db,
        ctx.companyId,
        ctx.userId,
        {
          warehouseId: ctx.warehouseId,
          customerId: ctx.customerId,
          items: [{ variantId: variant.id, unitId: unit.id, quantity: 1, unitPrice: 500 }],
          payments: [{ accountId: account.id, amount: 500 }],
        },
        true,
      ),
    ).rejects.toThrow();
  });

  it("una venta con pago parcial crea una cuenta por cobrar PARTIAL, y cobrar el resto la deja PAID", async () => {
    const variant = await createQuantityVariant(ctx, 100);
    await inventoryService.receivePurchaseQuantity(ctx.db, ctx.companyId, ctx.userId, {
      variantId: variant.id,
      warehouseId: ctx.warehouseId,
      quantity: 5,
      unitCost: 10,
      purchaseId: "test-po",
    });

    const account = await createSecondAccount(ctx, "Cta cobro parcial");
    const sale = await salesService.createSale(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      {
        warehouseId: ctx.warehouseId,
        customerId: ctx.customerId,
        items: [{ variantId: variant.id, quantity: 2, unitPrice: 100 }],
        payments: [{ accountId: account.id, amount: 80 }],
      },
      true,
    );

    expect(Number(sale.balanceDue)).toBe(120);

    const receivable = await ctx.db.accountReceivable.findUniqueOrThrow({ where: { saleId: sale.id } });
    expect(receivable.status).toBe("PARTIAL");
    expect(Number(receivable.balance)).toBe(120);

    await salesService.payReceivable(ctx.db, ctx.companyId, ctx.userId, {
      receivableId: receivable.id,
      accountId: account.id,
      amount: 120,
    });

    const updated = await ctx.db.accountReceivable.findUniqueOrThrow({ where: { id: receivable.id } });
    expect(updated.status).toBe("PAID");
    expect(Number(updated.balance)).toBe(0);

    const updatedAccount = await ctx.db.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(Number(updatedAccount.balance)).toBe(200); // 80 + 120
  });
});
