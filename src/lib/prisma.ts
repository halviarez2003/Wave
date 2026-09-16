import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Modelos que pertenecen a una empresa (tienen `companyId` propio). El resto
 * de las tablas (líneas de detalle, pagos, valores de atributo, Permission,
 * Currency) se alcanzan siempre a través de una de estas, así que no
 * necesitan su propio scoping.
 */
const TENANT_MODELS = new Set([
  "Role",
  "User",
  "AuditLog",
  "DocumentSequence",
  "ExchangeRate",
  "Category",
  "AttributeDefinition",
  "Product",
  "ProductVariant",
  "Warehouse",
  "InventoryBalance",
  "InventoryUnit",
  "InventoryMovement",
  "Customer",
  "Supplier",
  "Sale",
  "Purchase",
  "Account",
  "FinancialTransaction",
  "ExpenseCategory",
  "Expense",
  "AccountReceivable",
  "AccountPayable",
]);

const READ_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

const WRITE_OPERATIONS = new Set([
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

class MissingTenantScopeError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Falta companyId en ${model}.${operation}(). Toda consulta sobre un ` +
        `modelo de empresa debe pasar por getScopedPrisma(companyId).`,
    );
    this.name = "MissingTenantScopeError";
  }
}

/**
 * Cliente de Prisma acotado a una empresa. Para los modelos de
 * TENANT_MODELS, inyecta `companyId` en lecturas y `data.companyId` en
 * `create`, y exige que `where.companyId` coincida en updates/deletes.
 * companyId siempre viene de la sesión autenticada, nunca de un parámetro
 * de la request — así una fuga de datos entre empresas es estructuralmente
 * imposible, no solo una convención que alguien puede olvidar.
 */
export function getScopedPrisma(companyId: string) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }

          const a = args as Record<string, unknown>;

          if (READ_OPERATIONS.has(operation)) {
            const where = (a.where as Record<string, unknown> | undefined) ?? {};
            a.where = { ...where, companyId };
          } else if (operation === "create") {
            const data = (a.data as Record<string, unknown> | undefined) ?? {};
            if (data.companyId && data.companyId !== companyId) {
              throw new MissingTenantScopeError(model, operation);
            }
            a.data = { ...data, companyId };
          } else if (WRITE_OPERATIONS.has(operation)) {
            const where = a.where as Record<string, unknown> | undefined;
            if (!where) {
              throw new MissingTenantScopeError(model, operation);
            }
            a.where = { ...where, companyId };
          } else if (operation === "createMany") {
            const data = (a.data as Record<string, unknown>[] | undefined) ?? [];
            a.data = data.map((row) => ({ ...row, companyId }));
          }

          return query(a);
        },
      },
    },
  });
}

export type ScopedPrisma = ReturnType<typeof getScopedPrisma>;
