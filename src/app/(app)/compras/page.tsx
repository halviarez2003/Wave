import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as purchasesService from "@/server/modules/purchases/service";

export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const purchases = await purchasesService.listPurchases(db);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Compras</h1>
          <p className="text-muted-foreground text-sm">{purchases.length} compras registradas.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/compras/nueva">Nueva compra</Link>
        </Button>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/compras/${p.id}`} className="font-medium hover:underline">
                    #{p.number}
                  </Link>
                </TableCell>
                <TableCell>{p.supplier.name}</TableCell>
                <TableCell>{p.warehouse.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {p.purchaseDate.toLocaleDateString("es")}
                </TableCell>
                <TableCell className="tabular-nums">${Number(p.total).toFixed(2)}</TableCell>
                <TableCell className="tabular-nums">
                  {Number(p.balanceDue) > 0 ? (
                    <Badge variant="warning">${Number(p.balanceDue).toFixed(2)}</Badge>
                  ) : (
                    <Badge variant="success">Pagada</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {purchases.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                  Todavía no hay compras.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
