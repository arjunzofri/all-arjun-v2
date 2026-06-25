import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        const username = String(credentials?.username ?? "").trim();
        const password = String(credentials?.password ?? "");

        if (!username || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username));

        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: String(user.id),
          name: user.username,
          email: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.username = (user as { name?: string }).name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        (session.user as { role?: string; username?: string }).role =
          (token.role as string) ?? "operador";
        (session.user as { username?: string }).username =
          token.username as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
