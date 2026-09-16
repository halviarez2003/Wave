"use client";

import { useActionState, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { createPurchaseAction } from "@/server/modules/purchases/actions";

type Variant = { id: string; label: string; categoryName: string };
type Party = { id: string; name: string };
type Account = { id: string; name: string };

type Row = { key: string; variantId: string; quantity: string; unitCost: string };

function emptyRow(defaultVariantId: string): Row {
  return { key: crypto.randomUUID(), variantId: defaultVariantId, quantity: "1", unitCost: "" };
}

export function PurchaseForm({
  suppliers,
  warehouses,
  accounts,
  variants,
}: {
  suppliers: Party[];
  warehouses: Party[];
  accounts: Account[];
  variants: Variant[];
}) {
  const formId = useId();
  const [state, action, pending] = useActionState(createPurchaseAction, undefined);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [paymentAccountId, setPaymentAccountId] = useState<string>("none");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([emptyRow(variants[0]?.id ?? "")]);

  const defaultDueDateValue = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitCost) || 0), 0),
    [rows],
  );

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  function handleSubmit(formData: FormData) {
    const items = rows
      .filter((r) => r.variantId && r.quantity && r.unitCost)
      .map((r) => ({
        variantId: r.variantId,
        quantity: Number(r.quantity),
        unitCost: Number(r.unitCost),
      }));
    formData.set("itemsJson", JSON.stringify(items));
    if (paymentAccountId !== "none") formData.set("paymentAccountId", paymentAccountId);
    return action(formData);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="supplierId" value={supplierId} />
      <input type="hidden" name="warehouseId" value={warehouseId} />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Proveedor</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {warehouses.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label>Almacén de destino</Label>
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
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="p-1.5">Producto</th>
              <th className="p-1.5">Cantidad</th>
              <th className="p-1.5">Costo unit.</th>
              <th className="p-1.5">Subtotal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="p-1">
                  <select
                    value={row.variantId}
                    onChange={(e) => updateRow(row.key, { variantId: e.target.value })}
                    className="border-input h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                  >
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} ({v.categoryName})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                    className="h-8 w-20"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.unitCost}
                    onChange={(e) => updateRow(row.key, { unitCost: e.target.value })}
                    className="h-8 w-24"
                  />
                </td>
                <td className="p-1 tabular-nums text-sm">
                  ${((Number(row.quantity) || 0) * (Number(row.unitCost) || 0)).toFixed(2)}
                </td>
                <td className="p-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(row.key)}>
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
        onClick={() => setRows((prev) => [...prev, emptyRow(variants[0]?.id ?? "")])}
      >
        + Agregar producto
      </Button>

      <div className="border-border flex items-center justify-between rounded-lg border p-4">
        <span className="text-sm font-medium">Total</span>
        <span className="text-lg font-semibold tabular-nums">${total.toFixed(2)}</span>
      </div>

      <div className="border-border grid grid-cols-2 gap-4 rounded-lg border p-4">
        <div className="flex flex-col gap-1.5">
          <Label>Pago inicial (opcional)</Label>
          <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin pago — a crédito</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {paymentAccountId !== "none" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-paymentAmount`}>Monto pagado</Label>
            <Input
              id={`${formId}-paymentAmount`}
              name="paymentAmount"
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount || total.toFixed(2)}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
          </div>
        )}
      </div>

      {total - (paymentAccountId !== "none" ? Number(paymentAmount || total) : 0) > 0.004 && (
        <div className="border-border flex items-center justify-between gap-4 rounded-lg border p-4">
          <Label htmlFor="dueDate">Vence el</Label>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={defaultDueDateValue} className="h-8 w-40" />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-notes`}>Notas (opcional)</Label>
        <Input id={`${formId}-notes`} name="notes" />
      </div>

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Registrando..." : "Registrar compra"}
      </Button>
    </form>
  );
}
