import { beforeAll, describe, expect, it } from "vitest";

import * as inventoryService from "@/server/modules/inventory/service";
import * as purchasesService from "@/server/modules/purchases/service";
import * as salesService from "@/server/modules/sales/service";
import { createQuantityVariant, createTestContext, type TestContext } from "../fixtures";

/**
 * Regresión de un hallazgo real de la auditoría de la Fase 16:
 * ProductVariant no estaba en TENANT_MODELS, así que el picker de
 * productos, el detalle por URL (kardex/ajustes) y las líneas de
 * venta/compra podían leer o referenciar variantes de OTRA empresa.
 * Corregido agregando companyId a ProductVariant y registrándolo en
 * TENANT_MODELS (src/lib/prisma.ts).
 */
describe("aislamiento multi-tenant de ProductVariant", () => {
  let ctxA: TestContext;
  let ctxB: TestContext;

  beforeAll(async () => {
    ctxA = await createTestContext();
    ctxB = await createTestContext();
  });

  it("listVariantsForPicker de la empresa A nunca incluye variantes de la empresa B", async () => {
    const variantA = await createQuantityVariant(ctxA, 10);
    const variantB = await createQuantityVariant(ctxB, 20);

    const picked = await inventoryService.listVariantsForPicker(ctxA.db);
    const ids = picked.map((v) => v.id);

    expect(ids).toContain(variantA.id);
    expect(ids).not.toContain(variantB.id);
  });

  it("getVariantDetail no permite leer una variante de otra empresa por id (IDOR)", async () => {
    const variantB = await createQuantityVariant(ctxB, 20);

    const detail = await inventoryService.getVariantDetail(ctxA.db, variantB.id);
    expect(detail).toBeNull();
  });

  it("listSellableItems (POS) de la empresa A nunca incluye productos de la empresa B", async () => {
    await createQuantityVariant(ctxA, 10);
    const variantB = await createQuantityVariant(ctxB, 20);

    const { quantityItems } = await salesService.listSellableItems(ctxA.db);
    const ids = quantityItems.map((v) => v.variantId);

    expect(ids).not.toContain(variantB.id);
  });

  it("createSale rechaza una línea que referencia una variante de otra empresa", async () => {
    const variantB = await createQuantityVariant(ctxB, 20);

    await expect(
      salesService.createSale(
        ctxA.db,
        ctxA.companyId,
        ctxA.userId,
        {
          warehouseId: ctxA.warehouseId,
          customerId: ctxA.customerId,
          items: [{ variantId: variantB.id, quantity: 1, unitPrice: 20 }],
          payments: [],
        },
        true,
      ),
    ).rejects.toThrow(/ya no existe/);
  });

  it("createPurchase rechaza una línea que referencia una variante de otra empresa", async () => {
    const variantB = await createQuantityVariant(ctxB, 20);

    await expect(
      purchasesService.createPurchase(ctxA.db, ctxA.companyId, ctxA.userId, {
        supplierId: ctxA.supplierId,
        warehouseId: ctxA.warehouseId,
        items: [{ variantId: variantB.id, quantity: 1, unitCost: 10 }],
      }),
    ).rejects.toThrow(/ya no existe/);
  });
});
