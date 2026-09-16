import bcrypt from "bcryptjs";
import { beforeAll, describe, expect, it } from "vitest";

import * as rolesService from "@/server/modules/roles/service";
import * as usersService from "@/server/modules/users/service";
import { createTestContext, type TestContext } from "../fixtures";

describe("usuarios y roles (Configuración)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  it("createUser hashea la contraseña — nunca se guarda en texto plano", async () => {
    const roles = await ctx.db.role.findMany();
    const role = roles[0];

    const user = await usersService.createUser(ctx.db, ctx.companyId, {
      name: "Vendedora de prueba",
      email: `vendedora-${Date.now()}@wave.test`,
      password: "supersecreta123",
      roleId: role.id,
    });

    expect(user.passwordHash).not.toBe("supersecreta123");
    expect(await bcrypt.compare("supersecreta123", user.passwordHash)).toBe(true);
  });

  it("updateUser cambia rol y estado; resetPassword cambia solo el hash", async () => {
    const roleA = await ctx.db.role.create({ data: { companyId: ctx.companyId, name: "Rol A", isSystem: false } });
    const roleB = await ctx.db.role.create({ data: { companyId: ctx.companyId, name: "Rol B", isSystem: false } });

    const user = await usersService.createUser(ctx.db, ctx.companyId, {
      name: "Usuario de prueba",
      email: `user-${Date.now()}@wave.test`,
      password: "primeraPassword1",
      roleId: roleA.id,
    });

    const updated = await usersService.updateUser(ctx.db, {
      userId: user.id,
      name: "Usuario Renombrado",
      roleId: roleB.id,
      isActive: false,
    });
    expect(updated.roleId).toBe(roleB.id);
    expect(updated.isActive).toBe(false);
    expect(updated.name).toBe("Usuario Renombrado");

    const beforeReset = await ctx.db.user.findUniqueOrThrow({ where: { id: user.id } });
    await usersService.resetPassword(ctx.db, { userId: user.id, password: "segundaPassword2" });
    const afterReset = await ctx.db.user.findUniqueOrThrow({ where: { id: user.id } });

    expect(afterReset.passwordHash).not.toBe(beforeReset.passwordHash);
    expect(await bcrypt.compare("segundaPassword2", afterReset.passwordHash)).toBe(true);
    expect(afterReset.roleId).toBe(roleB.id); // resetPassword no toca nada más
  });

  it("createRole con permisos y updateRolePermissions reemplaza el set completo", async () => {
    const role = await rolesService.createRole(ctx.db, ctx.companyId, {
      name: `Rol con permisos ${Date.now()}`,
      permissionCodes: ["sales.create", "reports.view"],
    });

    let withPerms = await rolesService.getRoleWithPermissions(ctx.db, role.id);
    expect(withPerms?.permissions.map((rp) => rp.permission.code).sort()).toEqual(
      ["reports.view", "sales.create"].sort(),
    );

    await rolesService.updateRolePermissions(ctx.db, {
      roleId: role.id,
      permissionCodes: ["inventory.adjust"],
    });

    withPerms = await rolesService.getRoleWithPermissions(ctx.db, role.id);
    expect(withPerms?.permissions.map((rp) => rp.permission.code)).toEqual(["inventory.adjust"]);
  });

  it("updateRolePermissions rechaza un roleId de otra empresa", async () => {
    const otherCtx = await createTestContext();
    const otherRole = await otherCtx.db.role.create({
      data: { companyId: otherCtx.companyId, name: "Rol de otra empresa", isSystem: false },
    });

    await expect(
      rolesService.updateRolePermissions(ctx.db, {
        roleId: otherRole.id,
        permissionCodes: ["sales.create"],
      }),
    ).rejects.toThrow();
  });
});
