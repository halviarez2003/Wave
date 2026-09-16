import Link from "next/link";
import { notFound } from "next/navigation";

import { hasPermission, requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as purchasesService from "@/server/modules/purchases/service";

import { PayPayableForm } from "./pay-payable-form";
import { VoidPurchaseForm } from "./void-purchase-form";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);

  const [purchase, accountRows] = await Promise.all([
    purchasesService.getPurchase(db, id),
    db.account.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!purchase) notFound();

  // Los Client Components no pueden recibir Decimal como prop; el
  // formulario de pago solo necesita id/nombre para el selector.
  const accounts = accountRows.map((a) => ({ id: a.id, name: a.name }));
  const canVoid = hasPermission(session, "purchases.void");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/compras" className="text-muted-foreground text-sm hover:underline">
          ← Compras
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Compra #{purchase.number}</h1>
          {purchase.status === "VOIDED" && <Badge variant="destructive">Anulada</Badge>}
        </div>
        {purchase.status === "VOIDED" && purchase.voidReason && (
          <p className="text-destructive text-sm">Motivo: {purchase.voidReason}</p>
        )}
        <p className="text-muted-foreground text-sm">
          <Link href={`/proveedores/${purchase.supplier.id}`} className="underline">
            {purchase.supplier.name}
          </Link>{" "}
          · {purchase.warehouse.name} · {purchase.purchaseDate.toLocaleDateString("es")} ·{" "}
          {purchase.user.name}
        </p>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Costo unit.</TableHead>
              <TableHead>Subtotal</TableHead>
              <TableHead>Recepción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchase.items.map((item) => {
              const isSerialized = item.variant.product.inventoryType === "SERIALIZED";
              const received = item.inventoryUnits.length;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <Link href={`/inventario/kardex/${item.variant.id}`} className="hover:underline">
                      {item.variant.label === "Único"
                        ? item.variant.product.name
                        : `${item.variant.product.name} — ${item.variant.label}`}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="tabular-nums">${Number(item.unitCost).toFixed(2)}</TableCell>
                  <TableCell className="tabular-nums">${Number(item.subtotal).toFixed(2)}</TableCell>
                  <TableCell>
                    {isSerialized ? (
                      received >= item.quantity ? (
                        <Badge variant="success">{received}/{item.quantity} recibidas</Badge>
                      ) : (
                        <Link
                          href={`/inventario/ajustes/${item.variant.id}?purchaseId=${purchase.id}&purchaseItemId=${item.id}&warehouseId=${purchase.warehouse.id}&defaultCost=${item.unitCost}`}
                          className="text-sm underline"
                        >
                          Recibir unidades ({received}/{item.quantity})
                        </Link>
                      )
                    ) : (
                      <Badge variant="success">Recibida</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total" value={`$${Number(purchase.total).toFixed(2)}`} />
        <Stat label="Pagado" value={`$${Number(purchase.paidTotal).toFixed(2)}`} />
        <Stat label="Saldo" value={`$${Number(purchase.balanceDue).toFixed(2)}`} />
      </div>

      {purchase.payments.length > 0 && (
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
                {purchase.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.paymentDate.toLocaleDateString("es")}
                    </TableCell>
                    <TableCell>{p.account.name}</TableCell>
                    <TableCell className="tabular-nums">${Number(p.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {purchase.payable?.payments.map((p) => (
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

      {purchase.payable && purchase.payable.status !== "PAID" && (
        <PayPayableForm
          purchaseId={purchase.id}
          payableId={purchase.payable.id}
          balance={Number(purchase.payable.balance)}
          accounts={accounts}
        />
      )}

      {purchase.status === "COMPLETED" && canVoid && (
        <div>
          <VoidPurchaseForm purchaseId={purchase.id} purchaseNumber={purchase.number} />
        </div>
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
