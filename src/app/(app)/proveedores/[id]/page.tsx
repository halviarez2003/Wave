import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as suppliersService from "@/server/modules/suppliers/service";

export const dynamic = "force-dynamic";

const PAYABLE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
};

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const supplier = await suppliersService.getSupplier(db, id);

  if (!supplier) notFound();

  const totalDebt = supplier.payables
    .filter((p) => p.status !== "PAID")
    .reduce((sum, p) => sum + Number(p.balance), 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/proveedores" className="text-muted-foreground text-sm hover:underline">
          ← Proveedores
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{supplier.name}</h1>
        <p className="text-muted-foreground text-sm">
          {supplier.phone ?? "Sin teléfono"} · {supplier.email ?? "Sin email"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Compras</p>
          <p className="text-xl font-semibold tabular-nums">{supplier.purchases.length}</p>
        </div>
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Deuda actual</p>
          <p className="text-xl font-semibold tabular-nums">${totalDebt.toFixed(2)}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Historial de compras</p>
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
              {supplier.purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/compras/${p.id}`} className="hover:underline">
                      #{p.number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {p.purchaseDate.toLocaleDateString("es")}
                  </TableCell>
                  <TableCell className="tabular-nums">${Number(p.total).toFixed(2)}</TableCell>
                  <TableCell className="tabular-nums">${Number(p.paidTotal).toFixed(2)}</TableCell>
                  <TableCell className="tabular-nums">
                    {Number(p.balanceDue) > 0 ? (
                      <Badge variant="warning">${Number(p.balanceDue).toFixed(2)}</Badge>
                    ) : (
                      <Badge variant="success">Pagada</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {supplier.purchases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center py-6">
                    Sin compras todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {supplier.payables.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Cuentas por pagar</p>
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
                {supplier.payables.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.issueDate.toLocaleDateString("es")}
                    </TableCell>
                    <TableCell className="tabular-nums">${Number(p.totalAmount).toFixed(2)}</TableCell>
                    <TableCell className="tabular-nums">${Number(p.balance).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "PAID" ? "success" : "warning"}>
                        {PAYABLE_STATUS_LABELS[p.status]}
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
