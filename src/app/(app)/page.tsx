import Link from "next/link";

import { hasPermission, requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as dashboardService from "@/server/modules/dashboard/service";

import { SalesTrendChart } from "./sales-trend-chart";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  { href: "/ventas/nueva", label: "Nueva venta" },
  { href: "/compras/nueva", label: "Nueva compra" },
  { href: "/gastos", label: "Registrar gasto" },
  { href: "/inventario/ajustes", label: "Ajustar inventario" },
];

export default async function Home() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const canViewCosts = hasPermission(session, "costs.view");

  const data = await dashboardService.getDashboardSummary(db);
  const netProfitMonth = data.month.profit - data.month.expenses;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Hola, {(session.user.name ?? session.user.email ?? "").split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.href} href={a.href}>
              <Button size="sm" variant="outline">
                {a.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      <section>
        <SectionTitle>Hoy</SectionTitle>
        <div className={`grid gap-4 ${canViewCosts ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <Stat label="Ventas de hoy" value={`$${data.today.total.toFixed(2)}`} />
          {canViewCosts && <Stat label="Utilidad de hoy" value={`$${data.today.profit.toFixed(2)}`} />}
          <Stat label="Transacciones" value={String(data.today.count)} />
        </div>
      </section>

      <section>
        <SectionTitle>Este mes</SectionTitle>
        <div className={`grid gap-4 ${canViewCosts ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <Stat label="Ventas del mes" value={`$${data.month.total.toFixed(2)}`} sub={`${data.month.count} ventas`} />
          {canViewCosts && (
            <Stat
              label="Utilidad neta del mes"
              value={`$${netProfitMonth.toFixed(2)}`}
              tone={netProfitMonth < 0 ? "bad" : undefined}
              sub={`utilidad bruta $${data.month.profit.toFixed(2)} − gastos $${data.month.expenses.toFixed(2)}`}
            />
          )}
          <Stat label="Gastos del mes" value={`$${data.month.expenses.toFixed(2)}`} />
        </div>
      </section>

      <section>
        <SectionTitle>Tu negocio en números</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Mi Dinero" value={`$${data.myMoney.toFixed(2)}`} href="/cuentas" />
          <Stat label="Mi Inventario" value={`$${data.myInventory.toFixed(2)}`} href="/inventario/productos" />
          <Stat label="Capital controlado" value={`$${data.controlledCapital.toFixed(2)}`} />
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Capital controlado = Mi Dinero + Mi Inventario + Cuentas por cobrar (${data.receivablePending.toFixed(2)})
          − Cuentas por pagar (${data.payablePending.toFixed(2)}).
        </p>
      </section>

      <section>
        <SectionTitle>Ventas — últimos 14 días</SectionTitle>
        <Card>
          <CardContent className="pt-6">
            <SalesTrendChart data={data.salesTrend} />
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Más vendidos este mes</SectionTitle>
          <RankingCard
            rows={data.topByQuantity.map((p) => ({
              key: p.variantId,
              label: p.label,
              value: `${p.quantity} und.`,
            }))}
            emptyText="Sin ventas este mes todavía."
          />
        </section>

        {canViewCosts && (
          <section>
            <SectionTitle>Más rentables este mes</SectionTitle>
            <RankingCard
              rows={data.topByProfit.map((p) => ({
                key: p.variantId,
                label: p.label,
                value: `$${p.profit.toFixed(2)}`,
              }))}
              emptyText="Sin ventas este mes todavía."
            />
          </section>
        )}
      </div>

      <section>
        <SectionTitle>Inventario sin movimiento (60+ días)</SectionTitle>
        <RankingCard
          rows={data.slowMoving.map((p) => ({
            key: p.variantId,
            label: p.label,
            value: `${p.units} und. · $${p.capital.toFixed(2)}`,
            sub: p.categoryName,
          }))}
          emptyText="Todo tu inventario tuvo ventas recientes. Buen movimiento."
          href={(key) => `/inventario/kardex/${key}`}
        />
      </section>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">{children}</h2>;
}

function Stat({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "bad";
  href?: string;
}) {
  const content = (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs uppercase tracking-wide">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold tabular-nums ${tone === "bad" ? "text-destructive" : ""}`}>
          {value}
        </p>
        {sub && <p className="text-muted-foreground mt-1 text-xs">{sub}</p>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
}

function RankingCard({
  rows,
  emptyText,
  href,
}: {
  rows: { key: string; label: string; value: string; sub?: string }[];
  emptyText: string;
  href?: (key: string) => string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">{emptyText}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => {
              const inner = (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{r.label}</span>
                    {r.sub && <Badge variant="outline">{r.sub}</Badge>}
                  </div>
                  <span className="tabular-nums whitespace-nowrap">{r.value}</span>
                </div>
              );
              return (
                <li key={r.key}>
                  {href ? (
                    <Link href={href(r.key)} className="hover:underline">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
