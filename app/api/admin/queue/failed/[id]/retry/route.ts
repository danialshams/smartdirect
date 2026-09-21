import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { retryFailedJob } from "@/lib/queue/recovery";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "احراز هویت انجام نشده است." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "دسترسی مجاز نیست." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const job = await retryFailedJob(id);

    return NextResponse.json({
      success: true,
      message: "Job با موفقیت دوباره وارد Queue شد.",
      data: job,
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "QUEUE_FAILURE_NOT_FOUND" ? 404 : 409;

    return NextResponse.json({
      success: false,
      message,
    }, { status });
  }
}
