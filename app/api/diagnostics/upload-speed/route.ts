import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage/provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "احراز هویت انجام نشده است." },
      { status: 401 },
    );
  }

  const startedAt = performance.now();
  const body = Buffer.from(await request.arrayBuffer());
  const receivedAt = performance.now();

  if (body.length === 0) {
    return NextResponse.json(
      { success: false, message: "بدنه درخواست خالی است." },
      { status: 400 },
    );
  }

  const storageStartedAt = performance.now();
  const provider = getStorageProvider();
  const result = await provider.upload({
    key: `diagnostics/${session.user.id}/upload-speed-${crypto.randomUUID()}.bin`,
    body,
    contentType: "application/octet-stream",
  });
  const storageFinishedAt = performance.now();

  await provider.delete(result.storageKey).catch(() => undefined);

  const receiveSeconds = (receivedAt - startedAt) / 1000;
  const storageSeconds = (storageFinishedAt - storageStartedAt) / 1000;
  const totalSeconds = (storageFinishedAt - startedAt) / 1000;
  const megabytes = body.length / 1024 / 1024;

  return NextResponse.json({
    success: true,
    bytes: body.length,
    megabytes: Number(megabytes.toFixed(3)),
    receiveSeconds: Number(receiveSeconds.toFixed(3)),
    receiveMbps: Number(((body.length * 8) / receiveSeconds / 1_000_000).toFixed(2)),
    storageSeconds: Number(storageSeconds.toFixed(3)),
    storageMbps: Number(((body.length * 8) / storageSeconds / 1_000_000).toFixed(2)),
    totalSeconds: Number(totalSeconds.toFixed(3)),
    totalMbps: Number(((body.length * 8) / totalSeconds / 1_000_000).toFixed(2)),
    provider: process.env.STORAGE_PROVIDER || "local",
  });
}
