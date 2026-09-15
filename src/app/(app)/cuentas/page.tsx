import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as financeService from "@/server/modules/finance/service";

import { NewAccountDialog } from "./new-account-dialog";
import { TransferDialog } from "./transfer-dialog";

export const dynamic = "force-dynamic";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  BANK: "Banco",
  WALLET: "Billetera digital",
  POS: "Punto de venta",
  OTHER: "Otra",
};

export default async function CuentasPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const accounts = await financeService.listAccounts(db);
  const total = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cuentas</h1>
          <p className="text-muted-foreground text-sm">
            Total disponible:{" "}
            <span className="text-foreground font-medium tabular-nums">${total.toFixed(2)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <TransferDialog accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
          <NewAccountDialog />
        </div>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Moneda</TableHead>
              <TableHead>Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  <Link href={`/cuentas/${a.id}`} className="hover:underline">
                    {a.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{ACCOUNT_TYPE_LABELS[a.type]}</Badge>
                </TableCell>
                <TableCell>{a.currency.code}</TableCell>
                <TableCell className="tabular-nums">
                  {Number(a.balance) < 0 ? (
                    <span className="text-destructive">${Number(a.balance).toFixed(2)}</span>
                  ) : (
                    `$${Number(a.balance).toFixed(2)}`
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-4">
        <Link href="/cuentas/movimientos" className="text-sm underline">
          Ver todos los movimientos →
        </Link>
        <Link href="/cuentas/por-cobrar" className="text-sm underline">
          Cuentas por cobrar →
        </Link>
        <Link href="/cuentas/por-pagar" className="text-sm underline">
          Cuentas por pagar →
        </Link>
      </div>
    </main>
  );
}
