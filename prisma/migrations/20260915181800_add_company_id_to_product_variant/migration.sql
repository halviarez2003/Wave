/*
  Warnings:

  - Added the required column `companyId` to the `product_variants` table without a default value. This is not possible if the table is not empty.

  Corrección manual (Fase 16): en vez de fallar, la columna se agrega
  nullable, se rellena desde products.companyId (el dueño real de cada
  variante), y recién entonces se vuelve NOT NULL. No se pierde ninguna
  fila existente.
*/
-- AlterTable (nullable primero)
ALTER TABLE "product_variants" ADD COLUMN     "companyId" TEXT;

-- Backfill: cada variante hereda el companyId de su producto
UPDATE "product_variants" pv
SET "companyId" = p."companyId"
FROM "products" p
WHERE p."id" = pv."productId";

-- Ahora sí, obligatoria
ALTER TABLE "product_variants" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "product_variants_companyId_idx" ON "product_variants"("companyId");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
