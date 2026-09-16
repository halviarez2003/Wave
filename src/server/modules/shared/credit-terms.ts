import "server-only";

/**
 * Plazo de crédito por defecto cuando una venta/compra queda con saldo y
 * no se especifica una fecha de vencimiento explícita. No hay todavía un
 * campo de "días de crédito" por cliente/proveedor — se usa un único
 * plazo global hasta que ese requisito aparezca.
 */
export const DEFAULT_CREDIT_TERM_DAYS = 30;

export function defaultDueDate(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + DEFAULT_CREDIT_TERM_DAYS);
  return d;
}

/**
 * El estado OVERDUE nunca se escribe en la base de datos (evitaría
 * necesitar un cron para mantenerlo al día); se deriva en el momento de
 * leer, comparando balance y dueDate contra "ahora".
 */
export function effectiveStatus<S extends string>(
  storedStatus: S,
  balance: number,
  dueDate: Date | null,
  now: Date = new Date(),
): S | "OVERDUE" {
  if (balance <= 0) return storedStatus;
  if (dueDate && dueDate.getTime() < now.getTime()) return "OVERDUE";
  return storedStatus;
}

export function daysOverdue(dueDate: Date | null, now: Date = new Date()): number {
  if (!dueDate) return 0;
  const diffMs = now.getTime() - dueDate.getTime();
  return diffMs > 0 ? Math.floor(diffMs / 86_400_000) : 0;
}
