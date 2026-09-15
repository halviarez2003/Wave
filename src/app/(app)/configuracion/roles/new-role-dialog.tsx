"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

import { createRoleAction } from "@/server/modules/roles/actions";

type Permission = { code: string; description: string };

export function NewRoleDialog({ permissions }: { permissions: Permission[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createRoleAction, undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const group = p.code.split(".")[0];
      map.set(group, [...(map.get(group) ?? []), p]);
    }
    return [...map.entries()];
  }, [permissions]);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function handleSubmit(formData: FormData) {
    formData.set("permissionCodesJson", JSON.stringify([...selected]));
    return action(formData);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Nuevo rol</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo rol</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required placeholder="Ej. Supervisor de tienda" />
          </div>

          <div className="flex flex-col gap-3">
            <Label>Permisos</Label>
            {groups.map(([group, items]) => (
              <div key={group} className="flex flex-col gap-1.5">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{group}</p>
                {items.map((p) => (
                  <label key={p.code} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selected.has(p.code)} onCheckedChange={() => toggle(p.code)} />
                    {p.description}
                  </label>
                ))}
              </div>
            ))}
          </div>

          {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando..." : "Crear rol"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
