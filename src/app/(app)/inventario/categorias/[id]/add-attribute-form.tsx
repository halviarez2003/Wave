"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { createAttributeDefinitionAction } from "@/server/modules/catalog/actions";

const DATA_TYPES = [
  { value: "TEXT", label: "Texto" },
  { value: "NUMBER", label: "Número" },
  { value: "BOOLEAN", label: "Sí/No" },
  { value: "DATE", label: "Fecha" },
  { value: "SELECT", label: "Lista de opciones" },
] as const;

export function AddAttributeForm({ categoryId }: { categoryId: string }) {
  const [state, action, pending] = useActionState(createAttributeDefinitionAction, undefined);
  const [dataType, setDataType] = useState<string>("TEXT");

  return (
    <form action={action} className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="dataType" value={dataType} />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="key">Clave</Label>
          <Input id="key" name="key" placeholder="battery_percent" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="label">Etiqueta</Label>
          <Input id="label" name="label" placeholder="Batería (%)" required />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Tipo de dato</Label>
        <Select value={dataType} onValueChange={setDataType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATA_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dataType === "SELECT" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="options">Opciones (separadas por coma)</Label>
          <Input id="options" name="options" placeholder="Nuevo, Usado, Reacondicionado" />
        </div>
      )}

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isRequired" />
          Requerido
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="showInList" />
          Mostrar en listas
        </label>
      </div>

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Agregando..." : "Agregar atributo"}
      </Button>
    </form>
  );
}
