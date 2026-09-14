import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 15000;

function isAllowedInstagramHost(hostname: string) {
  const host = hostname.toLowerCase();

  return (
    host === "graph.instagram.com" ||
    host === "lookaside.fbsbx.com" ||
    host === "instagram.fbsbx.com" ||
    host.endsWith(".fbcdn.net") ||
    host.endsWith(".cdninstagram.com")
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const rawUrl = request.nextUrl.searchParams.get("url");

    if (!rawUrl) {
      return new NextResponse("Media URL is required", { status: 400 });
    }

    let targetUrl: URL;

    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return new NextResponse("Invalid media URL", { status: 400 });
    }

    if (targetUrl.protocol !== "https:" || !isAllowedInstagramHost(targetUrl.hostname)) {
      return new NextResponse("Media host is not allowed", { status: 403 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl.toString(), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,audio/*,*/*;q=0.8",
        },
      });

      if (!response.ok || !response.body) {
        return new NextResponse("Instagram media could not be loaded", {
          status: response.status || 502,
        });
      }

      const headers = new Headers();
      const contentType = response.headers.get("content-type");
      const contentLength = response.headers.get("content-length");
      const etag = response.headers.get("etag");
      const lastModified = response.headers.get("last-modified");

      if (contentType) headers.set("content-type", contentType);
      if (contentLength) headers.set("content-length", contentLength);
      if (etag) headers.set("etag", etag);
      if (lastModified) headers.set("last-modified", lastModified);

      headers.set("cache-control", "private, max-age=300, stale-while-revalidate=60");
      headers.set("x-content-type-options", "nosniff");

      return new NextResponse(response.body, {
        status: 200,
        headers,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("Instagram media proxy error:", error);

    return new NextResponse("Instagram media proxy failed", { status: 502 });
  }
}
