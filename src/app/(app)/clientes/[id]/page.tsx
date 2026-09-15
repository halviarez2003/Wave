import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as customersService from "@/server/modules/customers/service";

export const dynamic = "force-dynamic";

const RECEIVABLE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const customer = await customersService.getCustomer(db, id);

  if (!customer) notFound();

  const totalDebt = customer.receivables
    .filter((r) => r.status !== "PAID")
    .reduce((sum, r) => sum + Number(r.balance), 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/clientes" className="text-muted-foreground text-sm hover:underline">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{customer.name}</h1>
        <p className="text-muted-foreground text-sm">
          {customer.phone ?? "Sin teléfono"} · {customer.email ?? "Sin email"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Ventas</p>
          <p className="text-xl font-semibold tabular-nums">{customer.sales.length}</p>
        </div>
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Saldo pendiente</p>
          <p className="text-xl font-semibold tabular-nums">${totalDebt.toFixed(2)}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Historial de ventas</p>
        <div className="border-border overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pagado</TableHead>
                <TableHead>Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/ventas/${s.id}`} className="hover:underline">
                      #{s.number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {s.saleDate.toLocaleDateString("es")}
                  </TableCell>
                  <TableCell className="tabular-nums">${Number(s.total).toFixed(2)}</TableCell>
                  <TableCell className="tabular-nums">${Number(s.paidTotal).toFixed(2)}</TableCell>
                  <TableCell className="tabular-nums">
                    {Number(s.balanceDue) > 0 ? (
                      <Badge variant="warning">${Number(s.balanceDue).toFixed(2)}</Badge>
                    ) : (
                      <Badge variant="success">Pagada</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {customer.sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center py-6">
                    Sin ventas todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {customer.receivables.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Cuentas por cobrar</p>
          <div className="border-border overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.receivables.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {r.issueDate.toLocaleDateString("es")}
                    </TableCell>
                    <TableCell className="tabular-nums">${Number(r.totalAmount).toFixed(2)}</TableCell>
                    <TableCell className="tabular-nums">${Number(r.balance).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "PAID" ? "success" : "warning"}>
                        {RECEIVABLE_STATUS_LABELS[r.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </main>
  );
}
