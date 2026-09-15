import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as inventoryService from "@/server/modules/inventory/service";

import { NewWarehouseDialog } from "./new-warehouse-dialog";

export const dynamic = "force-dynamic";

export default async function AlmacenesPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const warehouses = await inventoryService.listWarehouses(db);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Almacenes</h1>
          <p className="text-muted-foreground text-sm">
            Crea más de uno para poder transferir inventario entre ubicaciones.
          </p>
        </div>
        <NewWarehouseDialog />
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Por defecto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium">{w.name}</TableCell>
                <TableCell>{w.address ?? "—"}</TableCell>
                <TableCell>{w.isDefault && <Badge variant="secondary">Por defecto</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
