import "server-only";

import type { ScopedPrisma } from "@/lib/prisma";
import type { createCustomerSchema } from "./schema";
import type { z } from "zod";

export async function listCustomers(db: ScopedPrisma) {
  const customers = await db.customer.findMany({
    orderBy: { name: "asc" },
    include: {
      receivables: { where: { status: { not: "PAID" } } },
      _count: { select: { sales: true } },
    },
  });

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    isActive: c.isActive,
    saleCount: c._count.sales,
    balanceDue: c.receivables.reduce((sum, r) => sum + Number(r.balance), 0),
  }));
}

export async function getCustomer(db: ScopedPrisma, customerId: string) {
  return db.customer.findUnique({
    where: { id: customerId },
    include: {
      sales: { orderBy: { saleDate: "desc" }, include: { receivable: true } },
      receivables: { orderBy: { issueDate: "desc" }, include: { payments: true } },
    },
  });
}

export async function createCustomer(
  db: ScopedPrisma,
  companyId: string,
  input: z.infer<typeof createCustomerSchema>,
) {
  return db.customer.create({
    data: {
      companyId,
      name: input.name,
      document: input.document,
      phone: input.phone,
      email: input.email,
      address: input.address,
      notes: input.notes,
      creditLimit: input.creditLimit,
    },
  });
}
