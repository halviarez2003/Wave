"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { transferStockAction } from "@/server/modules/inventory/actions";

type Warehouse = { id: string; name: string };

export function TransferForm({
  variantId,
  warehouses,
}: {
  variantId: string;
  warehouses: Warehouse[];
}) {
  const [state, action, pending] = useActionState(transferStockAction, undefined);
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[1]?.id ?? warehouses[0]?.id ?? "");

  return (
    <form action={action} className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="fromWarehouseId" value={fromWarehouseId} />
      <input type="hidden" name="toWarehouseId" value={toWarehouseId} />

      <p className="text-sm font-medium">Transferir entre almacenes</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Desde</Label>
          <Select value={fromWarehouseId} onValueChange={setFromWarehouseId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Hacia</Label>
          <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-quantity">Cantidad</Label>
          <Input id="t-quantity" name="quantity" type="number" min="1" step="1" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-reason">Motivo (opcional)</Label>
          <Input id="t-reason" name="reason" />
        </div>
      </div>

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state?.success && <p className="text-success text-sm">{state.success}</p>}

      <Button type="submit" disabled={pending || warehouses.length < 2} className="w-fit">
        {warehouses.length < 2 ? "Necesitas 2+ almacenes" : pending ? "Transfiriendo..." : "Transferir"}
      </Button>
    </form>
  );
}
