import { prisma, getScopedPrisma, type ScopedPrisma } from "@/lib/prisma";
import * as catalogService from "@/server/modules/catalog/service";

export type TestContext = {
  companyId: string;
  db: ScopedPrisma;
  userId: string;
  warehouseId: string;
  categoryId: string;
  accountId: string;
  customerId: string;
  supplierId: string;
};

/**
 * Cada test file crea su propia "empresa" aislada con un sufijo único —
 * igual que los scripts de Playwright de las fases anteriores, así los
 * tests no interfieren entre sí ni con la empresa demo, sin necesitar un
 * reseteo/borrado en cascada de la base al final de cada corrida.
 */
export async function createTestContext(): Promise<TestContext> {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;

  const currency = await prisma.currency.upsert({
    where: { code: "USD" },
    update: {},
    create: { code: "USD", name: "Dólar estadounidense", symbol: "$" },
  });

  const company = await prisma.company.create({
    data: { name: `Test Co ${suffix}`, baseCurrencyId: currency.id },
  });

  const role = await prisma.role.create({
    data: { companyId: company.id, name: "TEST_ROLE", isSystem: false },
  });

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      roleId: role.id,
      email: `test-${suffix}@wave.test`,
      passwordHash: "x",
      name: "Test User",
    },
  });

  const warehouse = await prisma.warehouse.create({
    data: { companyId: company.id, name: "Principal", isDefault: true },
  });

  const category = await prisma.category.create({
    data: { companyId: company.id, name: "Test Category", sortOrder: 0 },
  });

  const account = await prisma.account.create({
    data: { companyId: company.id, name: "Caja Test", type: "CASH", currencyId: currency.id, balance: 0 },
  });

  const customer = await prisma.customer.create({
    data: { companyId: company.id, name: "Cliente Test" },
  });

  const supplier = await prisma.supplier.create({
    data: { companyId: company.id, name: "Proveedor Test" },
  });

  for (const type of ["SALE", "PURCHASE"] as const) {
    await prisma.documentSequence.create({
      data: { companyId: company.id, type, nextNumber: 1 },
    });
  }

  return {
    companyId: company.id,
    db: getScopedPrisma(company.id),
    userId: user.id,
    warehouseId: warehouse.id,
    categoryId: category.id,
    accountId: account.id,
    customerId: customer.id,
    supplierId: supplier.id,
  };
}

export async function createSecondAccount(ctx: TestContext, name = "Banco Test") {
  const currency = await prisma.currency.findUniqueOrThrow({ where: { code: "USD" } });
  return prisma.account.create({
    data: { companyId: ctx.companyId, name, type: "BANK", currencyId: currency.id, balance: 0 },
  });
}

export async function createQuantityVariant(ctx: TestContext, salePrice: number) {
  const product = await catalogService.createProduct(ctx.db, ctx.companyId, {
    name: "Producto de prueba (cantidad)",
    categoryId: ctx.categoryId,
    inventoryType: "QUANTITY",
    salePrice,
    attributeValues: [],
  });
  return ctx.db.productVariant.findFirstOrThrow({ where: { productId: product.id } });
}

export async function createSerializedVariant(ctx: TestContext, salePrice: number) {
  const product = await catalogService.createProduct(ctx.db, ctx.companyId, {
    name: "Producto de prueba (serializado)",
    categoryId: ctx.categoryId,
    inventoryType: "SERIALIZED",
    salePrice,
    attributeValues: [],
  });
  return ctx.db.productVariant.findFirstOrThrow({ where: { productId: product.id } });
}
