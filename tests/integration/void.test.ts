import { beforeAll, describe, expect, it } from "vitest";

import * as inventoryService from "@/server/modules/inventory/service";
import * as purchasesService from "@/server/modules/purchases/service";
import * as salesService from "@/server/modules/sales/service";
import {
  createQuantityVariant,
  createSecondAccount,
  createSerializedVariant,
  createTestContext,
  type TestContext,
} from "../fixtures";

describe("anulación (void) de ventas", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it("anular una venta por cantidad devuelve el stock y reversa el pago, sin borrar la venta original", async () => {
    const variant = await createQuantityVariant(ctx, 100);
    await inventoryService.receivePurchaseQuantity(ctx.db, ctx.companyId, ctx.userId, {
      variantId: variant.id,
      warehouseId: ctx.warehouseId,
      quantity: 10,
      unitCost: 6,
      purchaseId: "test-po",
    });

    const account = await createSecondAccount(ctx, "Cta anular venta");
    const sale = await salesService.createSale(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      {
        warehouseId: ctx.warehouseId,
        customerId: ctx.customerId,
        items: [{ variantId: variant.id, quantity: 4, unitPrice: 100 }],
        payments: [{ accountId: account.id, amount: 400 }],
      },
      true,
    );

    await salesService.voidSale(ctx.db, ctx.companyId, ctx.userId, {
      saleId: sale.id,
      reason: "Anulación de prueba",
    });

    const reloadedSale = await ctx.db.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(reloadedSale.status).toBe("VOIDED");
    expect(reloadedSale.voidReason).toBe("Anulación de prueba");

    // Nunca se borra: las líneas originales siguen existiendo.
    const items = await ctx.db.saleItem.findMany({ where: { saleId: sale.id } });
    expect(items).toHaveLength(1);

    const balance = await ctx.db.inventoryBalance.findUniqueOrThrow({
      where: { productVariantId_warehouseId: { productVariantId: variant.id, warehouseId: ctx.warehouseId } },
    });
    expect(balance.quantity).toBe(10); // vuelve al stock original

    const reloadedAccount = await ctx.db.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(Number(reloadedAccount.balance)).toBe(0); // el pago quedó reversado
  });

  it("no se puede anular una venta ya anulada", async () => {
    const variant = await createQuantityVariant(ctx, 50);
    await inventoryService.receivePurchaseQuantity(ctx.db, ctx.companyId, ctx.userId, {
      variantId: variant.id,
      warehouseId: ctx.warehouseId,
      quantity: 5,
      unitCost: 10,
      purchaseId: "test-po",
    });
    const account = await createSecondAccount(ctx, "Cta doble anulacion");
    const sale = await salesService.createSale(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      {
        warehouseId: ctx.warehouseId,
        customerId: ctx.customerId,
        items: [{ variantId: variant.id, quantity: 1, unitPrice: 50 }],
        payments: [{ accountId: account.id, amount: 50 }],
      },
      true,
    );

    await salesService.voidSale(ctx.db, ctx.companyId, ctx.userId, { saleId: sale.id, reason: "primera" });

    await expect(
      salesService.voidSale(ctx.db, ctx.companyId, ctx.userId, { saleId: sale.id, reason: "segunda" }),
    ).rejects.toThrow(/ya está anulada/);
  });

  it("bloquea la anulación si ya se cobró parte de la cuenta por cobrar", async () => {
    const variant = await createQuantityVariant(ctx, 100);
    await inventoryService.receivePurchaseQuantity(ctx.db, ctx.companyId, ctx.userId, {
      variantId: variant.id,
      warehouseId: ctx.warehouseId,
      quantity: 5,
      unitCost: 10,
      purchaseId: "test-po",
    });
    const account = await createSecondAccount(ctx, "Cta credito bloqueo");
    const sale = await salesService.createSale(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      {
        warehouseId: ctx.warehouseId,
        customerId: ctx.customerId,
        items: [{ variantId: variant.id, quantity: 2, unitPrice: 100 }],
        payments: [],
      },
      true,
    );

    const receivable = await ctx.db.accountReceivable.findUniqueOrThrow({ where: { saleId: sale.id } });
    await salesService.payReceivable(ctx.db, ctx.companyId, ctx.userId, {
      receivableId: receivable.id,
      accountId: account.id,
      amount: 50,
    });

    await expect(
      salesService.voidSale(ctx.db, ctx.companyId, ctx.userId, { saleId: sale.id, reason: "x" }),
    ).rejects.toThrow(/ya se cobró/);
  });
});

