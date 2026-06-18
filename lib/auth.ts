import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // ponytail: authorize dummy — el sistema real de usuarios se
      // implementa en el slice de auth (5.9). Por ahora cualquier
      // email no vacío pasa como admin.
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "");
        if (!email) return null;
        return { id: "1", email, name: email, role: "admin" };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role =
          (token.role as string) ?? "operador";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
