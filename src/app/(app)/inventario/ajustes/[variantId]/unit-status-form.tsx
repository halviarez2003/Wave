"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { adjustUnitStatusAction } from "@/server/modules/inventory/actions";

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Disponible" },
  { value: "RESERVED", label: "Reservado" },
  { value: "LAYAWAY", label: "Apartado" },
  { value: "IN_REPAIR", label: "En reparación" },
  { value: "DAMAGED", label: "Dañado" },
  { value: "RETURNED", label: "Devuelto" },
] as const;

export function UnitStatusForm({
  unitId,
  variantId,
  currentStatus,
}: {
  unitId: string;
  variantId: string;
  currentStatus: string;
}) {
  const [state, action, pending] = useActionState(adjustUnitStatusAction, undefined);
  const [status, setStatus] = useState(currentStatus);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="status" value={status} />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" variant="outline" disabled={pending || status === currentStatus}>
        Guardar
      </Button>
      {state?.error && <span className="text-destructive text-xs">{state.error}</span>}
    </form>
  );
}
