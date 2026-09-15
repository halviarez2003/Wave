"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateProductAction } from "@/server/modules/catalog/actions";

type Props = {
  productId: string;
  name: string;
  brand: string | null;
  isActive: boolean;
  salePrice: string;
};

export function EditProductForm({ productId, name, brand, isActive, salePrice }: Props) {
  const [state, action, pending] = useActionState(updateProductAction, undefined);

  return (
    <form action={action} className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <input type="hidden" name="productId" value={productId} />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" defaultValue={name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand">Marca</Label>
          <Input id="brand" name="brand" defaultValue={brand ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:w-48">
        <Label htmlFor="salePrice">Precio de venta</Label>
        <Input
          id="salePrice"
          name="salePrice"
          type="number"
          step="0.01"
          min="0"
          defaultValue={salePrice}
          required
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isActive" defaultChecked={isActive} />
        Activo (visible para venta)
      </label>

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
