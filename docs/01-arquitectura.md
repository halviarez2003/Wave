# Arquitectura — Wave (Sistema Administrativo)

## 1. Decisiones y contradicciones resueltas

El brief es extenso y en algunos puntos se pisa a sí mismo. Estas son las
decisiones tomadas para resolverlo, con su justificación:

1. **Multimoneda "no aún" vs. cuentas "Efectivo Bs"/"Zelle" desde ya.**
   Se modela `Currency`/`ExchangeRate`/`Account.currencyId` desde el día 1
   (es solo una FK, no añade complejidad real), pero el seed y la UI del
   MVP solo exponen USD. Así no hay migración dolorosa después.

2. **Formulario de producto "simple" vs. atributos dinámicos por categoría.**
   Crear un producto nunca exige llenar atributos. El alta rápida pide solo
   nombre, categoría, marca, tipo de inventario, costo, precio y stock
   inicial. Los atributos (IMEI, batería, color…) se completan en el mismo
   flujo si el usuario quiere, o después, sin bloquear la creación.

3. **Producto vs. Variante vs. Unidad.** `Product` es el concepto de
   catálogo ("iPhone 15 Pro"). `ProductVariant` es la unidad real de stock
   y venta ("256GB / Titanio", o "Único" para productos sin variantes). Los
   valores de atributos (IMEI, color, batería) se guardan a nivel de
   `ProductVariant` vía `ProductAttributeValue`, porque son las variantes
   las que efectivamente tienen inventario y precio.

4. **"Nunca modificar stock/saldo directamente" vs. necesitar lecturas
   rápidas para el dashboard.** Se usa un patrón *ledger + saldo cacheado*:
   `InventoryBalance.quantity/averageCost` y `Account.balance` son cachés,
   pero **solo** se escriben dentro de la misma transacción de BD que
   inserta el movimiento (`InventoryMovement` / `FinancialTransaction`) que
   los origina. El saldo cacheado nunca se toca de forma aislada; el
   movimiento es la fuente de verdad y el saldo es 100% derivable de él.

5. **Roles fijos (ADMIN/GERENTE/VENDEDOR/INVENTARIO/CONTABILIDAD) vs.
   "no hardcodear".** Se modelan como filas (`Role`, `Permission`,
   `RolePermission`) en vez de un enum, sembradas por defecto en cada
   empresa. Así el comportamiento ("Vendedor no ve costos") se resuelve
   comprobando permisos (`costs.view`, `prices.edit`, `sales.void`, …) en
   vez de `if (role === 'VENDEDOR')`, y el negocio puede crear roles nuevos
   sin tocar código.

6. **Batería "opcional" pero listada como campo fijo de unidad
   serializada.** `InventoryUnit.batteryPercent` es nullable siempre; la
   categoría decide (vía `AttributeDefinition.isRequired`) si debe pedirse
   en el formulario, pero el dato físico vive en la unidad porque aplica
   sobre todo a celulares/consolas/laptops (no a forros).

7. **¿Quién aprueba pagos de compra o egresos?** No estaba definido.
   Decisión: se resuelve por permisos (`purchases.pay`, `expenses.create`,
   `accounts.transfer`), asignados por defecto a ADMIN/GERENTE/CONTABILIDAD,
   configurable por la empresa sin migración.

## 2. Principios de integridad (no negociables)

- Ninguna tabla de saldo (`InventoryBalance.quantity/averageCost`,
  `Account.balance`) se actualiza fuera de una transacción de BD que también
  inserta su movimiento correspondiente (`$transaction` de Prisma).
- Todo movimiento de inventario o dinero se **agrega**, nunca se edita ni
  se borra. Una anulación crea un movimiento inverso y referencia al
  original (`reversalOfSaleId`, etc.).
- El costo usado en una venta (`SaleItem.unitCost`) es un snapshot histórico
  inmutable. La utilidad histórica nunca se recalcula con el costo actual.
- IMEI y serial son únicos por empresa (`@@unique([companyId, imei1])`),
  validados en el mismo paso donde se capturan (alta rápida y pegado
  masivo), no solo al guardar.
- Numeración de documentos (`Sale.number`, `Purchase.number`) sale de
  `DocumentSequence`, incrementado con `SELECT ... FOR UPDATE` dentro de la
  transacción, para evitar colisiones bajo concurrencia.
- Todo tenant-model incluye `companyId` y se consulta siempre filtrado por
  él (ver capa de datos, sección 4.3).

## 3. Stack y capas

