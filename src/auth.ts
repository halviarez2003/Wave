import "server-only";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        // MVP: una sola empresa, así que el email no está desambiguado por
        // companyId en el login. Cuando exista selector de empresa, filtrar
        // también por companyId aquí.
        const user = await prisma.user.findFirst({
          where: { email, isActive: true },
          include: {
            company: true,
            role: { include: { permissions: { include: { permission: true } } } },
          },
        });
        if (!user) return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          companyName: user.company.name,
          roleId: user.roleId,
          roleName: user.role.name,
          permissions: user.role.permissions.map((rp) => rp.permission.code),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.companyId = token.companyId;
      session.user.companyName = token.companyName;
      session.user.roleId = token.roleId;
      session.user.roleName = token.roleName;
      session.user.permissions = token.permissions;
      return session;
    },
  },
});
