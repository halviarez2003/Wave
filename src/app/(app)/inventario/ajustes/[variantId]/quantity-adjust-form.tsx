"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { adjustQuantityAction } from "@/server/modules/inventory/actions";

type Warehouse = { id: string; name: string };

export function QuantityAdjustForm({
  variantId,
  warehouses,
}: {
  variantId: string;
  warehouses: Warehouse[];
}) {
  const [state, action, pending] = useActionState(adjustQuantityAction, undefined);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");

  return (
    <form action={action} className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="warehouseId" value={warehouseId} />
      <input type="hidden" name="direction" value={direction} />

      <p className="text-sm font-medium">Ajuste manual de cantidad</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Almacén</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
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
          <Label htmlFor="quantity">Cantidad</Label>
          <Input id="quantity" name="quantity" type="number" min="1" step="1" required />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={direction === "IN" ? "default" : "outline"}
          size="sm"
          onClick={() => setDirection("IN")}
        >
          Entrada (+)
        </Button>
        <Button
          type="button"
          variant={direction === "OUT" ? "default" : "outline"}
          size="sm"
          onClick={() => setDirection("OUT")}
        >
          Salida (-)
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason">Motivo</Label>
        <Input id="reason" name="reason" required placeholder="Conteo físico, merma, corrección..." />
      </div>

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state?.success && <p className="text-success text-sm">{state.success}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Aplicando..." : "Aplicar ajuste"}
      </Button>
    </form>
  );
}
