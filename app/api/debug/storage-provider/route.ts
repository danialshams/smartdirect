import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "احراز هویت انجام نشده است." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    storageProvider: process.env.STORAGE_PROVIDER || "local",
  });
}
