# Modelo de datos — Wave

Este es el borrador de `prisma/schema.prisma` que se creará literalmente en
la Fase 4 (creación del proyecto). Se presenta aquí como el "modelo de
datos" formal para revisión antes de escribir código de aplicación.

Convenciones:
- Dinero, costos y precios: `Decimal @db.Decimal(14,4)` (nunca `Float`).
- Cantidades: `Int` (inventario de unidades discretas; si en el futuro se
  vende por peso/volumen, se cambia a `Decimal` sin romper el resto).
- Todo modelo con datos de una empresa lleva `companyId String` indexado.
- IDs: `cuid()`. Soft references a `User`/`Supplier` opcionales donde el
  dato puede perderse sin romper el histórico (ej. usuario borrado).

## Diagrama de relaciones (resumen)

```
Company 1—* User *—1 Role *—* Permission
Company 1—* Category 1—* AttributeDefinition
Category 1—* Product 1—* ProductVariant 1—* ProductAttributeValue
ProductVariant 1—* InventoryBalance (por Warehouse)   [tipo QUANTITY]
ProductVariant 1—* InventoryUnit    (por Warehouse)   [tipo SERIALIZED]
ProductVariant 1—* InventoryMovement (ledger, ambos tipos)

Purchase 1—* PurchaseItem 1—* InventoryUnit (si serializado)
Purchase 1—* PurchasePayment —1 FinancialTransaction
Purchase 1—1 AccountPayable 1—* PayablePayment —1 FinancialTransaction

Sale 1—* SaleItem —1 InventoryUnit? (si serializado)
Sale 1—* SalePayment —1 FinancialTransaction
Sale 1—1 AccountReceivable 1—* ReceivablePayment —1 FinancialTransaction

Account 1—* FinancialTransaction (ledger; balance = caché transaccional)
Expense —1 FinancialTransaction
```

## Esquema completo (borrador)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// TENANCY / IDENTIDAD / PERMISOS
// ============================================================

model Company {
  id             String    @id @default(cuid())
  name           String
  taxId          String?
  baseCurrencyId String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  baseCurrency   Currency? @relation(fields: [baseCurrencyId], references: [id])

  users              User[]
  roles              Role[]
  categories         Category[]
  products           Product[]
  warehouses         Warehouse[]
  customers          Customer[]
  suppliers          Supplier[]
  accounts           Account[]
  sales              Sale[]
  purchases          Purchase[]
  expenses           Expense[]
  expenseCategories  ExpenseCategory[]
  auditLogs          AuditLog[]
  documentSequences  DocumentSequence[]
  exchangeRates      ExchangeRate[]

  @@map("companies")
}

model Role {
  id        String   @id @default(cuid())
  companyId String
  name      String   // ADMIN, GERENTE, VENDEDOR, INVENTARIO, CONTABILIDAD, o custom
  isSystem  Boolean  @default(true)
  createdAt DateTime @default(now())

  company     Company          @relation(fields: [companyId], references: [id])
  permissions RolePermission[]
  users       User[]

  @@unique([companyId, name])
  @@map("roles")
}

model Permission {
  id          String @id @default(cuid())
  code        String @unique // "sales.create", "costs.view", "prices.edit"...
  description String

  roles RolePermission[]

  @@map("permissions")
}

model RolePermission {
  roleId       String
  permissionId String

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model User {
  id           String   @id @default(cuid())
  companyId    String
  roleId       String
  email        String
  passwordHash String
  name         String
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id])
  role    Role    @relation(fields: [roleId], references: [id])

  sales                 Sale[]
  purchases             Purchase[]
  inventoryMovements    InventoryMovement[]
  financialTransactions FinancialTransaction[]
  auditLogs             AuditLog[]
  expenses              Expense[]
  receivablePayments    ReceivablePayment[]
  payablePayments       PayablePayment[]

  @@unique([companyId, email])
  @@index([companyId])
  @@map("users")
}

