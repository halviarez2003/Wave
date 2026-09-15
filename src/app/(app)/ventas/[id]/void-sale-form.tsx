"use client";

import { useActionState, useState } from "react";

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

import { voidSaleAction } from "@/server/modules/sales/actions";

export function VoidSaleForm({ saleId, saleNumber }: { saleId: string; saleNumber: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(voidSaleAction, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          Anular venta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular venta #{saleNumber}</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="saleId" value={saleId} />
          <p className="text-muted-foreground text-sm">
            Esto devuelve el inventario vendido y reversa los pagos recibidos. La venta original
            queda registrada como anulada, nunca se borra.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Motivo</Label>
            <Input id="reason" name="reason" required placeholder="Ej. Error al cargar el producto" />
          </div>
          {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Anulando..." : "Confirmar anulación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
