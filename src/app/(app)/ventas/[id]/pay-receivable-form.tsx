"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { payReceivableAction } from "@/server/modules/sales/actions";

type Account = { id: string; name: string };

export function PayReceivableForm({
  saleId,
  receivableId,
  balance,
  accounts,
}: {
  saleId: string;
  receivableId: string;
  balance: number;
  accounts: Account[];
}) {
  const [state, action, pending] = useActionState(payReceivableAction, undefined);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");

  return (
    <form action={action} className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="receivableId" value={receivableId} />
      <input type="hidden" name="accountId" value={accountId} />

      <p className="text-sm font-medium">Registrar cobro (saldo: ${balance.toFixed(2)})</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Cuenta</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Monto</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            max={balance}
            defaultValue={balance.toFixed(2)}
            required
          />
        </div>
      </div>

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state?.success && <p className="text-success text-sm">{state.success}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Registrando..." : "Registrar cobro"}
      </Button>
    </form>
  );
}
