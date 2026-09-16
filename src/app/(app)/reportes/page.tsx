import Link from "next/link";

import { hasPermission, requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as reportsService from "@/server/modules/reports/service";

export const dynamic = "force-dynamic";

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultFrom() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function parseRange(searchParams: { from?: string; to?: string }) {
  const from = searchParams.from ? new Date(`${searchParams.from}T00:00:00`) : defaultFrom();
  const to = searchParams.to ? new Date(`${searchParams.to}T23:59:59.999`) : new Date();
  return { from, to };
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const session = await requirePermission("reports.view");
  const db = getScopedPrisma(session.user.companyId);
  const canViewCosts = hasPermission(session, "costs.view");

  const range = parseRange(params);

  const [salesReport, purchasesReport, profitability, expensesReport, valuation] = await Promise.all([
    reportsService.getSalesReport(db, range),
    reportsService.getPurchasesReport(db, range),
    reportsService.getProfitabilityReport(db, range),
    reportsService.getExpensesReport(db, range),
    reportsService.getInventoryValuationReport(db),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground text-sm">
          Ventas, compras, rentabilidad y gastos en el rango seleccionado.
        </p>
      </div>

      <form className="border-border flex flex-wrap items-end gap-4 rounded-lg border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from">Desde</Label>
          <Input id="from" name="from" type="date" defaultValue={toDateInputValue(range.from)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to">Hasta</Label>
          <Input id="to" name="to" type="date" defaultValue={toDateInputValue(range.to)} />
        </div>
        <Button type="submit" size="sm">
          Aplicar
        </Button>
      </form>

      <section>
        <SectionTitle>Ventas</SectionTitle>
        <div className={`grid gap-4 ${canViewCosts ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <Stat label="Total vendido" value={`$${salesReport.total.toFixed(2)}`} />
          {canViewCosts && <Stat label="Utilidad" value={`$${salesReport.totalProfit.toFixed(2)}`} />}
          <Stat label="Ventas" value={String(salesReport.count)} />
          <Stat label="Ticket promedio" value={`$${salesReport.averageTicket.toFixed(2)}`} />
        </div>
        {salesReport.bySeller.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Ventas por vendedor</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Ventas</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesReport.bySeller.map((s) => (
                    <TableRow key={s.userId}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="tabular-nums">{s.count}</TableCell>
                      <TableCell className="tabular-nums">${s.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Compras</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label="Total comprado" value={`$${purchasesReport.total.toFixed(2)}`} />
          <Stat label="Compras" value={String(purchasesReport.count)} />
        </div>
        {purchasesReport.bySupplier.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Compras por proveedor</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Compras</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchasesReport.bySupplier.map((s) => (
                    <TableRow key={s.supplierId}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="tabular-nums">{s.count}</TableCell>
                      <TableCell className="tabular-nums">${s.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      {canViewCosts && (
        <section>
          <SectionTitle>Rentabilidad por producto</SectionTitle>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Ingreso</TableHead>
                    <TableHead>Utilidad</TableHead>
                    <TableHead>Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profitability.rows.map((r) => (
                    <TableRow key={r.variantId}>
                      <TableCell className="font-medium">
                        <Link href={`/inventario/kardex/${r.variantId}`} className="hover:underline">
                          {r.label}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{r.quantity}</TableCell>
                      <TableCell className="tabular-nums">${r.revenue.toFixed(2)}</TableCell>
                      <TableCell className="tabular-nums">${r.profit.toFixed(2)}</TableCell>
                      <TableCell className="tabular-nums">{r.margin.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                  {profitability.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center py-8">
                        Sin ventas en este rango.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Gastos por categoría</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-1">
          <Stat label="Total gastado" value={`$${expensesReport.total.toFixed(2)}`} />
        </div>
        {expensesReport.byCategory.length > 0 && (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesReport.byCategory.map((c) => (
                    <TableRow key={c.categoryId}>
                      <TableCell>
                        <Badge variant="outline">{c.name}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">${c.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Valorización de inventario (hoy)</SectionTitle>
        <div className={`grid gap-4 ${canViewCosts ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
          <Stat label="Valor a costo" value={`$${valuation.totalCostValue.toFixed(2)}`} />
          {canViewCosts && (
            <Stat label="Valor a precio de venta" value={`$${valuation.totalSaleValue.toFixed(2)}`} />
          )}
        </div>
        <Card className="mt-4">
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Unidades</TableHead>
                  <TableHead>Valor a costo</TableHead>
                  {canViewCosts && <TableHead>Valor a venta</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {valuation.byCategory.map((c) => (
                  <TableRow key={c.categoryId}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="tabular-nums">{c.units}</TableCell>
                    <TableCell className="tabular-nums">${c.costValue.toFixed(2)}</TableCell>
                    {canViewCosts && <TableCell className="tabular-nums">${c.saleValue.toFixed(2)}</TableCell>}
                  </TableRow>
                ))}
                {valuation.byCategory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canViewCosts ? 4 : 3} className="text-muted-foreground text-center py-8">
                      Sin inventario en existencia.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">{children}</h2>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs uppercase tracking-wide">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
