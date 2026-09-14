"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { addSerializedUnitsAction } from "@/server/modules/inventory/actions";


type Row = {
  key: string;
  imei1: string;
  imei2: string;
  serial: string;
  condition: "NEW" | "USED" | "REFURBISHED";
  batteryPercent: string;
  color: string;
  capacity: string;
  cost: string;
  suggestedPrice: string;
};

function emptyRow(defaults: Partial<Row>): Row {
  return {
    key: crypto.randomUUID(),
    imei1: "",
    imei2: "",
    serial: "",
    condition: "NEW",
    batteryPercent: "",
    color: "",
    capacity: "",
    cost: "",
    suggestedPrice: "",
    ...defaults,
  };
}

type Warehouse = { id: string; name: string };

export function AddUnitsForm({
  variantId,
  warehouses,
  purchaseId,
  purchaseItemId,
  defaultCost,
}: {
  variantId: string;
  warehouses: Warehouse[];
  purchaseId?: string;
  purchaseItemId?: string;
  defaultCost?: string;
}) {
  const formId = useId();
  const [state, action, pending] = useActionState(addSerializedUnitsAction, undefined);
  const [rows, setRows] = useState<Row[]>([emptyRow({ cost: defaultCost ?? "" })]);
  const [pasteText, setPasteText] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  function applyPaste() {
    const lines = pasteText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed = lines.map((line) => {
      const [imei1 = "", color = "", batteryPercent = "", cost = ""] = line.split("\t");
      return emptyRow({ imei1, color, batteryPercent, cost });
    });
    if (parsed.length > 0) {
      setRows((prev) => [...prev.filter((r) => r.imei1 || r.cost), ...parsed]);
      setPasteText("");
    }
  }

  function handleSubmit(formData: FormData) {
    const units = rows
      .filter((r) => r.imei1 || r.imei2 || r.serial)
      .map((r) => ({
        imei1: r.imei1 || undefined,
        imei2: r.imei2 || undefined,
        serial: r.serial || undefined,
        condition: r.condition,
        batteryPercent: r.batteryPercent ? Number(r.batteryPercent) : undefined,
        color: r.color || undefined,
        capacity: r.capacity || undefined,
        cost: r.cost ? Number(r.cost) : 0,
        suggestedPrice: r.suggestedPrice ? Number(r.suggestedPrice) : undefined,
      }));
    formData.set("unitsJson", JSON.stringify(units));
    return action(formData);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="warehouseId" value={warehouseId} />
      {purchaseId && <input type="hidden" name="purchaseId" value={purchaseId} />}
      {purchaseItemId && <input type="hidden" name="purchaseItemId" value={purchaseItemId} />}

      <div className="flex flex-col gap-1.5 sm:w-48">
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
        <Label htmlFor={`${formId}-paste`}>Pegar desde Excel (IMEI, color, batería, costo)</Label>
        <textarea
          id={`${formId}-paste`}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={3}
          placeholder={"123456789\tNegro\t92\t340\n123456790\tAzul\t89\t330"}
          className="border-input rounded-md border bg-transparent px-3 py-2 text-sm font-mono"
        />
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={applyPaste}>
          Agregar filas pegadas
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table data-testid="unit-rows-table" className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="p-1.5">IMEI</th>
              <th className="p-1.5">IMEI 2</th>
              <th className="p-1.5">Serial</th>
              <th className="p-1.5">Condición</th>
              <th className="p-1.5">Batería %</th>
              <th className="p-1.5">Color</th>
              <th className="p-1.5">Capacidad</th>
              <th className="p-1.5">Costo</th>
              <th className="p-1.5">Precio sugerido</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="p-1">
                  <Input
                    value={row.imei1}
                    onChange={(e) => updateRow(row.key, { imei1: e.target.value })}
                    className="h-8 w-32"
                  />
                </td>
                <td className="p-1">
                  <Input
                    value={row.imei2}
                    onChange={(e) => updateRow(row.key, { imei2: e.target.value })}
                    className="h-8 w-32"
                  />
                </td>
                <td className="p-1">
                  <Input
                    value={row.serial}
                    onChange={(e) => updateRow(row.key, { serial: e.target.value })}
                    className="h-8 w-24"
                  />
                </td>
                <td className="p-1">
                  <Select
                    value={row.condition}
                    onValueChange={(v) => updateRow(row.key, { condition: v as Row["condition"] })}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">Nuevo</SelectItem>
                      <SelectItem value="USED">Usado</SelectItem>
                      <SelectItem value="REFURBISHED">Reacondicionado</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={row.batteryPercent}
                    onChange={(e) => updateRow(row.key, { batteryPercent: e.target.value })}
                    className="h-8 w-20"
                  />
                </td>
                <td className="p-1">
                  <Input
                    value={row.color}
                    onChange={(e) => updateRow(row.key, { color: e.target.value })}
                    className="h-8 w-24"
                  />
                </td>
                <td className="p-1">
                  <Input
                    value={row.capacity}
                    onChange={(e) => updateRow(row.key, { capacity: e.target.value })}
                    className="h-8 w-24"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.cost}
                    onChange={(e) => updateRow(row.key, { cost: e.target.value })}
                    className="h-8 w-24"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.suggestedPrice}
                    onChange={(e) => updateRow(row.key, { suggestedPrice: e.target.value })}
                    className="h-8 w-24"
                  />
                </td>
                <td className="p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(row.key)}
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() =>
          setRows((prev) => [
            ...prev,
            emptyRow({ condition: prev[0]?.condition, cost: defaultCost ?? "" }),
          ])
        }
      >
        + Agregar fila
      </Button>

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : `Agregar ${rows.length} unidad${rows.length === 1 ? "" : "es"}`}
      </Button>
    </form>
  );
}
