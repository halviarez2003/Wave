import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import * as suppliersService from "@/server/modules/suppliers/service";
import * as inventoryService from "@/server/modules/inventory/service";

import { PurchaseForm } from "./purchase-form";

export const dynamic = "force-dynamic";

export default async function NuevaCompraPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);

  const [suppliers, warehouses, accountRows, variants] = await Promise.all([
    suppliersService.listSuppliers(db),
    inventoryService.listWarehouses(db),
    db.account.findMany({ orderBy: { name: "asc" } }),
    inventoryService.listVariantsForPicker(db),
  ]);
  // Los Client Components no pueden recibir Decimal como prop (React
  // solo serializa objetos planos entre servidor y cliente); acá solo
  // necesitan id/nombre para el selector.
  const accounts = accountRows.map((a) => ({ id: a.id, name: a.name }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/compras" className="text-muted-foreground text-sm hover:underline">
          ← Compras
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Nueva compra</h1>
      </div>

      {suppliers.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Primero necesitas al menos un{" "}
          <Link href="/proveedores" className="underline">
            proveedor
          </Link>
          .
        </p>
      ) : variants.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Primero necesitas al menos un{" "}
          <Link href="/inventario/productos/nuevo" className="underline">
            producto
          </Link>
          .
        </p>
      ) : (
        <PurchaseForm suppliers={suppliers} warehouses={warehouses} accounts={accounts} variants={variants} />
      )}
    </main>
  );
}
