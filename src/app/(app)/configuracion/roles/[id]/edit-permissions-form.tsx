"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { updateRolePermissionsAction } from "@/server/modules/roles/actions";

type Permission = { code: string; description: string };

export function EditPermissionsForm({
  roleId,
  permissions,
  initialCodes,
}: {
  roleId: string;
  permissions: Permission[];
  initialCodes: string[];
}) {
  const [state, action, pending] = useActionState(updateRolePermissionsAction, undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialCodes));

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
    <form action={handleSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="roleId" value={roleId} />

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map(([group, items]) => (
          <div key={group} className="border-border flex flex-col gap-1.5 rounded-lg border p-4">
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
      {state?.success && <p className="text-success text-sm">{state.success}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : "Guardar permisos"}
      </Button>
    </form>
  );
}
