"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { createExpenseAction } from "@/server/modules/expenses/actions";

type Party = { id: string; name: string };

export function NewExpenseDialog({
  categories,
  accounts,
  suppliers,
}: {
  categories: Party[];
  accounts: Party[];
  suppliers: Party[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createExpenseAction, undefined);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [type, setType] = useState<"FIXED" | "VARIABLE">("VARIABLE");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState("none");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Nuevo gasto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar gasto</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="expenseCategoryId" value={categoryId} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="accountId" value={accountId} />
          {supplierId !== "none" && <input type="hidden" name="supplierId" value={supplierId} />}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Input id="description" name="description" required placeholder="Ej. Factura de luz" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "FIXED" | "VARIABLE")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Fijo</SelectItem>
                  <SelectItem value="VARIABLE">Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Monto</Label>
              <Input id="amount" name="amount" type="number" min="0.01" step="0.01" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expenseDate">Fecha</Label>
              <Input id="expenseDate" name="expenseDate" type="date" defaultValue={today} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Pagado con</Label>
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
              <Label>Proveedor (opcional)</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proveedor</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input id="notes" name="notes" />
          </div>

          {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending || !categoryId || !accountId}>
              {pending ? "Registrando..." : "Registrar gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