model AuditLog {
  id         String   @id @default(cuid())
  companyId  String
  userId     String?
  entityType String
  entityId   String
  action     String   // CREATE, UPDATE, DELETE, VOID, ADJUST...
  beforeData Json?
  afterData  Json?
  createdAt  DateTime @default(now())

  company Company @relation(fields: [companyId], references: [id])
  user    User?   @relation(fields: [userId], references: [id])

  @@index([companyId, entityType, entityId])
  @@index([companyId, createdAt])
  @@map("audit_logs")
}

enum DocumentType {
  SALE
  PURCHASE
}

model DocumentSequence {
  id         String       @id @default(cuid())
  companyId  String
  type       DocumentType
  nextNumber Int          @default(1)

  company Company @relation(fields: [companyId], references: [id])

  @@unique([companyId, type])
  @@map("document_sequences")
}

// ============================================================
// MONEDA (arquitectura lista, MVP solo usa USD)
// ============================================================

model Currency {
  id     String @id @default(cuid())
  code   String @unique // USD, VES, EUR
  name   String
  symbol String

  companies     Company[]
  accounts      Account[]
  exchangeRates ExchangeRate[]

  @@map("currencies")
}

model ExchangeRate {
  id         String   @id @default(cuid())
  companyId  String
  currencyId String
  rate       Decimal  @db.Decimal(18, 6) // frente a la moneda base de la empresa
  date       DateTime

  company  Company  @relation(fields: [companyId], references: [id])
  currency Currency @relation(fields: [currencyId], references: [id])

  @@unique([companyId, currencyId, date])
  @@map("exchange_rates")
}

// ============================================================
// CATÁLOGO: CATEGORÍAS, ATRIBUTOS, PRODUCTOS, VARIANTES
// ============================================================

model Category {
  id        String   @id @default(cuid())
  companyId String
  name      String
  parentId  String?
  icon      String?
  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)

  company  Company    @relation(fields: [companyId], references: [id])
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")

  attributeDefinitions AttributeDefinition[]
  products             Product[]

  @@unique([companyId, name])
  @@map("categories")
}

enum AttributeDataType {
  TEXT
  NUMBER
  BOOLEAN
  DATE
  SELECT
}

model AttributeDefinition {
  id         String            @id @default(cuid())
  companyId  String
  categoryId String
  key        String            // slug: "imei", "battery_percent"
  label      String            // "IMEI", "Batería (%)"
  dataType   AttributeDataType
  options    Json?             // valores para SELECT: ["Nuevo","Usado","Reacondicionado"]
  isRequired Boolean           @default(false)
  showInList Boolean           @default(false)
  sortOrder  Int               @default(0)

  category Category @relation(fields: [categoryId], references: [id])
  values   ProductAttributeValue[]

  @@unique([categoryId, key])
  @@map("attribute_definitions")
}

enum InventoryType {
  QUANTITY
  SERIALIZED
}

model Product {
  id            String        @id @default(cuid())
  companyId     String
  categoryId    String
  name          String
  brand         String?
  inventoryType InventoryType
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  company  Company  @relation(fields: [companyId], references: [id])
  category Category @relation(fields: [categoryId], references: [id])

  variants ProductVariant[]

  @@index([companyId, categoryId])
  @@index([companyId, name])
  @@map("products")
}

model ProductVariant {
  id        String   @id @default(cuid())
  productId String
  label     String   // "256GB / Titanio", o "Único"
  sku       String?
  barcode   String?
  salePrice Decimal  @db.Decimal(14, 4)
  lastCost  Decimal? @db.Decimal(14, 4) // informativo; NUNCA fuente de verdad de costo
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  product Product @relation(fields: [productId], references: [id])

  attributeValues    ProductAttributeValue[]
  inventoryBalances  InventoryBalance[]
  inventoryUnits     InventoryUnit[]
  inventoryMovements InventoryMovement[]
  saleItems          SaleItem[]
  purchaseItems      PurchaseItem[]

  @@unique([productId, sku])
  @@index([sku])
  @@index([barcode])
  @@map("product_variants")
}

