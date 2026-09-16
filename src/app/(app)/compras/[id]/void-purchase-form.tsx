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

import { voidPurchaseAction } from "@/server/modules/purchases/actions";

export function VoidPurchaseForm({ purchaseId, purchaseNumber }: { purchaseId: string; purchaseNumber: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(voidPurchaseAction, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          Anular compra
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular compra #{purchaseNumber}</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="purchaseId" value={purchaseId} />
          <p className="text-muted-foreground text-sm">
            Esto revierte el inventario recibido (o el costo promedio, si hubo movimientos por
            cantidad) y reversa los pagos hechos. La compra original queda registrada como
            anulada, nunca se borra.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Motivo</Label>
            <Input id="reason" name="reason" required placeholder="Ej. Pedido duplicado" />
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
