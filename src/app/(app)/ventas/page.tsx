import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as salesService from "@/server/modules/sales/service";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const sales = await salesService.listSales(db);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ventas</h1>
          <p className="text-muted-foreground text-sm">{sales.length} ventas registradas.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/ventas/nueva">Nueva venta</Link>
        </Button>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link href={`/ventas/${s.id}`} className="font-medium hover:underline">
                    #{s.number}
                  </Link>
                </TableCell>
                <TableCell>{s.customer?.name ?? "Sin cliente"}</TableCell>
                <TableCell>{s.warehouse.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {s.saleDate.toLocaleDateString("es")}
                </TableCell>
                <TableCell className="tabular-nums">${Number(s.total).toFixed(2)}</TableCell>
                <TableCell className="tabular-nums">
                  {Number(s.balanceDue) > 0 ? (
                    <Badge variant="warning">${Number(s.balanceDue).toFixed(2)}</Badge>
                  ) : (
                    <Badge variant="success">Pagada</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                  Todavía no hay ventas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
