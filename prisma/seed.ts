import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedDatabase } from "./seed-data";

const prisma = new PrismaClient();

seedDatabase(prisma)
  .then(({ companyName, companyId }) => {
    console.log("Seed completo:");
    console.log(`  Empresa: ${companyName} (${companyId})`);
    console.log("  Login admin: admin@wave.test / admin1234");
    console.log(
      "  Catálogo, categorías y cuentas listos. Productos, compras y ventas se sembrarán junto con esos módulos (Fases 6-9).",
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
