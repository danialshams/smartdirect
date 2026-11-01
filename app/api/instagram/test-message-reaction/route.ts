import { NextResponse } from "next/server";
// Retired: the legacy test endpoint invoked Meta actions with arbitrary account IDs
// without verifying either the caller or account ownership.
export const dynamic="force-dynamic";
export async function POST() {
  return NextResponse.json({message:"این API آزمایشی غیرفعال شده است."},{status:404,headers:{"Cache-Control":"no-store"}});
}