model ProductAttributeValue {
  id                    String @id @default(cuid())
  productVariantId      String
  attributeDefinitionId String
  value                 String // texto plano; se interpreta según dataType al leer

  variant   ProductVariant      @relation(fields: [productVariantId], references: [id], onDelete: Cascade)
  attribute AttributeDefinition @relation(fields: [attributeDefinitionId], references: [id])

  @@unique([productVariantId, attributeDefinitionId])
  @@map("product_attribute_values")
}

// ============================================================
// ALMACENES
// ============================================================

model Warehouse {
  id        String  @id @default(cuid())
  companyId String
  name      String
  isDefault Boolean @default(false)
  address   String?

  company Company @relation(fields: [companyId], references: [id])

  inventoryBalances  InventoryBalance[]
  inventoryUnits     InventoryUnit[]
  inventoryMovements InventoryMovement[]
  sales              Sale[]
  purchases          Purchase[]

  @@unique([companyId, name])
  @@map("warehouses")
}

// ============================================================
// INVENTARIO — DOS MOTORES DE COSTO
// ============================================================

// A) Por cantidad — costo promedio ponderado. Las ventas NO lo modifican.
model InventoryBalance {
  id               String   @id @default(cuid())
  companyId        String
  productVariantId String
  warehouseId      String
  quantity         Int      @default(0)
  averageCost      Decimal  @default(0) @db.Decimal(14, 4)
  updatedAt        DateTime @updatedAt

  variant   ProductVariant @relation(fields: [productVariantId], references: [id])
  warehouse Warehouse      @relation(fields: [warehouseId], references: [id])

  @@unique([productVariantId, warehouseId])
  @@index([companyId])
  @@map("inventory_balances")
}

// B) Serializado — costo individual. Nunca se promedia.
enum UnitCondition {
  NEW
  USED
  REFURBISHED
}

enum InventoryUnitStatus {
  AVAILABLE
  RESERVED
  SOLD
  RETURNED
  DAMAGED
  IN_REPAIR
  LAYAWAY
}

model InventoryUnit {
  id               String              @id @default(cuid())
  companyId        String
  productVariantId String
  warehouseId      String
  serial           String?
  imei1            String?
  imei2            String?
  internalCode     String?
  condition        UnitCondition       @default(NEW)
  batteryPercent   Int?
  color            String?
  capacity         String?
  cost             Decimal             @db.Decimal(14, 4)
  suggestedPrice   Decimal?            @db.Decimal(14, 4)
  status           InventoryUnitStatus @default(AVAILABLE)
  purchaseDate     DateTime?
  supplierId       String?
  purchaseItemId   String?
  locationNote     String?
  notes            String?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  variant      ProductVariant @relation(fields: [productVariantId], references: [id])
  warehouse    Warehouse      @relation(fields: [warehouseId], references: [id])
  supplier     Supplier?      @relation(fields: [supplierId], references: [id])
  purchaseItem PurchaseItem?  @relation(fields: [purchaseItemId], references: [id])

  saleItem  SaleItem?
  movements InventoryMovement[]

  @@unique([companyId, imei1])
  @@unique([companyId, serial])
  @@index([companyId, status])
  @@map("inventory_units")
}

// Ledger único de movimientos — fuente de verdad de todo cambio de stock.
enum InventoryMovementType {
  PURCHASE
  SALE
  SALE_RETURN
  PURCHASE_RETURN
  ADJUSTMENT_POSITIVE
  ADJUSTMENT_NEGATIVE
  TRANSFER_IN
  TRANSFER_OUT
  MANUAL_IN
  MANUAL_OUT
  DAMAGE
  LOSS
  INTERNAL_USE
  VOID_SALE
  VOID_PURCHASE
}

