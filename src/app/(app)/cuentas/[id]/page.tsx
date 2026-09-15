import Link from "next/link";
import { notFound } from "next/navigation";

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

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);

  const [account, transactions] = await Promise.all([
    financeService.getAccount(db, id),
    financeService.listTransactions(db, id),
  ]);

  if (!account) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/cuentas" className="text-muted-foreground text-sm hover:underline">
          ← Cuentas
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{account.name}</h1>
        <p className="text-muted-foreground text-sm">
          Saldo actual:{" "}
          <span className="text-foreground font-medium tabular-nums">
            ${Number(account.balance).toFixed(2)} {account.currency.code}
          </span>
        </p>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Saldo después</TableHead>
              <TableHead>Descripción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => {
              const amount = Number(t.amount);
              return (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {t.transactionDate.toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={amount >= 0 ? "success" : "secondary"}>{TYPE_LABELS[t.type]}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {amount >= 0 ? "+" : ""}
                    {amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="tabular-nums">${Number(t.balanceAfter).toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{t.description ?? "—"}</TableCell>
                </TableRow>
              );
            })}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center py-8">
                  Sin movimientos todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
