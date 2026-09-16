import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as inventoryService from "@/server/modules/inventory/service";

import { AddUnitsForm } from "./add-units-form";
import { QuantityAdjustForm } from "./quantity-adjust-form";
import { TransferForm } from "./transfer-form";
import { UnitStatusForm } from "./unit-status-form";

export const dynamic = "force-dynamic";

const UNIT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Disponible",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  RETURNED: "Devuelto",
  DAMAGED: "Dañado",
  IN_REPAIR: "En reparación",
  LAYAWAY: "Apartado",
};

export default async function AjustesDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ variantId: string }>;
  searchParams: Promise<{
    purchaseId?: string;
    purchaseItemId?: string;
    warehouseId?: string;
    defaultCost?: string;
  }>;
}) {
  const { variantId } = await params;
  const purchaseContext = await searchParams;
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);

  const [variant, warehouses] = await Promise.all([
    inventoryService.getVariantDetail(db, variantId),
    inventoryService.listWarehouses(db),
  ]);

  if (!variant) notFound();

  const label = variant.label === "Único" ? variant.product.name : `${variant.product.name} — ${variant.label}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={purchaseContext.purchaseId ? `/compras/${purchaseContext.purchaseId}` : "/inventario/ajustes"}
          className="text-muted-foreground text-sm hover:underline"
        >
          {purchaseContext.purchaseId ? "← Volver a la compra" : "← Ajustes"}
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{label}</h1>
        <p className="text-muted-foreground text-sm">
          {variant.product.category.name} ·{" "}
          <Link href={`/inventario/kardex/${variant.id}`} className="underline">
            Ver kardex
          </Link>
        </p>
        {purchaseContext.purchaseId && (
          <p className="text-muted-foreground mt-1 text-xs">
            Las unidades que agregues aquí quedarán enlazadas a esa compra.
          </p>
        )}
      </div>

      {variant.product.inventoryType === "QUANTITY" ? (
        <>
          <div className="border-border overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {warehouses.length > 1 && <TableHead>Almacén</TableHead>}
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Costo promedio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variant.inventoryBalances.map((b) => (
                  <TableRow key={b.id}>
                    {warehouses.length > 1 && <TableCell>{b.warehouse.name}</TableCell>}
                    <TableCell className="tabular-nums">{b.quantity}</TableCell>
                    <TableCell className="tabular-nums">${Number(b.averageCost).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {variant.inventoryBalances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={warehouses.length > 1 ? 3 : 2} className="text-muted-foreground text-center py-6">
                      Sin stock todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <QuantityAdjustForm variantId={variant.id} warehouses={warehouses} />
          {warehouses.length > 1 && <TransferForm variantId={variant.id} warehouses={warehouses} />}
        </>
      ) : (
        <>
          <div className="border-border overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Batería</TableHead>
                  <TableHead>Costo</TableHead>
                  {warehouses.length > 1 && <TableHead>Almacén</TableHead>}
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variant.inventoryUnits.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">{u.imei1 ?? u.serial ?? "—"}</TableCell>
                    <TableCell>{u.color ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {u.batteryPercent !== null ? `${u.batteryPercent}%` : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">${Number(u.cost).toFixed(2)}</TableCell>
                    {warehouses.length > 1 && <TableCell>{u.warehouse.name}</TableCell>}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={u.status === "AVAILABLE" ? "success" : "secondary"}>
                          {UNIT_STATUS_LABELS[u.status]}
                        </Badge>
                        <UnitStatusForm unitId={u.id} variantId={variant.id} currentStatus={u.status} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {variant.inventoryUnits.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={warehouses.length > 1 ? 6 : 5} className="text-muted-foreground text-center py-6">
                      Sin unidades todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <AddUnitsForm
            variantId={variant.id}
            warehouses={
              purchaseContext.warehouseId
                ? warehouses.filter((w) => w.id === purchaseContext.warehouseId)
                : warehouses
            }
            purchaseId={purchaseContext.purchaseId}
            purchaseItemId={purchaseContext.purchaseItemId}
            defaultCost={purchaseContext.defaultCost}
          />
        </>
      )}
    </main>
  );
}
