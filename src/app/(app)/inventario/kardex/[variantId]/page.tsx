import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as inventoryService from "@/server/modules/inventory/service";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Compra",
  SALE: "Venta",
  SALE_RETURN: "Devolución de venta",
  PURCHASE_RETURN: "Devolución de compra",
  ADJUSTMENT_POSITIVE: "Ajuste +",
  ADJUSTMENT_NEGATIVE: "Ajuste -",
  TRANSFER_IN: "Transferencia (entrada)",
  TRANSFER_OUT: "Transferencia (salida)",
  MANUAL_IN: "Entrada manual",
  MANUAL_OUT: "Salida manual",
  DAMAGE: "Daño",
  LOSS: "Pérdida",
  INTERNAL_USE: "Consumo interno",
  VOID_SALE: "Anulación de venta",
  VOID_PURCHASE: "Anulación de compra",
};

export default async function KardexDetailPage({
  params,
}: {
  params: Promise<{ variantId: string }>;
}) {
  const { variantId } = await params;
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);

  const variant = await inventoryService.getVariantDetail(db, variantId);
  if (!variant) notFound();

  const movements = (await inventoryService.getVariantKardex(db, variantId)).reverse();

  const label = variant.label === "Único" ? variant.product.name : `${variant.product.name} — ${variant.label}`;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/inventario/kardex" className="text-muted-foreground text-sm hover:underline">
          ← Kardex
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{label}</h1>
        <p className="text-muted-foreground text-sm">
          {variant.product.category.name} ·{" "}
          <Link href={`/inventario/ajustes/${variant.id}`} className="underline">
            Ajustar / transferir
          </Link>
        </p>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Stock antes → después</TableHead>
              <TableHead>Costo unit.</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {m.createdAt.toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{TYPE_LABELS[m.type]}</Badge>
                </TableCell>
                <TableCell>{m.warehouse.name}</TableCell>
                <TableCell className="tabular-nums">{m.quantity}</TableCell>
                <TableCell className="tabular-nums">
                  {m.stockBefore} → {m.stockAfter}
                </TableCell>
                <TableCell className="tabular-nums">${Number(m.unitCost).toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{m.reason ?? "—"}</TableCell>
              </TableRow>
            ))}
            {movements.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground text-center py-8">
                  Todavía no hay movimientos para este producto.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
