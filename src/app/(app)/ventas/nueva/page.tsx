import Link from "next/link";

import { hasPermission, requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import * as customersService from "@/server/modules/customers/service";
import * as inventoryService from "@/server/modules/inventory/service";
import * as salesService from "@/server/modules/sales/service";

import { SaleForm } from "./sale-form";

export const dynamic = "force-dynamic";

export default async function NuevaVentaPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);

  const [customers, warehouses, accountRows, sellable] = await Promise.all([
    customersService.listCustomers(db),
    inventoryService.listWarehouses(db),
    db.account.findMany({ orderBy: { name: "asc" } }),
    salesService.listSellableItems(db),
  ]);

  const accounts = accountRows.map((a) => ({ id: a.id, name: a.name }));
  const canEditPrice = hasPermission(session, "sales.editPrice");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/ventas" className="text-muted-foreground text-sm hover:underline">
          ← Ventas
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Nueva venta</h1>
      </div>

      {sellable.quantityItems.length === 0 && sellable.serializedItems.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay inventario disponible para vender todavía. Agrega stock desde{" "}
          <Link href="/inventario/ajustes" className="underline">
            Inventario
          </Link>{" "}
          o registra una{" "}
          <Link href="/compras/nueva" className="underline">
            compra
          </Link>
          .
        </p>
      ) : (
        <SaleForm
          customers={customers}
          warehouses={warehouses}
          accounts={accounts}
          quantityItems={sellable.quantityItems}
          serializedItems={sellable.serializedItems}
          canEditPrice={canEditPrice}
        />
      )}
    </main>
  );
}