enum RelatedDocumentType {
  SALE
  PURCHASE
  ADJUSTMENT
  TRANSFER
}

model InventoryMovement {
  id                  String                @id @default(cuid())
  companyId           String
  productVariantId    String
  inventoryUnitId     String?
  warehouseId         String
  type                InventoryMovementType
  quantity            Int                    // siempre positivo; el signo lo da `type`
  stockBefore         Int
  stockAfter          Int
  unitCost            Decimal                @db.Decimal(14, 4)
  totalValue          Decimal                @db.Decimal(14, 4)
  relatedDocumentType RelatedDocumentType?
  relatedDocumentId   String?
  reason              String?
  comment             String?
  userId              String?
  createdAt           DateTime               @default(now())

  variant       ProductVariant @relation(fields: [productVariantId], references: [id])
  inventoryUnit InventoryUnit? @relation(fields: [inventoryUnitId], references: [id])
  warehouse     Warehouse      @relation(fields: [warehouseId], references: [id])
  user          User?          @relation(fields: [userId], references: [id])

  @@index([companyId, productVariantId, createdAt])
  @@index([companyId, relatedDocumentType, relatedDocumentId])
  @@map("inventory_movements")
}

// ============================================================
// CLIENTES / PROVEEDORES
// ============================================================

model Customer {
  id          String   @id @default(cuid())
  companyId   String
  name        String
  document    String?
  phone       String?
  email       String?
  address     String?
  notes       String?
  creditLimit Decimal? @db.Decimal(14, 4)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  company     Company             @relation(fields: [companyId], references: [id])
  sales       Sale[]
  receivables AccountReceivable[]

  @@index([companyId, name])
  @@map("customers")
}

model Supplier {
  id        String   @id @default(cuid())
  companyId String
  name      String
  document  String?
  phone     String?
  email     String?
  address   String?
  notes     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  company        Company          @relation(fields: [companyId], references: [id])
  purchases      Purchase[]
  payables       AccountPayable[]
  inventoryUnits InventoryUnit[]
  expenses       Expense[]

  @@index([companyId, name])
  @@map("suppliers")
}

// ============================================================
// VENTAS
// ============================================================

enum SaleStatus {
  COMPLETED
  VOIDED
}

model Sale {
  id               String     @id @default(cuid())
  companyId        String
  number           Int
  customerId       String?
  warehouseId      String
  status           SaleStatus @default(COMPLETED)
  subtotal         Decimal    @db.Decimal(14, 4)
  discount         Decimal    @default(0) @db.Decimal(14, 4)
  total            Decimal    @db.Decimal(14, 4)
  totalCost        Decimal    @db.Decimal(14, 4)
  totalProfit      Decimal    @db.Decimal(14, 4)
  paidTotal        Decimal    @default(0) @db.Decimal(14, 4)
  balanceDue       Decimal    @default(0) @db.Decimal(14, 4)
  saleDate         DateTime   @default(now())
  userId           String
  notes            String?
  voidedAt         DateTime?
  voidReason       String?
  reversalOfSaleId String?    @unique

  company        Company   @relation(fields: [companyId], references: [id])
  customer       Customer? @relation(fields: [customerId], references: [id])
  warehouse      Warehouse @relation(fields: [warehouseId], references: [id])
  user           User      @relation(fields: [userId], references: [id])
  reversalOfSale Sale?     @relation("SaleReversal", fields: [reversalOfSaleId], references: [id])
  reversedBySale Sale?     @relation("SaleReversal")

  items      SaleItem[]
  payments   SalePayment[]
  receivable AccountReceivable?

  @@unique([companyId, number])
  @@index([companyId, saleDate])
  @@map("sales")
}

