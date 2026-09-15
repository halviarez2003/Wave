import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as suppliersService from "@/server/modules/suppliers/service";

import { NewSupplierDialog } from "./new-supplier-dialog";

export const dynamic = "force-dynamic";

export default async function ProveedoresPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const suppliers = await suppliersService.listSuppliers(db);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Proveedores</h1>
          <p className="text-muted-foreground text-sm">{suppliers.length} proveedores registrados.</p>
        </div>
        <NewSupplierDialog />
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Compras</TableHead>
              <TableHead>Deuda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <Link href={`/proveedores/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell>{s.phone ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{s.purchaseCount}</TableCell>
                <TableCell className="tabular-nums">
                  {s.balanceDue > 0 ? (
                    <Badge variant="warning">${s.balanceDue.toFixed(2)}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
            {suppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center py-8">
                  Todavía no hay proveedores.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
