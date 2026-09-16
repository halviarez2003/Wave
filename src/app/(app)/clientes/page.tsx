import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as customersService from "@/server/modules/customers/service";

import { NewCustomerDialog } from "./new-customer-dialog";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const customers = await customersService.listCustomers(db);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm">{customers.length} clientes registrados.</p>
        </div>
        <NewCustomerDialog />
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Ventas</TableHead>
              <TableHead>Debe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link href={`/clientes/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{c.saleCount}</TableCell>
                <TableCell className="tabular-nums">
                  {c.balanceDue > 0 ? <Badge variant="warning">${c.balanceDue.toFixed(2)}</Badge> : "—"}
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center py-8">
                  Todavía no hay clientes.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
