import { getScopedPrisma } from "@/lib/prisma";
import { requireSession } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);

  const [roles, users, categories, accounts, permissions] = await Promise.all([
    db.role.count(),
    db.user.count(),
    db.category.count(),
    db.account.findMany(),
    db.permission.count(),
  ]);

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          Fase 5 · Autenticación
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Wave</h1>
        <p className="text-muted-foreground max-w-[60ch] text-sm">
          Sesión autenticada con Auth.js — esta página y todas las de{" "}
          <code>(app)</code> están protegidas por <code>proxy.ts</code> y usan{" "}
          <code>getScopedPrisma(companyId)</code> para leer solo los datos de
          tu empresa. El dashboard real llega en la Fase 13.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{session.user.companyName}</CardTitle>
          <CardDescription>
            {session.user.name} · {session.user.roleName} · {session.user.permissions.length}{" "}
            permisos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Roles" value={roles} />
            <Stat label="Usuarios" value={users} />
            <Stat label="Categorías" value={categories} />
            <Stat label="Permisos" value={permissions} />
          </dl>
          <div className="border-border mt-6 border-t pt-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Cuentas de dinero (saldo inicial sembrado)
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {accounts.map((account) => (
                <li key={account.id} className="flex justify-between tabular-nums">
                  <span>{account.name}</span>
                  <span>${Number(account.balance).toFixed(2)}</span>
                </li>
              ))}
              <li className="mt-1 flex justify-between border-t pt-1 font-medium tabular-nums">
                <span>Total disponible</span>
                <span>${totalBalance.toFixed(2)}</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
