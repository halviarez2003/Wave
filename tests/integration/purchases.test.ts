import { beforeAll, describe, expect, it } from "vitest";

import * as purchasesService from "@/server/modules/purchases/service";
import { createQuantityVariant, createSecondAccount, createTestContext, type TestContext } from "../fixtures";

describe("compras", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it("una compra con pago parcial crea una cuenta por pagar PARTIAL y recibe la cantidad al costo correcto", async () => {
    const variant = await createQuantityVariant(ctx, 100);
    const account = await createSecondAccount(ctx, "Cta compra parcial");

    const purchase = await purchasesService.createPurchase(ctx.db, ctx.companyId, ctx.userId, {
      supplierId: ctx.supplierId,
      warehouseId: ctx.warehouseId,
      items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
      paymentAccountId: account.id,
      paymentAmount: 20,
    });

    expect(Number(purchase.total)).toBe(50);
    expect(Number(purchase.balanceDue)).toBe(30);

    const payable = await ctx.db.accountPayable.findUniqueOrThrow({ where: { purchaseId: purchase.id } });
    expect(payable.status).toBe("PARTIAL");
    expect(Number(payable.balance)).toBe(30);

    const balance = await ctx.db.inventoryBalance.findUniqueOrThrow({
      where: { productVariantId_warehouseId: { productVariantId: variant.id, warehouseId: ctx.warehouseId } },
    });
    expect(balance.quantity).toBe(10);
    expect(Number(balance.averageCost)).toBeCloseTo(5, 4);

    await purchasesService.payPayable(ctx.db, ctx.companyId, ctx.userId, {
      payableId: payable.id,
      accountId: account.id,
      amount: 30,
    });

    const updated = await ctx.db.accountPayable.findUniqueOrThrow({ where: { id: payable.id } });
    expect(updated.status).toBe("PAID");
    expect(Number(updated.balance)).toBe(0);
  });

  it("una compra pagada de contado no genera cuenta por pagar", async () => {
    const variant = await createQuantityVariant(ctx, 100);
    const account = await createSecondAccount(ctx, "Cta compra contado");

    const purchase = await purchasesService.createPurchase(ctx.db, ctx.companyId, ctx.userId, {
      supplierId: ctx.supplierId,
      warehouseId: ctx.warehouseId,
      items: [{ variantId: variant.id, quantity: 4, unitCost: 8 }],
      paymentAccountId: account.id,
      paymentAmount: 32,
    });

    expect(Number(purchase.balanceDue)).toBe(0);
    const payable = await ctx.db.accountPayable.findUnique({ where: { purchaseId: purchase.id } });
    expect(payable).toBeNull();
  });
});
