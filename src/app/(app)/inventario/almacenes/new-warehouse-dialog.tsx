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

import { createWarehouseAction } from "@/server/modules/inventory/actions";

export function NewWarehouseDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createWarehouseAction, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Nuevo almacén</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo almacén</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required placeholder="Depósito norte" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Dirección (opcional)</Label>
            <Input id="address" name="address" />
          </div>
          {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
          {state?.success && <p className="text-success text-sm">{state.success}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando..." : "Crear almacén"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
