import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as financeService from "@/server/modules/finance/service";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  SALE_INCOME: "Venta",
  RECEIVABLE_PAYMENT: "Cobro",
  PURCHASE_PAYMENT: "Pago de compra",
  PAYABLE_PAYMENT: "Pago a proveedor",
  EXPENSE: "Gasto",
  TRANSFER_IN: "Transferencia (entrada)",
  TRANSFER_OUT: "Transferencia (salida)",
  CAPITAL_CONTRIBUTION: "Aporte de capital",
  WITHDRAWAL: "Retiro",
  ADJUSTMENT: "Ajuste",
  OTHER_INCOME: "Otro ingreso",
  OTHER_EXPENSE: "Otra salida",
};

function relatedHref(type: string | null, id: string | null) {
  if (!type || !id) return null;
  if (type === "SALE") return `/ventas/${id}`;
  if (type === "PURCHASE") return `/compras/${id}`;
  return null;
}

export default async function MovimientosFinancierosPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const transactions = await financeService.listTransactions(db);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/cuentas" className="text-muted-foreground text-sm hover:underline">
          ← Cuentas
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Movimientos financieros</h1>
        <p className="text-muted-foreground text-sm">Últimos 200 movimientos de todas las cuentas.</p>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Descripción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => {
              const href = relatedHref(t.relatedDocumentType, t.relatedDocumentId);
              const amount = Number(t.amount);
              return (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {t.transactionDate.toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>{t.account.name}</TableCell>
                  <TableCell>
                    <Badge variant={amount >= 0 ? "success" : "secondary"}>{TYPE_LABELS[t.type]}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {amount >= 0 ? "+" : ""}
                    {amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums text-xs">
                    ${Number(t.balanceAfter).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{t.user?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-64 truncate text-xs">
                    {href ? (
                      <Link href={href} className="underline">
                        {t.description}
                      </Link>
                    ) : (
                      (t.description ?? "—")
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground text-center py-8">
                  Todavía no hay movimientos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
