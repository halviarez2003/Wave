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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { updateUserAction } from "@/server/modules/users/actions";

type Role = { id: string; name: string };

export function EditUserDialog({
  userId,
  name,
  roleId: initialRoleId,
  isActive: initialIsActive,
  roles,
  isSelf,
}: {
  userId: string;
  name: string;
  roleId: string;
  isActive: boolean;
  roles: Role[];
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateUserAction, undefined);
  const [roleId, setRoleId] = useState(initialRoleId);
  const [isActive, setIsActive] = useState(initialIsActive);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="roleId" value={roleId} />
          <input type="hidden" name="isActive" value={String(isActive)} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${userId}-name`}>Nombre</Label>
            <Input id={`${userId}-name`} name="name" defaultValue={name} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Rol</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={isSelf} />
            Activo
          </label>
          {isSelf && (
            <p className="text-muted-foreground text-xs">No podés desactivar tu propia cuenta.</p>
          )}

          {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
