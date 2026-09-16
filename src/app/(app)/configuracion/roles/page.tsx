import Link from "next/link";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as rolesService from "@/server/modules/roles/service";

import { NewRoleDialog } from "./new-role-dialog";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const session = await requirePermission("settings.manage");
  const db = getScopedPrisma(session.user.companyId);

  const [roles, permissions] = await Promise.all([
    rolesService.listRolesWithPermissions(db),
    rolesService.listAllPermissions(db),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/configuracion" className="text-muted-foreground text-sm hover:underline">
          ← Configuración
        </Link>
        <div className="mt-1 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Roles y permisos</h1>
          <NewRoleDialog permissions={permissions} />
        </div>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rol</TableHead>
              <TableHead>Permisos</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.name}
                  {r.isSystem && (
                    <Badge variant="outline" className="ml-2">
                      Semilla
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{r.permissions.length}</TableCell>
                <TableCell className="tabular-nums">{r._count.users}</TableCell>
                <TableCell>
                  <Link href={`/configuracion/roles/${r.id}`} className="text-sm underline">
                    Editar permisos
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
