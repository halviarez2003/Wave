import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as expensesService from "@/server/modules/expenses/service";
import * as financeService from "@/server/modules/finance/service";
import * as suppliersService from "@/server/modules/suppliers/service";

import { NewExpenseCategoryDialog } from "./new-expense-category-dialog";
import { NewExpenseDialog } from "./new-expense-dialog";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  FIXED: "Fijo",
  VARIABLE: "Variable",
};

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const { categoryId } = await searchParams;
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);

  const [expenses, categories, accountRows, supplierRows] = await Promise.all([
    expensesService.listExpenses(db, { categoryId }),
    expensesService.listExpenseCategories(db),
    financeService.listAccounts(db),
    suppliersService.listSuppliers(db),
  ]);

  const now = new Date();
  const monthTotal = expenses
    .filter((e) => e.expenseDate.getMonth() === now.getMonth() && e.expenseDate.getFullYear() === now.getFullYear())
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const fixedTotal = expenses.reduce((sum, e) => sum + (e.type === "FIXED" ? Number(e.amount) : 0), 0);
  const variableTotal = expenses.reduce((sum, e) => sum + (e.type === "VARIABLE" ? Number(e.amount) : 0), 0);

  const accounts = accountRows.map((a) => ({ id: a.id, name: a.name }));
  const suppliers = supplierRows.map((s) => ({ id: s.id, name: s.name }));
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Gastos</h1>
          <p className="text-muted-foreground text-sm">Gastos fijos y variables del negocio.</p>
        </div>
        <div className="flex gap-2">
          <NewExpenseCategoryDialog />
          <NewExpenseDialog categories={categoryOptions} accounts={accounts} suppliers={suppliers} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Este mes" value={`$${monthTotal.toFixed(2)}`} />
        <Stat label="Fijos (mostrados)" value={`$${fixedTotal.toFixed(2)}`} />
        <Stat label="Variables (mostrados)" value={`$${variableTotal.toFixed(2)}`} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/gastos">
          <Badge variant={!categoryId ? "default" : "outline"}>Todas</Badge>
        </Link>
        {categories.map((c) => (
          <Link key={c.id} href={`/gastos?categoryId=${c.id}`}>
            <Badge variant={categoryId === c.id ? "default" : "outline"}>{c.name}</Badge>
          </Link>
        ))}
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {e.expenseDate.toLocaleDateString("es")}
                </TableCell>
                <TableCell className="font-medium">{e.description}</TableCell>
                <TableCell>
                  <Badge variant="outline">{e.category.name}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{TYPE_LABELS[e.type]}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{e.account.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{e.supplier?.name ?? "—"}</TableCell>
                <TableCell className="tabular-nums">${Number(e.amount).toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground text-center py-8">
                  No hay gastos registrados en este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
