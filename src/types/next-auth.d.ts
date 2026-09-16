import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    companyId: string;
    companyName: string;
    roleId: string;
    roleName: string;
    permissions: string[];
  }

  interface Session {
    user: {
      id: string;
      companyId: string;
      companyName: string;
      roleId: string;
      roleName: string;
      permissions: string[];
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    companyId: string;
    companyName: string;
    roleId: string;
    roleName: string;
    permissions: string[];
  }
}
