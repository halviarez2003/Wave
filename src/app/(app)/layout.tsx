import { requireSession } from "@/lib/dal";
import { Button } from "@/components/ui/button";

import { logout } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-border flex items-center justify-between border-b px-6 py-3">
        <div className="flex flex-col leading-tight">
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
      </header>
      {children}
    </div>
  );
}