describe("anulación (void) de compras", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it("anular una compra por cantidad revierte el costo promedio ponderado con la fórmula inversa", async () => {
    const variant = await createQuantityVariant(ctx, 100);

    await purchasesService.createPurchase(ctx.db, ctx.companyId, ctx.userId, {
      supplierId: ctx.supplierId,
      warehouseId: ctx.warehouseId,
      items: [{ variantId: variant.id, quantity: 10, unitCost: 5 }],
    });

    const purchase2 = await purchasesService.createPurchase(ctx.db, ctx.companyId, ctx.userId, {
      supplierId: ctx.supplierId,
      warehouseId: ctx.warehouseId,
      items: [{ variantId: variant.id, quantity: 10, unitCost: 7 }],
    });

    let balance = await ctx.db.inventoryBalance.findUniqueOrThrow({
      where: { productVariantId_warehouseId: { productVariantId: variant.id, warehouseId: ctx.warehouseId } },
    });
    expect(balance.quantity).toBe(20);
    expect(Number(balance.averageCost)).toBeCloseTo(6, 4); // (10*5+10*7)/20

    await purchasesService.voidPurchase(ctx.db, ctx.companyId, ctx.userId, {
      purchaseId: purchase2.id,
      reason: "revertir segunda compra",
    });

    balance = await ctx.db.inventoryBalance.findUniqueOrThrow({
      where: { productVariantId_warehouseId: { productVariantId: variant.id, warehouseId: ctx.warehouseId } },
    });
    expect(balance.quantity).toBe(10);
    expect(Number(balance.averageCost)).toBeCloseTo(5, 4); // vuelve al costo de la primera compra

    const reloadedPurchase = await ctx.db.purchase.findUniqueOrThrow({ where: { id: purchase2.id } });
    expect(reloadedPurchase.status).toBe("VOIDED");
  });

  it("bloquea anular una compra por cantidad si ya no queda stock suficiente", async () => {
    const variant = await createQuantityVariant(ctx, 50);
    const purchase = await purchasesService.createPurchase(ctx.db, ctx.companyId, ctx.userId, {
      supplierId: ctx.supplierId,
      warehouseId: ctx.warehouseId,
      items: [{ variantId: variant.id, quantity: 5, unitCost: 4 }],
    });

    const account = await createSecondAccount(ctx, "Cta venta antes de anular compra");
    await salesService.createSale(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      {
        warehouseId: ctx.warehouseId,
        customerId: ctx.customerId,
        items: [{ variantId: variant.id, quantity: 3, unitPrice: 50 }],
        payments: [{ accountId: account.id, amount: 150 }],
      },
      true,
    );

    await expect(
      purchasesService.voidPurchase(ctx.db, ctx.companyId, ctx.userId, {
        purchaseId: purchase.id,
        reason: "x",
      }),
    ).rejects.toThrow(/no queda stock suficiente/i);
  });

  it("anular una compra serializada devuelve las unidades disponibles a RETURNED", async () => {
    const variant = await createSerializedVariant(ctx, 300);
    const purchase = await purchasesService.createPurchase(ctx.db, ctx.companyId, ctx.userId, {
      supplierId: ctx.supplierId,
      warehouseId: ctx.warehouseId,
      items: [{ variantId: variant.id, quantity: 2, unitCost: 100 }],
    });

    const purchaseWithItems = await ctx.db.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: { items: true },
    });
    const purchaseItem = purchaseWithItems.items[0];

    const units = await inventoryService.addSerializedUnits(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      variant.id,
      ctx.warehouseId,
      [
        { imei1: `VOID-PO-A-${Date.now()}`, cost: 100, condition: "NEW" },
        { imei1: `VOID-PO-B-${Date.now()}`, cost: 100, condition: "NEW" },
      ],
      { purchaseItemId: purchaseItem.id, purchaseId: purchase.id },
    );

    await purchasesService.voidPurchase(ctx.db, ctx.companyId, ctx.userId, {
      purchaseId: purchase.id,
      reason: "revertir recepción serializada",
    });

    const reloadedUnits = await ctx.db.inventoryUnit.findMany({
      where: { id: { in: units.map((u) => u.id) } },
    });
    expect(reloadedUnits.every((u) => u.status === "RETURNED")).toBe(true);
  });

  it("bloquea anular una compra serializada si alguna unidad ya se vendió", async () => {
    const variant = await createSerializedVariant(ctx, 300);
    const purchase = await purchasesService.createPurchase(ctx.db, ctx.companyId, ctx.userId, {
      supplierId: ctx.supplierId,
      warehouseId: ctx.warehouseId,
      items: [{ variantId: variant.id, quantity: 1, unitCost: 100 }],
    });
    const purchaseWithItems = await ctx.db.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: { items: true },
    });
    const purchaseItem = purchaseWithItems.items[0];
    const [unit] = await inventoryService.addSerializedUnits(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      variant.id,
      ctx.warehouseId,
      [{ imei1: `VOID-SOLD-${Date.now()}`, cost: 100, condition: "NEW" }],
      { purchaseItemId: purchaseItem.id, purchaseId: purchase.id },
    );

    const account = await createSecondAccount(ctx, "Cta vender unidad antes de anular");
    await salesService.createSale(
      ctx.db,
      ctx.companyId,
      ctx.userId,
      {
        warehouseId: ctx.warehouseId,
        customerId: ctx.customerId,
        items: [{ variantId: variant.id, unitId: unit.id, quantity: 1, unitPrice: 300 }],
        payments: [{ accountId: account.id, amount: 300 }],
      },
      true,
    );

    await expect(
      purchasesService.voidPurchase(ctx.db, ctx.companyId, ctx.userId, {
        purchaseId: purchase.id,
        reason: "x",
      }),
    ).rejects.toThrow(/ya no está disponible/);
  });
});
