import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { retryFailedJob } from "@/lib/queue/recovery";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (guard.response) return guard.response;

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