model SaleItem {
  id               String  @id @default(cuid())
  saleId           String
  productVariantId String
  inventoryUnitId  String? @unique
  quantity         Int     @default(1)
  unitPrice        Decimal @db.Decimal(14, 4)
  unitCost         Decimal @db.Decimal(14, 4) // snapshot histórico, nunca recalculado
  subtotal         Decimal @db.Decimal(14, 4)
  profit           Decimal @db.Decimal(14, 4)

  sale          Sale           @relation(fields: [saleId], references: [id])
  variant       ProductVariant @relation(fields: [productVariantId], references: [id])
  inventoryUnit InventoryUnit? @relation(fields: [inventoryUnitId], references: [id])

  @@index([saleId])
  @@map("sale_items")
}

model SalePayment {
  id                     String   @id @default(cuid())
  saleId                 String
  accountId              String
  amount                 Decimal  @db.Decimal(14, 4)
  paymentDate            DateTime @default(now())
  reference              String?
  financialTransactionId String?  @unique

  sale                 Sale                  @relation(fields: [saleId], references: [id])
  account              Account               @relation(fields: [accountId], references: [id])
  financialTransaction FinancialTransaction? @relation(fields: [financialTransactionId], references: [id])

  @@index([saleId])
  @@map("sale_payments")
}

// ============================================================
// COMPRAS
// ============================================================

enum PurchaseStatus {
  COMPLETED
  VOIDED
}

model Purchase {
  id                   String         @id @default(cuid())
  companyId            String
  number               Int
  supplierId           String
  warehouseId          String
  status               PurchaseStatus @default(COMPLETED)
  subtotal             Decimal        @db.Decimal(14, 4)
  total                Decimal        @db.Decimal(14, 4)
  paidTotal            Decimal        @default(0) @db.Decimal(14, 4)
  balanceDue           Decimal        @default(0) @db.Decimal(14, 4)
  purchaseDate         DateTime       @default(now())
  userId               String
  notes                String?
  voidedAt             DateTime?
  voidReason           String?
  reversalOfPurchaseId String?        @unique

  company            Company   @relation(fields: [companyId], references: [id])
  supplier           Supplier  @relation(fields: [supplierId], references: [id])
  warehouse          Warehouse @relation(fields: [warehouseId], references: [id])
  user               User      @relation(fields: [userId], references: [id])
  reversalOfPurchase Purchase? @relation("PurchaseReversal", fields: [reversalOfPurchaseId], references: [id])
  reversedByPurchase Purchase? @relation("PurchaseReversal")

  items    PurchaseItem[]
  payments PurchasePayment[]
  payable  AccountPayable?

  @@unique([companyId, number])
  @@index([companyId, purchaseDate])
  @@map("purchases")
}

model PurchaseItem {
  id               String  @id @default(cuid())
  purchaseId       String
  productVariantId String
  quantity         Int
  unitCost         Decimal @db.Decimal(14, 4)
  subtotal         Decimal @db.Decimal(14, 4)

  purchase       Purchase        @relation(fields: [purchaseId], references: [id])
  variant        ProductVariant  @relation(fields: [productVariantId], references: [id])
  inventoryUnits InventoryUnit[]

  @@index([purchaseId])
  @@map("purchase_items")
}

model PurchasePayment {
  id                     String   @id @default(cuid())
  purchaseId             String
  accountId              String
  amount                 Decimal  @db.Decimal(14, 4)
  paymentDate            DateTime @default(now())
  reference              String?
  financialTransactionId String?  @unique

  purchase             Purchase              @relation(fields: [purchaseId], references: [id])
  account              Account               @relation(fields: [accountId], references: [id])
  financialTransaction FinancialTransaction? @relation(fields: [financialTransactionId], references: [id])

  @@index([purchaseId])
  @@map("purchase_payments")
}

// ============================================================
// CUENTAS DE DINERO Y MOVIMIENTOS FINANCIEROS
// ============================================================

enum AccountType {
  CASH
  BANK
  WALLET
  POS
  OTHER
}

