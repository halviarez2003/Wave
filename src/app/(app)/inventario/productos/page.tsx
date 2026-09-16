import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as catalogService from "@/server/modules/catalog/service";

export const dynamic = "force-dynamic";

const INVENTORY_TYPE_LABELS: Record<string, string> = {
  QUANTITY: "Por cantidad",
  SERIALIZED: "Serializado",
};

export default async function ProductosPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const products = await catalogService.listProducts(db);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Productos</h1>
          <p className="text-muted-foreground text-sm">
            {products.length} producto{products.length === 1 ? "" : "s"} en el catálogo.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/inventario/productos/nuevo">Nuevo producto</Link>
        </Button>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  <Link href={`/inventario/productos/${product.id}`} className="hover:underline">
                    {product.name}
                  </Link>
                  {product.brand && (
                    <span className="text-muted-foreground ml-2 text-xs">{product.brand}</span>
                  )}
                </TableCell>
                <TableCell>{product.categoryName}</TableCell>
                <TableCell>{INVENTORY_TYPE_LABELS[product.inventoryType]}</TableCell>
                <TableCell className="tabular-nums">
                  {product.salePrice !== null ? `$${Number(product.salePrice).toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="tabular-nums">{product.stock}</TableCell>
                <TableCell>
                  <Badge variant={product.isActive ? "success" : "secondary"}>
                    {product.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                  Todavía no hay productos.{" "}
                  <Link href="/inventario/productos/nuevo" className="underline">
                    Crea el primero
                  </Link>
                  .
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
