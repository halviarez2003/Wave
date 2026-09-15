import Link from "next/link";

import { hasPermission, requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as salesService from "@/server/modules/sales/service";
import * as financeService from "@/server/modules/finance/service";
import type { ReceivableStatusFilter } from "@/server/modules/sales/service";

import { CollectDialog } from "./collect-dialog";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  OVERDUE: "Vencida",
  PAID: "Pagada",
};

const STATUS_BADGE: Record<string, "outline" | "warning" | "destructive" | "success"> = {
  PENDING: "outline",
  PARTIAL: "warning",
  OVERDUE: "destructive",
  PAID: "success",
};

const FILTERS: { value: ReceivableStatusFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PARTIAL", label: "Parciales" },
  { value: "OVERDUE", label: "Vencidas" },
];

export default async function CuentasPorCobrarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = (FILTERS.some((f) => f.value === rawStatus) ? rawStatus : "ALL") as ReceivableStatusFilter;

  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const canCollect = hasPermission(session, "sales.collect");

  const [{ rows, totals }, accountRows] = await Promise.all([
    salesService.listReceivables(db, status),
    financeService.listAccounts(db),
  ]);
  const accounts = accountRows.map((a) => ({ id: a.id, name: a.name }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/cuentas" className="text-muted-foreground text-sm hover:underline">
          ← Cuentas
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Cuentas por cobrar</h1>
        <p className="text-muted-foreground text-sm">Saldos pendientes de clientes por ventas a crédito.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total pendiente" value={`$${totals.pending.toFixed(2)}`} />
        <Stat label="Total vencido" value={`$${totals.overdue.toFixed(2)}`} tone={totals.overdue > 0 ? "bad" : undefined} />
        <Stat label="Clientes con deuda" value={String(totals.customerCount)} />
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "ALL" ? "/cuentas/por-cobrar" : `/cuentas/por-cobrar?status=${f.value}`}
          >
            <Badge variant={status === f.value ? "default" : "outline"}>{f.label}</Badge>
          </Link>
        ))}
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Venta</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Estado</TableHead>
              {canCollect && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link href={`/clientes/${r.customer.id}`} className="hover:underline">
                    {r.customer.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/ventas/${r.saleId}`} className="text-muted-foreground text-sm underline">
                    #{r.saleNumber}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {r.dueDate ? r.dueDate.toLocaleDateString("es") : "—"}
                  {r.status === "OVERDUE" && (
                    <span className="text-destructive ml-1">({r.daysOverdue}d)</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">${r.balance.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                </TableCell>
                {canCollect && (
                  <TableCell>
                    <CollectDialog
                      saleId={r.saleId}
                      saleNumber={r.saleNumber}
                      receivableId={r.id}
                      balance={r.balance}
                      accounts={accounts}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={canCollect ? 6 : 5} className="text-muted-foreground text-center py-8">
                  No hay cuentas por cobrar en este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone === "bad" ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