model Account {
  id         String      @id @default(cuid())
  companyId  String
  name       String
  type       AccountType
  currencyId String
  balance    Decimal     @default(0) @db.Decimal(14, 4) // caché; solo se escribe junto al FinancialTransaction que lo origina
  isActive   Boolean     @default(true)
  createdAt  DateTime    @default(now())

  company  Company  @relation(fields: [companyId], references: [id])
  currency Currency @relation(fields: [currencyId], references: [id])

  transactions       FinancialTransaction[]
  salePayments       SalePayment[]
  purchasePayments   PurchasePayment[]
  expenses           Expense[]
  receivablePayments ReceivablePayment[]
  payablePayments    PayablePayment[]

  @@unique([companyId, name])
  @@map("accounts")
}

enum FinancialTransactionType {
  SALE_INCOME
  RECEIVABLE_PAYMENT
  PURCHASE_PAYMENT
  PAYABLE_PAYMENT
  EXPENSE
  TRANSFER_IN
  TRANSFER_OUT
  CAPITAL_CONTRIBUTION
  WITHDRAWAL
  ADJUSTMENT
  OTHER_INCOME
  OTHER_EXPENSE
}

model FinancialTransaction {
  id                  String                   @id @default(cuid())
  companyId           String
  accountId           String
  type                FinancialTransactionType
  amount              Decimal                  @db.Decimal(14, 4) // positivo = entra, negativo = sale
  balanceBefore       Decimal                  @db.Decimal(14, 4)
  balanceAfter        Decimal                  @db.Decimal(14, 4)
  relatedDocumentType String?
  relatedDocumentId   String?
  transferGroupId     String?
  description         String?
  reference           String?
  userId              String?
  transactionDate     DateTime                 @default(now())

  company Company @relation(fields: [companyId], references: [id])
  account Account @relation(fields: [accountId], references: [id])
  user    User?   @relation(fields: [userId], references: [id])

  salePayment       SalePayment?
  purchasePayment   PurchasePayment?
  receivablePayment ReceivablePayment?
  payablePayment    PayablePayment?
  expense           Expense?

  @@index([companyId, accountId, transactionDate])
  @@index([transferGroupId])
  @@map("financial_transactions")
}

// ============================================================
// GASTOS
// ============================================================

enum ExpenseType {
  FIXED
  VARIABLE
}

model ExpenseCategory {
  id        String  @id @default(cuid())
  companyId String
  name      String
  isActive  Boolean @default(true)

  company  Company   @relation(fields: [companyId], references: [id])
  expenses Expense[]

  @@unique([companyId, name])
  @@map("expense_categories")
}

model Expense {
  id                     String      @id @default(cuid())
  companyId              String
  description            String
  expenseCategoryId      String
  type                   ExpenseType @default(VARIABLE)
  amount                 Decimal     @db.Decimal(14, 4)
  expenseDate            DateTime    @default(now())
  accountId              String
  supplierId             String?
  receiptUrl             String?
  notes                  String?
  userId                 String
  financialTransactionId String?     @unique

  company              Company               @relation(fields: [companyId], references: [id])
  category             ExpenseCategory       @relation(fields: [expenseCategoryId], references: [id])
  account              Account               @relation(fields: [accountId], references: [id])
  supplier             Supplier?             @relation(fields: [supplierId], references: [id])
  user                 User                  @relation(fields: [userId], references: [id])
  financialTransaction FinancialTransaction? @relation(fields: [financialTransactionId], references: [id])

  @@index([companyId, expenseDate])
  @@map("expenses")
}

// ============================================================
// CUENTAS POR COBRAR / POR PAGAR
// ============================================================

enum ReceivableStatus {
  PENDING
  PARTIAL
  PAID
  OVERDUE
}

