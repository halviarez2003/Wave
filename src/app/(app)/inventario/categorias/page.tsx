import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as catalogService from "@/server/modules/catalog/service";

import { NewCategoryDialog } from "./new-category-dialog";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const categories = await catalogService.listCategories(db);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Categorías</h1>
          <p className="text-muted-foreground text-sm">
            Cada categoría define sus propios atributos (IMEI, color, potencia...) sin tocar código.
          </p>
        </div>
        <NewCategoryDialog />
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Atributos</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">
                  <Link href={`/inventario/categorias/${category.id}`} className="hover:underline">
                    {category.name}
                  </Link>
                </TableCell>
                <TableCell>{category._count.attributeDefinitions}</TableCell>
                <TableCell>{category._count.products}</TableCell>
                <TableCell>
                  <Badge variant={category.isActive ? "success" : "secondary"}>
                    {category.isActive ? "Activa" : "Inactiva"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center py-8">
                  Todavía no hay categorías.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
