import Link from "next/link";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as usersService from "@/server/modules/users/service";

import { EditUserDialog } from "./edit-user-dialog";
import { NewUserDialog } from "./new-user-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await requirePermission("users.manage");
  const db = getScopedPrisma(session.user.companyId);

  const [users, roleRows] = await Promise.all([usersService.listUsers(db), db.role.findMany({ orderBy: { name: "asc" } })]);
  const roles = roleRows.map((r) => ({ id: r.id, name: r.name }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/configuracion" className="text-muted-foreground text-sm hover:underline">
          ← Configuración
        </Link>
        <div className="mt-1 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Usuarios</h1>
          <NewUserDialog roles={roles} />
        </div>
        <p className="text-muted-foreground text-sm">
          Los cambios de rol o estado aplican en el próximo inicio de sesión del usuario afectado.
        </p>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{u.role.name}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? "success" : "secondary"}>
                    {u.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <ResetPasswordDialog userId={u.id} userName={u.name} />
                    <EditUserDialog
                      userId={u.id}
                      name={u.name}
                      roleId={u.roleId}
                      isActive={u.isActive}
                      roles={roles}
                      isSelf={u.id === session.user.id}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
