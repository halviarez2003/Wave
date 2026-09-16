import Link from "next/link";

import { hasPermission, requireSession } from "@/lib/dal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const session = await requireSession();
  const canManageUsers = hasPermission(session, "users.manage");
  const canManageSettings = hasPermission(session, "settings.manage");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm">Usuarios, roles y permisos de la empresa.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {canManageUsers && (
          <Link href="/configuracion/usuarios">
            <Card className="hover:bg-accent/50 transition-colors">
              <CardHeader>
                <CardTitle>Usuarios</CardTitle>
                <CardDescription>Crear cuentas, asignar rol, activar/desactivar, restablecer contraseña.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
        {canManageSettings && (
          <Link href="/configuracion/roles">
            <Card className="hover:bg-accent/50 transition-colors">
              <CardHeader>
                <CardTitle>Roles y permisos</CardTitle>
                <CardDescription>Crear roles y decidir qué puede hacer cada uno.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
      </div>

      {!canManageUsers && !canManageSettings && (
        <CardContent className="text-muted-foreground p-0 text-sm">
          Tu rol no tiene acceso a ninguna sección de configuración.
        </CardContent>
      )}
    </main>
  );
}
