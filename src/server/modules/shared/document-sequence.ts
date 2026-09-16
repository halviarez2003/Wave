import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import type { DocumentType } from "@prisma/client";

/**
 * Numeración de documentos atómica: un solo UPDATE ... SET nextNumber =
 * nextNumber + 1 por fila, que Postgres serializa entre transacciones
 * concurrentes sin necesitar un lock manual. Se usa en compras y ventas.
 */
export async function nextDocumentNumber(
  tx: Pick<ScopedPrisma, "documentSequence">,
  companyId: string,
  type: DocumentType,
) {
  const updated = await tx.documentSequence.update({
    where: { companyId_type: { companyId, type } },
    data: { nextNumber: { increment: 1 } },
  });
  return updated.nextNumber - 1;
}
