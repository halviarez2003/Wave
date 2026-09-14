import Link from "next/link";
import { notFound } from "next/navigation";

import { hasPermission, requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as salesService from "@/server/modules/sales/service";

import { PayReceivableForm } from "./pay-receivable-form";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);

  const [sale, accountRows] = await Promise.all([
    salesService.getSale(db, id),
    db.account.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!sale) notFound();

  const accounts = accountRows.map((a) => ({ id: a.id, name: a.name }));
  const canViewCosts = hasPermission(session, "costs.view");
  const canCollect = hasPermission(session, "sales.collect");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/ventas" className="text-muted-foreground text-sm hover:underline">
          ← Ventas
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Venta #{sale.number}</h1>
        <p className="text-muted-foreground text-sm">
          {sale.customer ? (
            <Link href={`/clientes/${sale.customer.id}`} className="underline">
              {sale.customer.name}
            </Link>
          ) : (
            "Sin cliente"
          )}{" "}
          · {sale.warehouse.name} · {sale.saleDate.toLocaleDateString("es")} · {sale.user.name}
        </p>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Precio</TableHead>
              {canViewCosts && <TableHead>Costo</TableHead>}
              {canViewCosts && <TableHead>Utilidad</TableHead>}
              <TableHead>Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <Link href={`/inventario/kardex/${item.productVariantId}`} className="hover:underline">
                    {item.variant.label === "Único"
                      ? item.variant.product.name
                      : `${item.variant.product.name} — ${item.variant.label}`}
                  </Link>
                  {item.inventoryUnit?.imei1 && (
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      {item.inventoryUnit.imei1}
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{item.quantity}</TableCell>
                <TableCell className="tabular-nums">${Number(item.unitPrice).toFixed(2)}</TableCell>
                {canViewCosts && (
                  <TableCell className="tabular-nums">${Number(item.unitCost).toFixed(2)}</TableCell>
                )}
                {canViewCosts && (
                  <TableCell className="tabular-nums">${Number(item.profit).toFixed(2)}</TableCell>
                )}
                <TableCell className="tabular-nums">${Number(item.subtotal).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className={`grid gap-4 ${canViewCosts ? "grid-cols-3" : "grid-cols-2"}`}>
        <Stat label="Total" value={`$${Number(sale.total).toFixed(2)}`} />
        <Stat label="Saldo" value={`$${Number(sale.balanceDue).toFixed(2)}`} />
        {canViewCosts && <Stat label="Utilidad" value={`$${Number(sale.totalProfit).toFixed(2)}`} />}
      </div>

      {sale.payments.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Pagos</p>
          <div className="border-border overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.paymentDate.toLocaleDateString("es")}
                    </TableCell>
                    <TableCell>{p.account.name}</TableCell>
                    <TableCell className="tabular-nums">${Number(p.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {sale.receivable?.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.paymentDate.toLocaleDateString("es")}
                    </TableCell>
                    <TableCell>{p.account.name}</TableCell>
                    <TableCell className="tabular-nums">${Number(p.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {sale.receivable && sale.receivable.status !== "PAID" && (
        canCollect ? (
          <PayReceivableForm
            saleId={sale.id}
            receivableId={sale.receivable.id}
            balance={Number(sale.receivable.balance)}
            accounts={accounts}
          />
        ) : (
          <Badge variant="warning" className="w-fit">
            Saldo pendiente de cobro: ${Number(sale.receivable.balance).toFixed(2)}
          </Badge>
        )
      )}
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
