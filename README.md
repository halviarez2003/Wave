# Wave

Sistema administrativo para negocio de venta de celulares y electrónica
(inventario, costos, ventas, cuentas por cobrar/pagar y rentabilidad).

Ver `docs/01-arquitectura.md` y `docs/02-modelo-de-datos.md` para el diseño
completo. Este README cubre solo cómo correr el proyecto.

## Requisitos

- Node.js 20+
- PostgreSQL 16 corriendo localmente (o `DATABASE_URL` a una instancia remota)

## Setup

```bash
npm install
cp .env.example .env   # y ajusta DATABASE_URL si tu Postgres no usa esas credenciales
npm run db:migrate     # crea el esquema
npm run db:seed        # siembra una empresa de ejemplo (TecnoMóvil Demo)
npm run dev
```

Abre http://localhost:3000 — deberías ver la empresa sembrada, sus roles,
categorías y cuentas de dinero con saldo inicial.

Login de la empresa de ejemplo (una vez exista el módulo de autenticación,
Fase 5): `admin@wave.test` / `admin1234`.

## Scripts

| Comando             | Qué hace                                   |
| -------------------- | ------------------------------------------- |
| `npm run dev`        | servidor de desarrollo (Turbopack)          |
| `npm run build`      | build de producción                          |
| `npm run lint`       | ESLint                                       |
| `npm run db:migrate` | `prisma migrate dev`                         |
| `npm run db:seed`    | corre `prisma/seed.ts`                       |
| `npm run db:studio`  | `prisma studio` (explorar la BD visualmente) |

## Estado del proyecto

Fase 4 (creación del proyecto) completa: Next.js + TypeScript estricto +
Tailwind + shadcn/ui, Prisma contra PostgreSQL con el esquema completo
migrado, cliente Prisma con scoping multi-tenant (`src/lib/prisma.ts`),
catálogo de permisos (`src/lib/permissions.ts`) y seed de una empresa de
ejemplo. Las fases siguientes (auth, productos, inventario, compras,
ventas, cuentas, dashboard, reportes) se construyen sobre esta base.
