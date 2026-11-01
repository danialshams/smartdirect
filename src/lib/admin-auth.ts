import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAdminMfa,adminMfaDenied } from "@/lib/security/admin-mfa";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { session: null, response: NextResponse.json({ message: "احراز هویت الزامی است" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { session: null, response: NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 }) };
  }
  // Check the current database role, not just the cached session claim.
  const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isBlocked: true, sessionVersion: true } });
  if (!current || current.role !== "ADMIN" || current.isBlocked) return { session: null, response: NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 }) };
  const mfa=await hasAdminMfa(session.user.id,current.sessionVersion);
  if(mfa!=="ok")return {session:null,response:adminMfaDenied(mfa)};
  return { session, response: null };
}
