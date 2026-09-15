import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import * as salesService from "@/server/modules/sales/service";
import * as purchasesService from "@/server/modules/purchases/service";

const SLOW_MOVING_DAYS = 60;
const TREND_DAYS = 14;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function variantLabel(product: { name: string }, variant: { label: string }) {
  return variant.label === "Único" ? product.name : `${product.name} — ${variant.label}`;
}

export async function getDashboardSummary(db: ScopedPrisma) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const slowCutoff = new Date(now);
  slowCutoff.setDate(slowCutoff.getDate() - SLOW_MOVING_DAYS);
  const trendStart = startOfDay(now);
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));

  const [
    salesToday,
    salesMonth,
    expensesMonth,
    accounts,
    quantityBalances,
    availableUnits,
    receivables,
    payables,
    recentSaleVariants,
    monthSales,
    trendSales,
  ] = await Promise.all([
    db.sale.aggregate({
      where: { saleDate: { gte: todayStart } },
      _sum: { total: true, totalProfit: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: { saleDate: { gte: monthStart } },
      _sum: { total: true, totalProfit: true },
      _count: true,
    }),
    db.expense.aggregate({
      where: { expenseDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    db.account.findMany(),
    db.inventoryBalance.findMany({
      where: { quantity: { gt: 0 } },
      include: { variant: { include: { product: { include: { category: true } } } } },
    }),
    db.inventoryUnit.findMany({
      where: { status: "AVAILABLE" },
      include: { variant: { include: { product: { include: { category: true } } } } },
    }),
    salesService.listReceivables(db),
    purchasesService.listPayables(db),
    db.inventoryMovement.findMany({
      where: { type: "SALE", createdAt: { gte: slowCutoff } },
      select: { productVariantId: true },
      distinct: ["productVariantId"],
    }),
    db.sale.findMany({
      where: { saleDate: { gte: monthStart } },
      select: {
        items: { select: { productVariantId: true, quantity: true, profit: true, subtotal: true } },
      },
    }),
    db.sale.findMany({
      where: { saleDate: { gte: trendStart } },
      select: { saleDate: true, total: true },
    }),
  ]);

  const totalMoney = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  const inventoryFromQuantity = quantityBalances.reduce(
    (sum, b) => sum + b.quantity * Number(b.averageCost),
    0,
  );
  const inventoryFromUnits = availableUnits.reduce((sum, u) => sum + Number(u.cost), 0);
  const totalInventoryValue = inventoryFromQuantity + inventoryFromUnits;

  const totalReceivable = receivables.totals.pending;
  const totalPayable = payables.totals.pending;
  const controlledCapital = totalMoney + totalInventoryValue + totalReceivable - totalPayable;

  // Inventario sin movimiento: variantes con stock que no tuvieron una
  // venta en los últimos SLOW_MOVING_DAYS días.
  const recentSet = new Set(recentSaleVariants.map((m) => m.productVariantId));
  const stockByVariant = new Map<
    string,
    { variantId: string; label: string; categoryName: string; units: number; capital: number }
  >();
  for (const b of quantityBalances) {
    const key = b.productVariantId;
    const entry = stockByVariant.get(key) ?? {
      variantId: key,
      label: variantLabel(b.variant.product, b.variant),
      categoryName: b.variant.product.category.name,
      units: 0,
      capital: 0,
    };
    entry.units += b.quantity;
    entry.capital += b.quantity * Number(b.averageCost);
    stockByVariant.set(key, entry);
  }
  for (const u of availableUnits) {
    const key = u.productVariantId;
    const entry = stockByVariant.get(key) ?? {
      variantId: key,
      label: variantLabel(u.variant.product, u.variant),
      categoryName: u.variant.product.category.name,
      units: 0,
      capital: 0,
    };
    entry.units += 1;
    entry.capital += Number(u.cost);
    stockByVariant.set(key, entry);
  }

  const slowMoving = [...stockByVariant.values()]
    .filter((v) => !recentSet.has(v.variantId))
    .sort((a, b) => b.capital - a.capital)
    .slice(0, 5);

  // Más vendidos / más rentables del mes (agregado en JS a partir de las
  // ventas ya acotadas a la empresa — un groupBy directo sobre SaleItem no
  // se puede acotar por companyId porque el modelo no lo tiene propio).
  const productAgg = new Map<string, { quantity: number; profit: number; revenue: number }>();
  for (const sale of monthSales) {
    for (const item of sale.items) {
      const entry = productAgg.get(item.productVariantId) ?? { quantity: 0, profit: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.profit += Number(item.profit);
      entry.revenue += Number(item.subtotal);
      productAgg.set(item.productVariantId, entry);
    }
  }

  const variantIds = [...productAgg.keys()];
  const variants = variantIds.length
    ? await db.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: true },
      })
    : [];
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const topProducts = [...productAgg.entries()]
    .map(([variantId, agg]) => {
      const variant = variantById.get(variantId);
      return {
        variantId,
        label: variant ? variantLabel(variant.product, variant) : "(producto eliminado)",
        quantity: agg.quantity,
        profit: agg.profit,
        revenue: agg.revenue,
      };
    })
    .filter((p) => p.quantity > 0);

  const topByQuantity = [...topProducts].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const topByProfit = [...topProducts].sort((a, b) => b.profit - a.profit).slice(0, 5);

  // Tendencia de ventas: un balde por día para los últimos TREND_DAYS días.
  const trendMap = new Map<string, number>();
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    trendMap.set(dayKey(d), 0);
  }
  for (const s of trendSales) {
    const key = dayKey(s.saleDate);
    trendMap.set(key, (trendMap.get(key) ?? 0) + Number(s.total));
  }
  const salesTrend = [...trendMap.entries()].map(([date, total]) => ({ date, total }));

  return {
    today: {
      total: Number(salesToday._sum.total ?? 0),
      profit: Number(salesToday._sum.totalProfit ?? 0),
      count: salesToday._count,
    },
    month: {
      total: Number(salesMonth._sum.total ?? 0),
      profit: Number(salesMonth._sum.totalProfit ?? 0),
      count: salesMonth._count,
      expenses: Number(expensesMonth._sum.amount ?? 0),
    },
    myMoney: totalMoney,
    myInventory: totalInventoryValue,
    controlledCapital,
    receivablePending: totalReceivable,
    payablePending: totalPayable,
    slowMoving,
    topByQuantity,
    topByProfit,
    salesTrend,
  };
}

export type DashboardSummary = Awaited<ReturnType<typeof getDashboardSummary>>;
