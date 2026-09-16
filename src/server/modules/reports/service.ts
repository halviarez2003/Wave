import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";

export type DateRange = { from: Date; to: Date };

function variantLabel(product: { name: string }, variant: { label: string }) {
  return variant.label === "Único" ? product.name : `${product.name} — ${variant.label}`;
}

export async function getSalesReport(db: ScopedPrisma, range: DateRange) {
  const sales = await db.sale.findMany({
    where: { status: "COMPLETED", saleDate: { gte: range.from, lte: range.to } },
    include: { user: true, customer: true },
    orderBy: { saleDate: "desc" },
  });

  const total = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalProfit = sales.reduce((sum, s) => sum + Number(s.totalProfit), 0);
  const count = sales.length;
  const averageTicket = count > 0 ? total / count : 0;

  const bySellerMap = new Map<string, { userId: string; name: string; total: number; count: number }>();
  for (const s of sales) {
    const entry = bySellerMap.get(s.userId) ?? { userId: s.userId, name: s.user.name, total: 0, count: 0 };
    entry.total += Number(s.total);
    entry.count += 1;
    bySellerMap.set(s.userId, entry);
  }
  const bySeller = [...bySellerMap.values()].sort((a, b) => b.total - a.total);

  return {
    total,
    totalProfit,
    count,
    averageTicket,
    bySeller,
    rows: sales.map((s) => ({
      id: s.id,
      number: s.number,
      date: s.saleDate,
      customerName: s.customer?.name ?? "Sin cliente",
      total: Number(s.total),
      profit: Number(s.totalProfit),
    })),
  };
}

export async function getPurchasesReport(db: ScopedPrisma, range: DateRange) {
  const purchases = await db.purchase.findMany({
    where: { status: "COMPLETED", purchaseDate: { gte: range.from, lte: range.to } },
    include: { supplier: true },
    orderBy: { purchaseDate: "desc" },
  });

  const total = purchases.reduce((sum, p) => sum + Number(p.total), 0);
  const count = purchases.length;

  const bySupplierMap = new Map<string, { supplierId: string; name: string; total: number; count: number }>();
  for (const p of purchases) {
    const entry = bySupplierMap.get(p.supplierId) ?? {
      supplierId: p.supplierId,
      name: p.supplier.name,
      total: 0,
      count: 0,
    };
    entry.total += Number(p.total);
    entry.count += 1;
    bySupplierMap.set(p.supplierId, entry);
  }
  const bySupplier = [...bySupplierMap.values()].sort((a, b) => b.total - a.total);

  return {
    total,
    count,
    bySupplier,
    rows: purchases.map((p) => ({
      id: p.id,
      number: p.number,
      date: p.purchaseDate,
      supplierName: p.supplier.name,
      total: Number(p.total),
    })),
  };
}

/**
 * Rentabilidad por producto en el rango: se agrega en JS a partir de
 * Sale.findMany (ya acotado por companyId) en vez de un SaleItem.groupBy
 * directo — SaleItem no tiene companyId propio, así que un groupBy sin
 * pasar por Sale se saldría del tenant scoping de getScopedPrisma.
 */
export async function getProfitabilityReport(db: ScopedPrisma, range: DateRange) {
  const sales = await db.sale.findMany({
    where: { status: "COMPLETED", saleDate: { gte: range.from, lte: range.to } },
    select: {
      items: {
        select: { productVariantId: true, quantity: true, profit: true, subtotal: true },
      },
    },
  });

  const agg = new Map<string, { quantity: number; revenue: number; profit: number }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const entry = agg.get(item.productVariantId) ?? { quantity: 0, revenue: 0, profit: 0 };
      entry.quantity += item.quantity;
      entry.revenue += Number(item.subtotal);
      entry.profit += Number(item.profit);
      agg.set(item.productVariantId, entry);
    }
  }

  const variantIds = [...agg.keys()];
  const variants = variantIds.length
    ? await db.productVariant.findMany({ where: { id: { in: variantIds } }, include: { product: true } })
    : [];
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const rows = [...agg.entries()]
    .map(([variantId, a]) => {
      const variant = variantById.get(variantId);
      return {
        variantId,
        label: variant ? variantLabel(variant.product, variant) : "(producto eliminado)",
        quantity: a.quantity,
        revenue: a.revenue,
        profit: a.profit,
        margin: a.revenue > 0 ? (a.profit / a.revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  return { rows };
}

export async function getExpensesReport(db: ScopedPrisma, range: DateRange) {
  const expenses = await db.expense.findMany({
    where: { expenseDate: { gte: range.from, lte: range.to } },
    include: { category: true },
  });

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const byCategoryMap = new Map<string, { categoryId: string; name: string; total: number }>();
  for (const e of expenses) {
    const entry = byCategoryMap.get(e.expenseCategoryId) ?? {
      categoryId: e.expenseCategoryId,
      name: e.category.name,
      total: 0,
    };
    entry.total += Number(e.amount);
    byCategoryMap.set(e.expenseCategoryId, entry);
  }
  const byCategory = [...byCategoryMap.values()].sort((a, b) => b.total - a.total);

  return { total, byCategory };
}

/**
 * Valorización de inventario: foto del momento actual (no depende del
 * rango de fechas del reporte), a costo y a precio de venta de lista —
 * la diferencia es el margen potencial si se vendiera todo el stock hoy.
 */
export async function getInventoryValuationReport(db: ScopedPrisma) {
  const [balances, units] = await Promise.all([
    db.inventoryBalance.findMany({
      where: { quantity: { gt: 0 } },
      include: { variant: { include: { product: { include: { category: true } } } } },
    }),
    db.inventoryUnit.findMany({
      where: { status: "AVAILABLE" },
      include: { variant: { include: { product: { include: { category: true } } } } },
    }),
  ]);

  const byCategoryMap = new Map<string, { categoryId: string; name: string; costValue: number; saleValue: number; units: number }>();

  function addTo(categoryId: string, categoryName: string, costValue: number, saleValue: number, unitCount: number) {
    const entry = byCategoryMap.get(categoryId) ?? { categoryId, name: categoryName, costValue: 0, saleValue: 0, units: 0 };
    entry.costValue += costValue;
    entry.saleValue += saleValue;
    entry.units += unitCount;
    byCategoryMap.set(categoryId, entry);
  }

  for (const b of balances) {
    const category = b.variant.product.category;
    addTo(
      category.id,
      category.name,
      b.quantity * Number(b.averageCost),
      b.quantity * Number(b.variant.salePrice),
      b.quantity,
    );
  }
  for (const u of units) {
    const category = u.variant.product.category;
    addTo(category.id, category.name, Number(u.cost), Number(u.suggestedPrice ?? u.variant.salePrice), 1);
  }

  const byCategory = [...byCategoryMap.values()].sort((a, b) => b.costValue - a.costValue);
  const totalCostValue = byCategory.reduce((sum, c) => sum + c.costValue, 0);
  const totalSaleValue = byCategory.reduce((sum, c) => sum + c.saleValue, 0);

  return { totalCostValue, totalSaleValue, byCategory };
}
