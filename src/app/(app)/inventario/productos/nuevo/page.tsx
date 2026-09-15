import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import * as catalogService from "@/server/modules/catalog/service";

import { ProductForm } from "./product-form";

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const categories = await catalogService.listCategoriesWithAttributes(db);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/inventario/productos" className="text-muted-foreground text-sm hover:underline">
          ← Productos
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Nuevo producto</h1>
        <p className="text-muted-foreground text-sm">
          Solo lo esencial. Los atributos de la categoría son opcionales y se pueden completar después.
        </p>
      </div>

      {categories.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Primero necesitas al menos una{" "}
          <Link href="/inventario/categorias" className="underline">
            categoría
          </Link>
          .
        </p>
      ) : (
        <ProductForm categories={categories} />
      )}
    </main>
  );
}
