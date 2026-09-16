import bcrypt from "bcryptjs";

import type { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, SEED_ROLES } from "../src/lib/permissions";

const CATEGORIES: Array<{
  name: string;
  icon: string;
  attributes?: Array<{
    key: string;
    label: string;
    dataType: "TEXT" | "NUMBER" | "BOOLEAN" | "DATE" | "SELECT";
    options?: string[];
    isRequired?: boolean;
    showInList?: boolean;
  }>;
}> = [
  {
    name: "Celulares",
    icon: "smartphone",
    attributes: [
      { key: "brand", label: "Marca", dataType: "TEXT", showInList: true },
      { key: "model", label: "Modelo", dataType: "TEXT", showInList: true },
      { key: "capacity", label: "Capacidad", dataType: "TEXT", showInList: true },
      { key: "color", label: "Color", dataType: "TEXT" },
      {
        key: "condition",
        label: "Condición",
        dataType: "SELECT",
        options: ["Nuevo", "Usado", "Reacondicionado"],
        isRequired: true,
        showInList: true,
      },
      { key: "battery_percent", label: "Batería (%)", dataType: "NUMBER" },
      { key: "imei", label: "IMEI", dataType: "TEXT", isRequired: true, showInList: true },
      { key: "imei2", label: "IMEI 2", dataType: "TEXT" },
      { key: "serial", label: "Serial", dataType: "TEXT" },
      { key: "carrier", label: "Operador", dataType: "TEXT" },
      { key: "unlocked", label: "Liberado", dataType: "BOOLEAN" },
    ],
  },
  {
    name: "Consolas",
    icon: "gamepad-2",
    attributes: [
      { key: "brand", label: "Marca", dataType: "TEXT", showInList: true },
      { key: "model", label: "Modelo", dataType: "TEXT", showInList: true },
      { key: "version", label: "Versión", dataType: "TEXT" },
      { key: "capacity", label: "Capacidad", dataType: "TEXT" },
      { key: "color", label: "Color", dataType: "TEXT" },
      { key: "serial", label: "Serial", dataType: "TEXT" },
      {
        key: "condition",
        label: "Condición",
        dataType: "SELECT",
        options: ["Nuevo", "Usado", "Reacondicionado"],
        showInList: true,
      },
    ],
  },
  {
    name: "Controles",
    icon: "gamepad",
    attributes: [
      { key: "brand", label: "Marca", dataType: "TEXT", showInList: true },
      { key: "model_compatible", label: "Modelo compatible", dataType: "TEXT" },
      { key: "color", label: "Color", dataType: "TEXT" },
    ],
  },
  {
    name: "Forros",
    icon: "shield",
    attributes: [
      { key: "brand", label: "Marca", dataType: "TEXT" },
      { key: "model_compatible", label: "Modelo compatible", dataType: "TEXT", showInList: true },
      { key: "color", label: "Color", dataType: "TEXT", showInList: true },
      { key: "material", label: "Material", dataType: "TEXT" },
    ],
  },
  {
    name: "Cargadores",
    icon: "plug",
    attributes: [
      { key: "brand", label: "Marca", dataType: "TEXT" },
      { key: "power", label: "Potencia", dataType: "TEXT", showInList: true },
      { key: "connector", label: "Tipo de conector", dataType: "TEXT", showInList: true },
      { key: "color", label: "Color", dataType: "TEXT" },
    ],
  },
  { name: "Cables", icon: "cable" },
  { name: "Audífonos", icon: "headphones" },
  { name: "Protectores de pantalla", icon: "shield-check" },
  {
    name: "Ventiladores",
    icon: "fan",
    attributes: [
      { key: "brand", label: "Marca", dataType: "TEXT" },
      { key: "model", label: "Modelo", dataType: "TEXT" },
      { key: "power", label: "Potencia", dataType: "TEXT" },
      { key: "voltage", label: "Voltaje", dataType: "TEXT" },
      { key: "color", label: "Color", dataType: "TEXT" },
    ],
  },
  { name: "Parlantes", icon: "speaker" },
  { name: "Power banks", icon: "battery-charging" },
  { name: "Tablets", icon: "tablet" },
  { name: "Computadoras", icon: "laptop" },
  { name: "Relojes inteligentes", icon: "watch" },
  { name: "Accesorios electrónicos", icon: "cpu" },
  { name: "Otros", icon: "package" },
];

