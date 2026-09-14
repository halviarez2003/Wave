import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const company = await prisma.company.findFirst({
    include: { baseCurrency: true },
    orderBy: { createdAt: "asc" },
  });

  const [roles, users, categories, accounts, permissions] = company
    ? await Promise.all([
        prisma.role.count({ where: { companyId: company.id } }),
        prisma.user.count({ where: { companyId: company.id } }),
        prisma.category.count({ where: { companyId: company.id } }),
        prisma.account.findMany({ where: { companyId: company.id } }),
        prisma.permission.count(),
      ])
    : [0, 0, 0, [], 0];

  const totalBalance = Array.isArray(accounts)
    ? accounts.reduce((sum, a) => sum + Number(a.balance), 0)
    : 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          Fase 4 · Proyecto creado
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Wave</h1>
        <p className="text-muted-foreground max-w-[60ch] text-sm">
          Next.js, Prisma y PostgreSQL están conectados y la base de datos ya
          tiene una empresa de ejemplo sembrada. El login y el dashboard real
          llegan en las próximas fases (Auth, Productos, Ventas...).
        </p>
      </div>

      {company ? (
        <Card>
          <CardHeader>
            <CardTitle>{company.name}</CardTitle>
            <CardDescription>
              Moneda base: {company.baseCurrency?.code ?? "—"} · Empresa #{company.id}
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
                {Array.isArray(accounts) &&
                  accounts.map((account) => (
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No hay ninguna empresa sembrada todavía</CardTitle>
            <CardDescription>Corre `npm run db:seed` para crear los datos de ejemplo.</CardDescription>
          </CardHeader>
        </Card>
      )}
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
