import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

const POSITIVE_TYPES = new Set(["PURCHASE", "SALE_RETURN", "ADJUSTMENT_POSITIVE", "TRANSFER_IN", "MANUAL_IN"]);

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const movements = await inventoryService.listMovements(db, q);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Movimientos</h1>
          <p className="text-muted-foreground text-sm">
            Historial completo de entradas y salidas de inventario (últimos 200).
          </p>
        </div>
        <form className="w-64">
          <Input name="q" defaultValue={q} placeholder="Buscar producto..." />
        </form>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Costo unit.</TableHead>
              <TableHead>Almacén</TableHead>
              <TableHead>Usuario</TableHead>
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
                  <Link
                    href={`/inventario/kardex/${m.productVariantId}`}
                    className="font-medium hover:underline"
                  >
                    {m.variant.label === "Único" ? m.variant.product.name : `${m.variant.product.name} — ${m.variant.label}`}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={POSITIVE_TYPES.has(m.type) ? "success" : "secondary"}>
                    {TYPE_LABELS[m.type]}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {POSITIVE_TYPES.has(m.type) ? "+" : "-"}
                  {m.quantity}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums text-xs">
                  {m.stockBefore} → {m.stockAfter}
                </TableCell>
                <TableCell className="tabular-nums">${Number(m.unitCost).toFixed(2)}</TableCell>
                <TableCell>{m.warehouse.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{m.user?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground max-w-48 truncate text-xs">
                  {m.reason ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {movements.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground text-center py-8">
                  No hay movimientos todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
