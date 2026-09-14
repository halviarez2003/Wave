export const PERMISSIONS = [
  { code: "sales.create", description: "Registrar ventas" },
  { code: "sales.editPrice", description: "Cambiar el precio de venta en el carrito" },
  { code: "sales.void", description: "Anular una venta completada" },
  { code: "costs.view", description: "Ver costos y márgenes de utilidad" },
  { code: "purchases.create", description: "Registrar compras" },
  { code: "purchases.pay", description: "Registrar pagos de una compra" },
  { code: "purchases.void", description: "Anular una compra completada" },
  { code: "inventory.create", description: "Crear productos y variantes" },
  { code: "inventory.adjust", description: "Hacer ajustes manuales de inventario" },
  { code: "inventory.transfer", description: "Transferir inventario entre almacenes" },
  { code: "accounts.transfer", description: "Transferir dinero entre cuentas" },
  { code: "accounts.manage", description: "Crear y editar cuentas de dinero" },
  { code: "expenses.create", description: "Registrar gastos" },
  { code: "customers.manage", description: "Crear y editar clientes" },
  { code: "suppliers.manage", description: "Crear y editar proveedores" },
  { code: "reports.view", description: "Ver reportes y dashboard" },
  { code: "settings.manage", description: "Configurar categorías, atributos y roles" },
  { code: "users.manage", description: "Crear usuarios y asignar roles" },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

export const SEED_ROLES = ["ADMIN", "GERENTE", "VENDEDOR", "INVENTARIO", "CONTABILIDAD"] as const;

export type SeedRole = (typeof SEED_ROLES)[number];

const ALL: PermissionCode[] = PERMISSIONS.map((p) => p.code);

/**
 * Matriz de permisos por defecto para los 5 roles semilla. Se siembra al
 * crear la empresa; el admin puede reasignarla desde Configuración sin
 * tocar código (ver docs/01-arquitectura.md, sección 4.2).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<SeedRole, PermissionCode[]> = {
  ADMIN: ALL,
  GERENTE: ALL.filter((c) => c !== "users.manage" && c !== "settings.manage"),
  VENDEDOR: ["sales.create", "reports.view"],
  INVENTARIO: [
    "inventory.create",
    "inventory.adjust",
    "inventory.transfer",
    "purchases.create",
    "reports.view",
  ],
  CONTABILIDAD: [
    "costs.view",
    "purchases.pay",
    "accounts.transfer",
    "accounts.manage",
    "expenses.create",
    "reports.view",
  ],
};
