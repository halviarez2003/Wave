import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import type { createSupplierSchema } from "./schema";
import type { z } from "zod";

export async function listSuppliers(db: ScopedPrisma) {
  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      payables: { where: { status: { not: "PAID" } } },
      _count: { select: { purchases: true } },
    },
  });

  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    email: s.email,
    isActive: s.isActive,
    purchaseCount: s._count.purchases,
    balanceDue: s.payables.reduce((sum, p) => sum + Number(p.balance), 0),
  }));
}

export async function getSupplier(db: ScopedPrisma, supplierId: string) {
  return db.supplier.findUnique({
    where: { id: supplierId },
    include: {
      purchases: { orderBy: { purchaseDate: "desc" }, include: { payable: true } },
      payables: { orderBy: { issueDate: "desc" }, include: { payments: true } },
    },
  });
}

export async function createSupplier(
  db: ScopedPrisma,
  companyId: string,
  input: z.infer<typeof createSupplierSchema>,
) {
  return db.supplier.create({
    data: {
      companyId,
      name: input.name,
      document: input.document,
      phone: input.phone,
      email: input.email,
      address: input.address,
      notes: input.notes,
    },
  });
}