```
Next.js 14 (App Router) + TypeScript estricto
 ├─ UI: React + Tailwind + shadcn/ui + TanStack Table + Recharts
 ├─ Auth: Auth.js v5 (Credentials + Prisma Adapter) — ver 4.1
 ├─ Mutaciones: Server Actions (capa de dominio, no Prisma directo desde UI)
 ├─ Lecturas simples: Server Components -> repositorios
 ├─ Integraciones externas (si futuro): API Routes /app/api/*
 ├─ Validación: Zod (mismos esquemas en cliente y servidor)
 ├─ ORM: Prisma -> PostgreSQL
 └─ Dinero: Prisma.Decimal en toda la capa de dominio (nunca `number`)
```

### 3.1 Por qué Auth.js y no Clerk

Clerk es más rápido de integrar, pero es un servicio externo de pago que
almacena identidad fuera de nuestra base de datos multi-tenant. Auth.js v5
con el provider `Credentials` mantiene usuario/empresa/rol en el mismo
esquema, sin costo recurrente ni dependencia externa, y es igual de seguro
(bcrypt + JWT firmado). Se puede añadir OAuth (Google) después sin tocar el
modelo de datos.

> Corrección (Fase 5): el diseño original mencionaba `@auth/prisma-adapter`.
> Se descartó: Auth.js exige estrategia `jwt` en cuanto hay un provider
> `Credentials` (no soporta sesiones de BD con login por contraseña), y el
> adapter existe sobre todo para gestionar cuentas OAuth y sesiones en BD —
> ninguna de las dos aplica aquí. Usarlo habría exigido añadir las tablas
> `Account`/`Session`/`VerificationToken` propias de Auth.js sin necesitarlas.
> `authorize()` consulta `User` directamente con Prisma; el estado de sesión
> vive solo en el JWT (`companyId`, `roleId`, `permissions`).

> Nota (Fase 5): Next.js 16 renombró `middleware.ts` a **`proxy.ts`** (y la
> función exportada de `middleware` a `proxy`/default export) — ver
> `node_modules/next/dist/docs/.../file-conventions/proxy.md`. El archivo de
> protección de rutas del proyecto es `src/proxy.ts`, no `middleware.ts`.

### 3.2 Por qué Server Actions como vía principal de escritura

Cada mutación crítica (venta, compra, pago, ajuste, transferencia) toca
varias tablas de forma atómica. Server Actions nos dan una función de
dominio con Zod + `prisma.$transaction` + chequeo de permiso + audit log en
un solo lugar, invocable directamente desde formularios/drawers sin
serializar JSON a mano. Las API Routes quedan reservadas para webhooks o
integraciones externas futuras.

## 4. Estructura de carpetas propuesta

```
/prisma
  schema.prisma
  /migrations
  seed.ts

/src
  auth.ts              (config Auth.js — providers, callbacks, jwt)
  proxy.ts             (protección de rutas; reemplaza a middleware.ts en Next 16)

  /app
    /(auth)/login
    /(app)/dashboard
    /(app)/ventas
    /(app)/compras
    /(app)/inventario/productos
    /(app)/inventario/categorias
    /(app)/inventario/movimientos
    /(app)/inventario/kardex
    /(app)/clientes
    /(app)/proveedores
    /(app)/cuentas
    /(app)/cuentas/por-cobrar
    /(app)/cuentas/por-pagar
    /(app)/gastos
    /(app)/reportes
    /(app)/configuracion
    /api/... (solo integraciones externas)

  /server
    /modules
      /catalog        (Category, AttributeDefinition, Product, Variant)
      /inventory      (Balance, Unit, Movement, Kardex, Warehouse)
      /purchasing     (Purchase, PurchaseItem, PurchasePayment)
      /sales          (Sale, SaleItem, SalePayment)
      /finance        (Account, FinancialTransaction, Transfer)
      /receivables    (AccountReceivable, ReceivablePayment)
      /payables       (AccountPayable, PayablePayment)
      /expenses
      /customers
      /suppliers
      /reports        (agregaciones de solo lectura para dashboard/reportes)
      /audit
      /auth           (permisos, sesión, roles)
    cada módulo:
      schema.ts       (Zod)
      repository.ts   (Prisma, siempre companyId-scoped)
      service.ts       (reglas de negocio, transacciones)
      actions.ts       ("use server" — entrypoint desde UI)

  /lib
    prisma.ts          (singleton + client extension multi-tenant)
    permissions.ts      (catálogo de permisos + matriz por rol)
    dal.ts              (getSession/requireSession/hasPermission)

  /components
    /ui                (shadcn)
    /dashboard, /sales, /inventory, ... (compuestos por módulo)

/tests
  /unit      (motor de costos, ventas, compras, cuentas — Vitest)
  /integration (contra Postgres de test, con transacción por test)
```

