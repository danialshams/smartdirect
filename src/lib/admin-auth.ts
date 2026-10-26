import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { session: null, response: NextResponse.json({ message: "احراز هویت الزامی است" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { session: null, response: NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 }) };
  }
  // Check the current database role, not just the cached session claim.
  const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isBlocked: true } });
  if (!current || current.role !== "ADMIN" || current.isBlocked) return { session: null, response: NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 }) };
  return { session, response: null };
}
