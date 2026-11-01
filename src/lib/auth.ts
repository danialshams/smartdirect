import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { normalizePhone } from "@/lib/auth/phone";
import { consumeOtp } from "@/lib/auth/sms-otp";
import { createHmac } from "node:crypto";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
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
        const rawIdentifier=typeof credentials?.email==="string" ? credentials.email.trim() : "";
        const password=typeof credentials?.password==="string" ? credentials.password : "";
        if(!rawIdentifier || !password || rawIdentifier.length>254) return null;
        const phone=normalizePhone(rawIdentifier);
        const identifier=(phone||rawIdentifier.toLowerCase());
        // One stable bucket per account, shared across serverless instances.
        // Digest identifiers before storing them to avoid retaining emails/phones in the audit table.
        const secret=process.env.NEXTAUTH_SECRET;
        if(!secret || secret.length<32) throw new Error("LOGIN_SECURITY_NOT_CONFIGURED");
        const identifierHash=createHmac("sha256",secret).update("login:"+identifier).digest("hex");
        const since=new Date(Date.now()-15*60*1000);
        const attempts=await prisma.authPasswordAttempt.count({where:{identifierHash,createdAt:{gt:since}}});
        if(attempts>=8) return null;
        const user=phone
          ? await prisma.user.findFirst({where:{phone},orderBy:{createdAt:"asc"}})
          : await prisma.user.findUnique({where:{email:identifier}});
        // A generic authentication result prevents simple account enumeration.
        const valid=!!(user && !user.isBlocked && user.password && await bcrypt.compare(password,user.password));
        if(!valid){
          await prisma.authPasswordAttempt.create({data:{identifierHash}});
          return null;
        }
        await prisma.authPasswordAttempt.deleteMany({where:{identifierHash}});
        return {id:user!.id,email:user!.email,name:user!.name,role:user!.role,sessionVersion:user!.sessionVersion};
      },
    }),
    CredentialsProvider({
      id: "sms",
      name: "SMS one-time code",
      credentials: {
        phone: { label: "Phone", type: "text" },
        code: { label: "Code", type: "text" }
      },
      async authorize(credentials) {
        const phone = normalizePhone(credentials?.phone ?? "");
        if (!phone || !credentials?.code) return null;
        const matches = await prisma.user.findMany({
          where: { phone, phoneVerifiedAt: { not: null }, isBlocked: false },
          take: 2
        });
        // Never log in to a non-unique phone number or an unverified account.
        if (matches.length !== 1) return null;
        const user = matches[0];
        if (!await consumeOtp(user.id, phone, "login", credentials.code)) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role, sessionVersion: user.sessionVersion };
      }
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role; // 👈 اضافه شد
        token.blocked = false;
        token.sessionVersion = (user as {sessionVersion?:number}).sessionVersion ?? 0;
        token.accessCheckedAt = Date.now();
      }
      // Refresh persisted account access and role to invalidate already-issued JWTs.
      // The bounded interval avoids adding a DB query to every dashboard request.
      if (!user && typeof token.id === "string" && Date.now() - Number(token.accessCheckedAt || 0) > 10_000) {
        const current = await prisma.user.findUnique({ where: { id: token.id }, select: { role: true, isBlocked: true, sessionVersion: true } });
        token.blocked = !current || current.isBlocked || token.sessionVersion !== current.sessionVersion;
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