### 4.1 Auth y sesión

JWT de sesión guarda `userId`, `companyId`, `roleId` y el set de códigos de
permiso (cacheado al login, se invalida si el rol cambia). Middleware de
Next.js protege todo bajo `(app)` salvo `(auth)/login`.

### 4.2 Permisos

`permissions.ts` define el catálogo de códigos (`sales.create`,
`sales.editPrice`, `sales.void`, `costs.view`, `purchases.create`,
`purchases.pay`, `inventory.adjust`, `accounts.transfer`, `expenses.create`,
`reports.view`, …) y la matriz por defecto de los 5 roles semilla. Se siembra
en `Role`/`Permission`/`RolePermission` al crear la empresa; el admin puede
reasignar permisos por rol desde Configuración sin deploy.

### 4.3 Aislamiento multi-tenant

Se usa una **Prisma Client Extension** que, para los modelos con
`companyId`, exige explícitamente esa condición en el `where` de toda
consulta emitida desde `repository.ts` (lanza si falta). `companyId` sale
siempre de la sesión, nunca de un parámetro de la request. Esto hace
estructuralmente imposible una fuga de datos entre empresas por olvido de
un filtro, incluso con una sola empresa activa hoy.

## 5. Cómo se resuelven los flujos críticos

- **Inventario por cantidad:** `InventoryBalance` guarda `quantity` y
  `averageCost` (costo promedio ponderado). Cada `InventoryMovement` de tipo
  compra recalcula `averageCost = (valorAnterior + valorEntrante) /
  cantidadTotal` dentro de la misma transacción. Las ventas descuentan
  cantidad y usan (sin modificar) el `averageCost` vigente como
  `SaleItem.unitCost`.
- **Inventario serializado:** cada `InventoryUnit` tiene su propio `cost`.
  No hay promedio. Vender = tomar una unidad `AVAILABLE`, pasarla a `SOLD`
  dentro de la transacción, y copiar su costo a `SaleItem.unitCost`. Un
  IMEI/serial vendido no puede reservarse ni venderse de nuevo porque su
  `status` deja de ser `AVAILABLE` (el query de "unidades vendibles" siempre
  filtra por status, y el update de status a `SOLD` ocurre atómicamente con
  la creación del `SaleItem`).
- **Compras multi-producto:** `Purchase` + N `PurchaseItem` (mezclando
  variantes de cantidad y serializadas) en una sola transacción: sube
  `InventoryBalance` o crea `InventoryUnit[]` según el tipo, crea
  `InventoryMovement` por línea, registra `PurchasePayment[]` y, si queda
  saldo, crea `AccountPayable`.
- **Ventas:** carrito -> `Sale` + `SaleItem[]` + `SalePayment[]` (uno o
  varios métodos/cuentas) en una transacción: descuenta inventario, calcula
  utilidad línea a línea, aplica pagos a las cuentas correspondientes
  (`FinancialTransaction`), y si `paidTotal < total` crea
  `AccountReceivable`.
- **Movimientos financieros:** tabla única `FinancialTransaction`
  (ledger append-only). `Account.balance` es un caché mantenido junto al
  insert. Una transferencia son dos filas (`TRANSFER_OUT`/`TRANSFER_IN`)
  con el mismo `transferGroupId`; no genera utilidad ni gasto.
- **Anulaciones:** no se borra nada. Anular una venta crea una nueva `Sale`
  reversa (o se marca `VOIDED` + se generan `InventoryMovement`/
  `FinancialTransaction` inversos enlazados por `reversalOfSaleId`), dejando
  ambas visibles en el kardex y en caja.
- **Consistencia:** toda operación multi-tabla vive en un único
  `prisma.$transaction`; si cualquier paso falla, se revierte todo. Los
  chequeos de "IMEI ya vendido" / "stock insuficiente" se hacen dentro de la
  transacción justo antes de escribir, con bloqueo de fila
  (`SELECT ... FOR UPDATE`) sobre `InventoryBalance`/`InventoryUnit`/
  `Account`/`DocumentSequence` para evitar condiciones de carrera con ventas
  concurrentes.

## 6. Testing

Vitest para el motor de dominio (`/server/modules/*/service.ts`), contra una
base Postgres de test real (Docker), con rollback de transacción por test.
Casos obligatorios: costo promedio, costo individual, venta serializada,
venta por cantidad, pagos parciales, transferencias, anulación de venta y
compra, valorización de inventario, IMEI/serial duplicado — igual a la lista
del brief (sección 58).
