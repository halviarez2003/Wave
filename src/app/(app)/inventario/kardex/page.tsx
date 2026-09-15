import { requireSession } from "@/lib/dal";
import { getScopedPrisma } from "@/lib/prisma";
import { VariantPickerList } from "@/components/inventory/variant-picker-list";
import * as inventoryService from "@/server/modules/inventory/service";

export const dynamic = "force-dynamic";

export default async function KardexPickerPage() {
  const session = await requireSession();
  const db = getScopedPrisma(session.user.companyId);
  const variants = await inventoryService.listVariantsForPicker(db);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Kardex</h1>
        <p className="text-muted-foreground text-sm">
          Elige un producto para ver su historial completo de movimientos.
        </p>
      </div>
      <VariantPickerList variants={variants} hrefBase="/inventario/kardex" />
    </main>
  );
}
