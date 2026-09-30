import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { session: null, response: NextResponse.json({ message: "احراز هویت الزامی است" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { session: null, response: NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 }) };
  }
  return { session, response: null };
}
