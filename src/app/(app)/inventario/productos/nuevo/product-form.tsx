"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { createProductAction } from "@/server/modules/catalog/actions";

type AttributeDefinition = {
  id: string;
  key: string;
  label: string;
  dataType: "TEXT" | "NUMBER" | "BOOLEAN" | "DATE" | "SELECT";
  options: unknown;
  isRequired: boolean;
};

type Category = {
  id: string;
  name: string;
  attributeDefinitions: AttributeDefinition[];
};

export function ProductForm({ categories }: { categories: Category[] }) {
  const [state, action, pending] = useActionState(createProductAction, undefined);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [inventoryType, setInventoryType] = useState<"QUANTITY" | "SERIALIZED">("QUANTITY");

  const attributeDefinitions = useMemo(
    () => categories.find((c) => c.id === categoryId)?.attributeDefinitions ?? [],
    [categories, categoryId],
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="inventoryType" value={inventoryType} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required placeholder="iPhone 15 Pro" />
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
          <Label htmlFor="brand">Marca (opcional)</Label>
          <Input id="brand" name="brand" placeholder="Apple" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Tipo de inventario</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={inventoryType === "QUANTITY" ? "default" : "outline"}
            size="sm"
            onClick={() => setInventoryType("QUANTITY")}
          >
            Por cantidad
          </Button>
          <Button
            type="button"
            variant={inventoryType === "SERIALIZED" ? "default" : "outline"}
            size="sm"
            onClick={() => setInventoryType("SERIALIZED")}
          >
            Serializado (IMEI / serial)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="salePrice">Precio de venta</Label>
          <Input id="salePrice" name="salePrice" type="number" step="0.01" min="0" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sku">SKU (opcional)</Label>
          <Input id="sku" name="sku" />
        </div>
      </div>

      {inventoryType === "QUANTITY" ? (
        <div className="border-border grid grid-cols-2 gap-4 rounded-lg border p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="initialQuantity">Cantidad inicial (opcional)</Label>
            <Input id="initialQuantity" name="initialQuantity" type="number" min="0" step="1" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="initialCost">Costo inicial (opcional)</Label>
            <Input id="initialCost" name="initialCost" type="number" min="0" step="0.01" />
          </div>
          <p className="text-muted-foreground col-span-2 text-xs">
            Si los dejas vacíos, el producto queda con 0 en stock hasta la primera compra.
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground border-border rounded-lg border p-4 text-xs">
          Los productos serializados empiezan con 0 unidades. Carga los IMEI/seriales desde
          Inventario una vez creado el producto.
        </p>
      )}

      {attributeDefinitions.length > 0 && (
        <div className="border-border flex flex-col gap-4 rounded-lg border p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Atributos de la categoría
          </p>
          {attributeDefinitions.map((def) => (
            <AttributeField key={def.id} definition={def} />
          ))}
        </div>
      )}

      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Creando..." : "Crear producto"}
      </Button>
    </form>
  );
}

function AttributeField({ definition }: { definition: AttributeDefinition }) {
  const name = `attr_${definition.id}`;
  const label = definition.isRequired ? `${definition.label} *` : definition.label;

  if (definition.dataType === "BOOLEAN") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name={name} />
        {label}
      </label>
    );
  }

  if (definition.dataType === "SELECT") {
    const options = Array.isArray(definition.options) ? (definition.options as string[]) : [];
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={name}>{label}</Label>
        <select
          id={name}
          name={name}
          required={definition.isRequired}
          className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Selecciona...
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        required={definition.isRequired}
        type={definition.dataType === "NUMBER" ? "number" : definition.dataType === "DATE" ? "date" : "text"}
      />
    </div>
  );
}