const EXPENSE_CATEGORIES = ["Alquiler", "Servicios", "Nómina", "Marketing", "Otros"];

export async function seedDatabase(prisma: PrismaClient) {
  const usd = await prisma.currency.upsert({
    where: { code: "USD" },
    update: {},
    create: { code: "USD", name: "Dólar estadounidense", symbol: "$" },
  });

  const company = await prisma.company.upsert({
    where: { id: "wave-demo-company" },
    update: {},
    create: {
      id: "wave-demo-company",
      name: "TecnoMóvil Demo",
      baseCurrencyId: usd.id,
    },
  });

  await prisma.warehouse.upsert({
    where: { companyId_name: { companyId: company.id, name: "Principal" } },
    update: {},
    create: { companyId: company.id, name: "Principal", isDefault: true },
  });

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  const roleIds: Record<string, string> = {};
  for (const roleName of SEED_ROLES) {
    const role = await prisma.role.upsert({
      where: { companyId_name: { companyId: company.id, name: roleName } },
      update: {},
      create: { companyId: company.id, name: roleName, isSystem: true },
    });
    roleIds[roleName] = role.id;

    const codes = DEFAULT_ROLE_PERMISSIONS[roleName];
    const permissions = await prisma.permission.findMany({
      where: { code: { in: codes } },
    });
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const adminPasswordHash = await bcrypt.hash("admin1234", 10);
  await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: "admin@wave.test" } },
    update: {},
    create: {
      companyId: company.id,
      roleId: roleIds.ADMIN,
      email: "admin@wave.test",
      name: "Administradora Wave",
      passwordHash: adminPasswordHash,
    },
  });

  for (const category of CATEGORIES) {
    const created = await prisma.category.upsert({
      where: { companyId_name: { companyId: company.id, name: category.name } },
      update: {},
      create: { companyId: company.id, name: category.name, icon: category.icon },
    });

    for (const [index, attribute] of (category.attributes ?? []).entries()) {
      await prisma.attributeDefinition.upsert({
        where: { categoryId_key: { categoryId: created.id, key: attribute.key } },
        update: {},
        create: {
          companyId: company.id,
          categoryId: created.id,
          key: attribute.key,
          label: attribute.label,
          dataType: attribute.dataType,
          options: attribute.options ?? undefined,
          isRequired: attribute.isRequired ?? false,
          showInList: attribute.showInList ?? false,
          sortOrder: index,
        },
      });
    }
  }

  for (const name of EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: {},
      create: { companyId: company.id, name },
    });
  }

  const openingBalances: Array<{ name: string; type: "CASH" | "BANK" | "WALLET"; amount: string }> = [
    { name: "Caja", type: "CASH", amount: "500.00" },
    { name: "Banco", type: "BANK", amount: "2000.00" },
    { name: "Zelle", type: "WALLET", amount: "300.00" },
  ];

  for (const opening of openingBalances) {
    const existing = await prisma.account.findUnique({
      where: { companyId_name: { companyId: company.id, name: opening.name } },
    });
    if (existing) continue;

    await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          companyId: company.id,
          name: opening.name,
          type: opening.type,
          currencyId: usd.id,
          balance: opening.amount,
        },
      });
      await tx.financialTransaction.create({
        data: {
          companyId: company.id,
          accountId: account.id,
          type: "CAPITAL_CONTRIBUTION",
          amount: opening.amount,
          balanceBefore: "0",
          balanceAfter: opening.amount,
          description: "Aporte de capital inicial (seed)",
        },
      });
    });
  }

  for (const type of ["SALE", "PURCHASE"] as const) {
    await prisma.documentSequence.upsert({
      where: { companyId_type: { companyId: company.id, type } },
      update: {},
      create: { companyId: company.id, type, nextNumber: 1 },
    });
  }

  return { companyId: company.id, companyName: company.name };
}
