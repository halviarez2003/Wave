import { describe, expect, it } from "vitest";

import { daysOverdue, defaultDueDate, effectiveStatus } from "@/server/modules/shared/credit-terms";

describe("credit-terms", () => {
  it("defaultDueDate agrega 30 días a la fecha dada", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const due = defaultDueDate(from);
    expect(due.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("effectiveStatus no cambia el status guardado si el saldo ya está en cero", () => {
    const pastDue = new Date("2020-01-01");
    expect(effectiveStatus("PAID", 0, pastDue)).toBe("PAID");
  });

  it("effectiveStatus devuelve OVERDUE si hay saldo y la fecha de vencimiento ya pasó", () => {
    const pastDue = new Date(Date.now() - 5 * 86_400_000);
    expect(effectiveStatus("PARTIAL", 50, pastDue)).toBe("OVERDUE");
  });

  it("effectiveStatus respeta el status guardado si todavía no vence", () => {
    const futureDue = new Date(Date.now() + 5 * 86_400_000);
    expect(effectiveStatus("PENDING", 50, futureDue)).toBe("PENDING");
  });

  it("effectiveStatus respeta el status guardado si no hay dueDate", () => {
    expect(effectiveStatus("PENDING", 50, null)).toBe("PENDING");
  });

  it("daysOverdue cuenta los días completos desde el vencimiento", () => {
    const due = new Date(Date.now() - 3 * 86_400_000 - 1000);
    expect(daysOverdue(due)).toBeGreaterThanOrEqual(3);
  });

  it("daysOverdue es 0 si todavía no vence o no hay dueDate", () => {
    expect(daysOverdue(new Date(Date.now() + 86_400_000))).toBe(0);
    expect(daysOverdue(null)).toBe(0);
  });
});
