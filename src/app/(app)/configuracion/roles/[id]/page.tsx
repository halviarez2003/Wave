import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import * as rolesService from "@/server/modules/roles/service";

import { EditPermissionsForm } from "./edit-permissions-form";

export const dynamic = "force-dynamic";

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePermission("settings.manage");
  const db = getScopedPrisma(session.user.companyId);

  const [role, permissions] = await Promise.all([
    rolesService.getRoleWithPermissions(db, id),
    rolesService.listAllPermissions(db),
  ]);

  if (!role) notFound();

  const initialCodes = role.permissions.map((rp) => rp.permission.code);
  const permissionOptions = permissions.map((p) => ({ code: p.code, description: p.description }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/configuracion/roles" className="text-muted-foreground text-sm hover:underline">
          ← Roles
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Permisos de {role.name}</h1>
        <p className="text-muted-foreground text-sm">
          Los cambios aplican en el próximo inicio de sesión de cada usuario con este rol.
        </p>
      </div>

      <EditPermissionsForm roleId={role.id} permissions={permissionOptions} initialCodes={initialCodes} />
    </main>
  );
}
