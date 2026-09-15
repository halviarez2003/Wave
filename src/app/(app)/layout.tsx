import Link from "next/link";

import { hasPermission, requireSession } from "@/lib/dal";
import { Button } from "@/components/ui/button";

import { logout } from "./actions";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/inventario/productos", label: "Productos" },
  { href: "/inventario/categorias", label: "Categorías" },
  { href: "/inventario/movimientos", label: "Movimientos" },
  { href: "/inventario/kardex", label: "Kardex" },
  { href: "/inventario/ajustes", label: "Ajustes" },
  { href: "/inventario/almacenes", label: "Almacenes" },
  { href: "/compras", label: "Compras" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/ventas", label: "Ventas" },
  { href: "/clientes", label: "Clientes" },
  { href: "/cuentas", label: "Cuentas" },
  { href: "/gastos", label: "Gastos" },
  { href: "/reportes", label: "Reportes" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const showConfig = hasPermission(session, "users.manage") || hasPermission(session, "settings.manage");
  const navLinks = showConfig ? [...NAV_LINKS, { href: "/configuracion", label: "Configuración" }] : NAV_LINKS;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-sm font-semibold">Wave</span>
          <nav className="flex flex-wrap gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground text-sm hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col text-right leading-tight">
            <span className="text-sm font-medium">{session.user.companyName}</span>
            <span className="text-muted-foreground text-xs">
              {session.user.name} · {session.user.roleName}
            </span>
          </div>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
