import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { PermissionCode } from "@/lib/permissions";

/**
 * Lee la sesión una vez por render (memoizada con React `cache`). No redirige
 * — úsala cuando `null` es un resultado válido (p. ej. en proxy.ts o para
 * mostrar UI distinta a usuarios anónimos).
 */
export const getSession = cache(async () => {
  return auth();
});

/**
 * Igual que `getSession`, pero redirige a /login si no hay sesión. Es el
 * punto de entrada recomendado para páginas, Server Actions y Route
 * Handlers que requieren un usuario autenticado (ver docs/01-arquitectura.md
 * sección 4.1 y la guía de autenticación de Next.js).
 */
export const requireSession = cache(async () => {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
});

export function hasPermission(
  session: { user: { permissions: string[] } } | null | undefined,
  code: PermissionCode,
) {
  return session?.user.permissions.includes(code) ?? false;
}

/**
 * Exige que la sesión tenga el permiso dado; redirige a `/` si no lo tiene.
 * Úsala en páginas/Server Actions que solo ciertos roles pueden ejecutar.
 */
export async function requirePermission(code: PermissionCode) {
  const session = await requireSession();
  if (!hasPermission(session, code)) {
    redirect("/");
  }
  return session;
}
