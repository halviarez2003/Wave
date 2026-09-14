import Link from "next/link";
import { notFound } from "next/navigation";

import { hasPermission, requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import * as catalogService from "@/server/modules/catalog/service";

import { EditProductForm } from "./edit-product-form";

export const dynamic = "force-dynamic";

const INVENTORY_TYPE_LABELS: Record<string, string> = {
  QUANTITY: "Por cantidad",
  SERIALIZED: "Serializado",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const product = await catalogService.getProduct(db, id);

  if (!product) notFound();

  const variant = product.variants[0];
  const canEdit = hasPermission(session, "inventory.create");

  const stock =
    product.inventoryType === "QUANTITY"
      ? (variant?.inventoryBalances.reduce((s, b) => s + b.quantity, 0) ?? 0)
      : (variant?.inventoryUnits.length ?? 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/inventario/productos" className="text-muted-foreground text-sm hover:underline">
          ← Productos
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{product.name}</h1>
          <Badge variant={product.isActive ? "success" : "secondary"}>
            {product.isActive ? "Activo" : "Inactivo"}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {product.category.name} · {INVENTORY_TYPE_LABELS[product.inventoryType]}
          {product.brand ? ` · ${product.brand}` : ""}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-4">
        <Stat label="Precio" value={variant ? `$${Number(variant.salePrice).toFixed(2)}` : "—"} />
        <Stat label="Stock" value={String(stock)} />
        <Stat label="SKU" value={variant?.sku ?? "—"} />
      </dl>

      {variant && variant.attributeValues.length > 0 && (
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground mb-3 text-xs uppercase tracking-wide">Atributos</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {variant.attributeValues.map((av) => (
              <div key={av.id} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{av.attribute.label}</dt>
                <dd>{av.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {canEdit && variant && (
        <EditProductForm
          productId={product.id}
          name={product.name}
          brand={product.brand}
          isActive={product.isActive}
          salePrice={variant.salePrice.toString()}
        />
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
