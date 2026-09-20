import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

export const dynamic = "force-dynamic";

const INSTAGRAM_API_VERSION = "v26.0";
const GRAPH_BASE = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;
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

async function fetchInstagramImageUrl(
  accountId: string,
  participantId: string | null,
) {
  const account = await prisma.instagramAccount.findFirst({
    where: {
      id: accountId,
      isConnected: true,
    },
    select: {
      id: true,
      userId: true,
      igUserId: true,
    },
  });

  if (!account) {
    return null;
  }

  const accessToken = await getValidInstagramAccessToken(account.id);

  const endpoint = participantId
    ? `${GRAPH_BASE}/${encodeURIComponent(
        participantId,
      )}?fields=profile_pic`
    : `${GRAPH_BASE}/me?fields=profile_picture_url`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as {
      profile_pic?: string;
      profile_picture_url?: string;
      error?: {
        message?: string;
        code?: number;
        error_subcode?: number;
      };
    };

    if (!response.ok) {
      console.error("Instagram profile image lookup failed:", {
        accountId,
        participantId,
        status: response.status,
        error: data.error,
      });
      return null;
    }

    return participantId
      ? data.profile_pic || null
      : data.profile_picture_url || null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const accountId = request.nextUrl.searchParams.get("accountId");
    const participantId = request.nextUrl.searchParams.get("participantId");
    const rawUrl = request.nextUrl.searchParams.get("url");

    let targetUrl: URL;

    if (accountId) {
      const account = await prisma.instagramAccount.findFirst({
        where: {
          id: accountId,
          userId: session.user.id,
          isConnected: true,
        },
        select: { id: true },
      });

      if (!account) {
        return new NextResponse("Instagram account not found", { status: 404 });
      }

      const freshImageUrl = await fetchInstagramImageUrl(
        account.id,
        participantId || null,
      );

      if (!freshImageUrl) {
        return new NextResponse("Instagram profile image unavailable", {
          status: 404,
        });
      }

      try {
        targetUrl = new URL(freshImageUrl);
      } catch {
        return new NextResponse("Invalid Instagram profile image URL", {
          status: 502,
        });
      }
    } else {
      if (!rawUrl) {
        return new NextResponse("Media URL is required", { status: 400 });
      }

      try {
        targetUrl = new URL(rawUrl);
      } catch {
        return new NextResponse("Invalid media URL", { status: 400 });
      }
    }

    if (
      targetUrl.protocol !== "https:" ||
      !isAllowedInstagramHost(targetUrl.hostname)
    ) {
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
          Accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0 Safari/537.36",
          Referer: "https://www.instagram.com/",
        },
      });

      if (!response.ok || !response.body) {
        const responseBody = await response.text().catch(() => "");

        console.error("Instagram media proxy upstream failed:", {
          status: response.status,
          contentType: response.headers.get("content-type"),
          body: responseBody.slice(0, 500),
          host: targetUrl.hostname,
          dynamicProfile: Boolean(accountId),
          participantId: participantId || null,
        });

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

      headers.set(
        "cache-control",
        accountId
          ? "private, max-age=300, stale-while-revalidate=60"
          : "private, max-age=300, stale-while-revalidate=60",
      );
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

    return new NextResponse("Instagram media proxy error", {
      status: 502,
    });
  }
}