model AccountReceivable {
  id          String           @id @default(cuid())
  companyId   String
  customerId  String
  saleId      String           @unique
  totalAmount Decimal          @db.Decimal(14, 4)
  paidAmount  Decimal          @default(0) @db.Decimal(14, 4)
  balance     Decimal          @db.Decimal(14, 4)
  issueDate   DateTime         @default(now())
  dueDate     DateTime?
  status      ReceivableStatus @default(PENDING)

  customer Customer @relation(fields: [customerId], references: [id])
  sale     Sale     @relation(fields: [saleId], references: [id])
  payments ReceivablePayment[]

  @@index([companyId, customerId])
  @@index([companyId, status])
  @@map("accounts_receivable")
}

model ReceivablePayment {
  id                     String   @id @default(cuid())
  accountReceivableId     String
  amount                 Decimal  @db.Decimal(14, 4)
  paymentDate            DateTime @default(now())
  accountId              String
  userId                 String
  financialTransactionId String?  @unique

  receivable           AccountReceivable     @relation(fields: [accountReceivableId], references: [id])
  account              Account               @relation(fields: [accountId], references: [id])
  user                 User                  @relation(fields: [userId], references: [id])
  financialTransaction FinancialTransaction? @relation(fields: [financialTransactionId], references: [id])

  @@index([accountReceivableId])
  @@map("receivable_payments")
}

enum PayableStatus {
  PENDING
  PARTIAL
  PAID
  OVERDUE
}

model AccountPayable {
  id          String        @id @default(cuid())
  companyId   String
  supplierId  String
  purchaseId  String        @unique
  totalAmount Decimal       @db.Decimal(14, 4)
  paidAmount  Decimal       @default(0) @db.Decimal(14, 4)
  balance     Decimal       @db.Decimal(14, 4)
  issueDate   DateTime      @default(now())
  dueDate     DateTime?
  status      PayableStatus @default(PENDING)

  supplier Supplier @relation(fields: [supplierId], references: [id])
  purchase Purchase @relation(fields: [purchaseId], references: [id])
  payments PayablePayment[]

  @@index([companyId, supplierId])
  @@index([companyId, status])
  @@map("accounts_payable")
}

model PayablePayment {
  id                     String   @id @default(cuid())
  accountPayableId       String
  amount                 Decimal  @db.Decimal(14, 4)
  paymentDate            DateTime @default(now())
  accountId              String
  userId                 String
  financialTransactionId String?  @unique

  payable              AccountPayable        @relation(fields: [accountPayableId], references: [id])
  account              Account               @relation(fields: [accountId], references: [id])
  user                 User                  @relation(fields: [userId], references: [id])
  financialTransaction FinancialTransaction? @relation(fields: [financialTransactionId], references: [id])

  @@index([accountPayableId])
  @@map("payable_payments")
}
```

## Notas de valorización y reportes (derivadas, sin tablas nuevas)

- **Valor de inventario:** `Σ(InventoryBalance.quantity × averageCost)` +
  `Σ(InventoryUnit.cost)` donde `status IN (AVAILABLE, RESERVED)`.
- **Capital disponible:** `Σ(Account.balance)` (por moneda; en MVP solo USD).
- **Cuentas por cobrar / pagar:** `Σ(balance)` de `AccountReceivable` /
  `AccountPayable` con `status != PAID`.
- **Activos controlados:** disponible + inventario + por cobrar (sección 43
  del brief) — todo se computa on-the-fly con queries agregadas indexadas;
  no requiere tablas de snapshot en el MVP. Si el volumen crece, se añade
  una tabla de snapshot diario (`DailySnapshot`) sin afectar el resto del
  modelo.
- **Rentabilidad / producto más vendido / inventario lento:** agregaciones
  sobre `SaleItem` (unidades, ingresos, costo, utilidad) y sobre
  `InventoryMovement`/`InventoryUnit`/`InventoryBalance` (última venta,
  antigüedad de stock), filtradas y agrupadas por producto/categoría/marca.
