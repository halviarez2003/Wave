"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createCategoryAction } from "@/server/modules/catalog/actions";

export function NewCategoryDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createCategoryAction, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Nueva categoría</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva categoría</DialogTitle>
          <DialogDescription>
            Los atributos (IMEI, color, potencia...) se configuran después, entrando a la categoría.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required placeholder="Ej. Ventiladores" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="icon">Ícono (opcional)</Label>
            <Input id="icon" name="icon" placeholder="fan" />
          </div>
          {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando..." : "Crear categoría"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
