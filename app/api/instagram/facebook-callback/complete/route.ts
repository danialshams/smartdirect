import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: "Facebook access token دریافت نشد.",
      },
      { status: 400 },
    );
  }

  console.log("Facebook Login token received successfully.");

  return NextResponse.json({
    success: true,
    message:
      "Facebook Login با موفقیت انجام شد. مرحله دریافت Page و Instagram Account بعدی است.",
  });
}
