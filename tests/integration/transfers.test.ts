import { beforeAll, describe, expect, it } from "vitest";

import * as financeService from "@/server/modules/finance/service";
import { transferSchema } from "@/server/modules/finance/schema";
import { createSecondAccount, createTestContext, type TestContext } from "../fixtures";

describe("transferencias entre cuentas", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it("mueve dinero entre cuentas propias, comparte transferGroupId y no genera ventas ni utilidad", async () => {
    const toAccount = await createSecondAccount(ctx, "Cta destino transferencia");

    const result = await financeService.transferBetweenAccounts(ctx.db, ctx.companyId, ctx.userId, {
      fromAccountId: ctx.accountId,
      toAccountId: toAccount.id,
      amount: 100,
    });

    expect(result.transferGroupId).toBeTruthy();

    const pair = await ctx.db.financialTransaction.findMany({
      where: { transferGroupId: result.transferGroupId! },
      orderBy: { type: "asc" },
    });
    expect(pair).toHaveLength(2);
    expect(pair.map((p) => p.type).sort()).toEqual(["TRANSFER_IN", "TRANSFER_OUT"]);
    expect(pair.map((p) => Number(p.amount)).sort((a, b) => a - b)).toEqual([-100, 100]);

    const fromAccount = await ctx.db.account.findUniqueOrThrow({ where: { id: ctx.accountId } });
    const reloadedToAccount = await ctx.db.account.findUniqueOrThrow({ where: { id: toAccount.id } });
    expect(Number(fromAccount.balance)).toBe(-100); // la cuenta test parte en 0
    expect(Number(reloadedToAccount.balance)).toBe(100);

    // Una transferencia nunca es una venta: no debe existir ningún Sale ni
    // afectar ninguna cifra de utilidad de la empresa.
    const salesCount = await ctx.db.sale.count();
    expect(salesCount).toBe(0);
  });

  it("el schema rechaza transferir de una cuenta a sí misma", () => {
    const result = transferSchema.safeParse({
      fromAccountId: ctx.accountId,
      toAccountId: ctx.accountId,
      amount: 10,
    });
    expect(result.success).toBe(false);
  });
});
