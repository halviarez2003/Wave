import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as catalogService from "@/server/modules/catalog/service";

import { AddAttributeForm } from "./add-attribute-form";

export const dynamic = "force-dynamic";

const DATA_TYPE_LABELS: Record<string, string> = {
  TEXT: "Texto",
  NUMBER: "Número",
  BOOLEAN: "Sí/No",
  DATE: "Fecha",
  SELECT: "Lista",
};

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const category = await catalogService.getCategoryWithAttributes(db, id);

  if (!category) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/inventario/categorias" className="text-muted-foreground text-sm hover:underline">
          ← Categorías
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{category.name}</h1>
        <p className="text-muted-foreground text-sm">
          Atributos que se piden al crear un producto de esta categoría.
        </p>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clave</TableHead>
              <TableHead>Etiqueta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Requerido</TableHead>
              <TableHead>En listas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {category.attributeDefinitions.map((attr) => (
              <TableRow key={attr.id}>
                <TableCell className="font-mono text-xs">{attr.key}</TableCell>
                <TableCell>{attr.label}</TableCell>
                <TableCell>{DATA_TYPE_LABELS[attr.dataType]}</TableCell>
                <TableCell>{attr.isRequired ? <Badge variant="warning">Sí</Badge> : "—"}</TableCell>
                <TableCell>{attr.showInList ? "Sí" : "—"}</TableCell>
              </TableRow>
            ))}
            {category.attributeDefinitions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center py-8">
                  Esta categoría todavía no tiene atributos.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddAttributeForm categoryId={category.id} />
    </main>
  );
}
