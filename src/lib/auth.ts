import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("لطفاً ایمیل و رمز عبور را وارد کنید");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (user?.isBlocked) throw new Error("دسترسی به این حساب موقتاً مسدود شده است.");
        if (!user || !user.password) {
          throw new Error("کاربری با این مشخصات یافت نشد");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("رمز عبور اشتباه است");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role, // 👈 اضافه شد
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role; // 👈 اضافه شد
        token.blocked = false;
        token.accessCheckedAt = Date.now();
      }
      // Refresh persisted account access and role to invalidate already-issued JWTs.
      // The bounded interval avoids adding a DB query to every dashboard request.
      if (!user && typeof token.id === "string" && Date.now() - Number(token.accessCheckedAt || 0) > 10_000) {
        const current = await prisma.user.findUnique({ where: { id: token.id }, select: { role: true, isBlocked: true } });
        token.blocked = !current || current.isBlocked;
        token.role = current?.role || "USER";
        token.accessCheckedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.blocked ? "" : token.id as string;
        session.user.role = token.role as "ADMIN" | "USER"; // 👈 اضافه شد
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
