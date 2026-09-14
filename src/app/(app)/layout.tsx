import Link from "next/link";

import { requireSession } from "@/lib/dal";
import { Button } from "@/components/ui/button";

import { logout } from "./actions";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/inventario/productos", label: "Productos" },
  { href: "/inventario/categorias", label: "Categorías" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-border flex items-center justify-between gap-4 border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold">Wave</span>
          <nav className="flex gap-4">
            {NAV_LINKS.map((link) => (
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
