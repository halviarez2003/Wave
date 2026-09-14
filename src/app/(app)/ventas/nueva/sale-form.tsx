"use client";

import { useActionState, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { createSaleAction } from "@/server/modules/sales/actions";

type QuantityItem = {
  kind: "quantity";
  variantId: string;
  label: string;
  categoryName: string;
  unitPrice: number;
  searchText: string;
  balances: { warehouseId: string; warehouseName: string; quantity: number }[];
};

type SerializedItem = {
  kind: "unit";
  variantId: string;
  unitId: string;
  label: string;
  categoryName: string;
  unitPrice: number;
  searchText: string;
  warehouseId: string;
  warehouseName: string;
};

type Party = { id: string; name: string };

type CartLine = {
  key: string;
  kind: "quantity" | "unit";
  variantId: string;
  unitId?: string;
  label: string;
  quantity: number;
  maxQuantity?: number;
  unitPrice: number;
};

type PaymentLine = { key: string; accountId: string; amount: string };

export function SaleForm({
  customers,
  warehouses,
  accounts,
  quantityItems,
  serializedItems,
  canEditPrice,
}: {
  customers: Party[];
  warehouses: Party[];
  accounts: Party[];
  quantityItems: QuantityItem[];
  serializedItems: SerializedItem[];
  canEditPrice: boolean;
}) {
  const [state, action, pending] = useActionState(createSaleAction, undefined);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [customerId, setCustomerId] = useState<string>("none");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [payments, setPayments] = useState<PaymentLine[]>([]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const cartUnitIds = new Set(cart.map((l) => l.unitId).filter(Boolean));
    const q = query.toLowerCase();
    const qtyMatches = quantityItems
      .filter((i) => i.searchText.includes(q))
      .map((i) => ({ item: i, stock: i.balances.find((b) => b.warehouseId === warehouseId)?.quantity ?? 0 }))
      .filter((r) => r.stock > 0);
    const unitMatches = serializedItems.filter(
      (i) => i.searchText.includes(q) && i.warehouseId === warehouseId && !cartUnitIds.has(i.unitId),
    );
    return [
      ...qtyMatches.map((r) => ({ ...r.item, stock: r.stock })),
      ...unitMatches.map((i) => ({ ...i, stock: 1 })),
    ].slice(0, 8);
  }, [query, quantityItems, serializedItems, warehouseId, cart]);

  function addToCart(result: (QuantityItem | SerializedItem) & { stock: number }) {
    if (result.kind === "quantity") {
      const existing = cart.find((l) => l.kind === "quantity" && l.variantId === result.variantId);
      if (existing) {
        setCart((prev) =>
          prev.map((l) =>
            l.key === existing.key ? { ...l, quantity: Math.min(l.quantity + 1, result.stock) } : l,
          ),
        );
      } else {
        setCart((prev) => [
          ...prev,
          {
            key: crypto.randomUUID(),
            kind: "quantity",
            variantId: result.variantId,
            label: result.label,
            quantity: 1,
            maxQuantity: result.stock,
            unitPrice: result.unitPrice,
          },
        ]);
      }
    } else {
      setCart((prev) => [
        ...prev,
        {
          key: crypto.randomUUID(),
          kind: "unit",
          variantId: result.variantId,
          unitId: result.unitId,
          label: result.label,
          quantity: 1,
          unitPrice: result.unitPrice,
        },
      ]);
    }
    setQuery("");
  }

  function updateCartLine(key: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeCartLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function addPayment() {
    setPayments((prev) => [
      ...prev,
      { key: crypto.randomUUID(), accountId: accounts[0]?.id ?? "", amount: "" },
    ]);
  }

  function updatePayment(key: string, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function removePayment(key: string) {
    setPayments((prev) => prev.filter((p) => p.key !== key));
  }

  const subtotal = cart.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const paidTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const balanceDue = total - paidTotal;

  function handleSubmit(formData: FormData) {
    const items = cart.map((l) => ({
      variantId: l.variantId,
      unitId: l.unitId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }));
    const paymentLines = payments
      .filter((p) => p.accountId && Number(p.amount) > 0)
      .map((p) => ({ accountId: p.accountId, amount: Number(p.amount) }));

    formData.set("itemsJson", JSON.stringify(items));
    formData.set("paymentsJson", JSON.stringify(paymentLines));
    if (customerId !== "none") formData.set("customerId", customerId);
    return action(formData);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="warehouseId" value={warehouseId} />
      <input type="hidden" name="discount" value={discount} />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Almacén</Label>
          <Select
            value={warehouseId}
            onValueChange={(v) => {
              setWarehouseId(v);
              setCart([]);
            }}
          >
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
          <Label>Cliente (opcional)</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin cliente</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative flex flex-col gap-1.5">
        <Label htmlFor="search">Buscar producto, IMEI, serial, SKU...</Label>
        <Input
          id="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="iPhone, 123456789012345, cargador..."
        />
        {results.length > 0 && (
          <div className="border-border bg-popover absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg border shadow-md">
            {results.map((r) => (
              <button
                type="button"
                key={r.kind === "unit" ? r.unitId : r.variantId}
                onClick={() => addToCart(r)}
                className="hover:bg-accent flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm"
              >
                <span>{r.label}</span>
                <span className="text-muted-foreground flex items-center gap-2 text-xs">
                  {r.categoryName} · ${r.unitPrice.toFixed(2)}
                  {r.kind === "quantity" && <Badge variant="outline">{r.stock} disp.</Badge>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="p-1.5">Producto</th>
              <th className="p-1.5">Cantidad</th>
              <th className="p-1.5">Precio</th>
              <th className="p-1.5">Subtotal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cart.map((line) => (
              <tr key={line.key}>
                <td className="p-1.5">{line.label}</td>
                <td className="p-1.5">
                  {line.kind === "quantity" ? (
                    <Input
                      type="number"
                      min="1"
                      max={line.maxQuantity}
                      value={line.quantity}
                      onChange={(e) =>
                        updateCartLine(line.key, {
                          quantity: Math.max(1, Math.min(Number(e.target.value) || 1, line.maxQuantity ?? 1)),
                        })
                      }
                      className="h-8 w-20"
                    />
                  ) : (
                    1
                  )}
                </td>
                <td className="p-1.5">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    disabled={!canEditPrice}
                    onChange={(e) => updateCartLine(line.key, { unitPrice: Number(e.target.value) || 0 })}
                    className="h-8 w-24"
                  />
                </td>
                <td className="p-1.5 tabular-nums">${(line.quantity * line.unitPrice).toFixed(2)}</td>
                <td className="p-1.5">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeCartLine(line.key)}>
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
            {cart.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground py-6 text-center">
                  Busca un producto para agregarlo al carrito.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-border flex flex-col gap-2 rounded-lg border p-4">
        <div className="flex items-center justify-between text-sm">
          <span>Subtotal</span>
          <span className="tabular-nums">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span>Descuento</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="h-8 w-28"
          />
        </div>
        <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Métodos de pago</p>
          <Button type="button" variant="outline" size="sm" onClick={addPayment}>
            + Agregar pago
          </Button>
        </div>
        {payments.map((p) => (
          <div key={p.key} className="flex items-center gap-2">
            <Select value={p.accountId} onValueChange={(v) => updatePayment(p.key, { accountId: v })}>
              <SelectTrigger className="w-40">
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
            <Input
              type="number"
              min="0"
              step="0.01"
              value={p.amount}
              onChange={(e) => updatePayment(p.key, { amount: e.target.value })}
              className="h-9 w-28"
              placeholder="Monto"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => removePayment(p.key)}>
              ✕
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span>Saldo pendiente</span>
          <span className="tabular-nums font-medium">${Math.max(0, balanceDue).toFixed(2)}</span>
        </div>
        {balanceDue > 0.004 && customerId === "none" && (
          <p className="text-warning text-xs">Selecciona un cliente para vender a crédito.</p>
        )}
      </div>

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" disabled={pending || cart.length === 0} className="w-fit">
        {pending ? "Registrando..." : "Registrar venta"}
      </Button>
    </form>
  );
}
