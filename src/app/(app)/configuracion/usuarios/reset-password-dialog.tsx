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

import { resetPasswordAction } from "@/server/modules/users/actions";

export function ResetPasswordDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Restablecer contraseña
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restablecer contraseña de {userName}</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="userId" value={userId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${userId}-password`}>Nueva contraseña</Label>
            <Input id={`${userId}-password`} name="password" type="password" minLength={8} required />
          </div>
          {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
          {state?.success && <p className="text-success text-sm">{state.success}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Restablecer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
