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

async function fetchInstagramMessageMediaUrl(
  accountId: string,
  messageId: string,
) {
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, isConnected: true },
    select: { id: true, userId: true },
  });
  if (!account) return null;

  const accessToken = await getValidInstagramAccessToken(account.id);
  const response = await fetch(
    `${GRAPH_BASE}/${encodeURIComponent(messageId)}?fields=attachments`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  const data = (await response.json().catch(() => ({}))) as {
    attachments?: { data?: Array<{
      file_url?: string;
      url?: string;
      image_data?: { url?: string; medial_url?: string };
      video_data?: { url?: string };
      audio_data?: { url?: string };
      payload?: { url?: string };
    }> };
  };
  if (!response.ok) return null;
  const attachment = data.attachments?.data?.[0];
  return (
    attachment?.file_url ??
    attachment?.url ??
    attachment?.payload?.url ??
    attachment?.image_data?.url ??
    attachment?.image_data?.medial_url ??
    attachment?.video_data?.url ??
    attachment?.audio_data?.url ??
    null
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
  const debugId = `media-proxy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const accountId = request.nextUrl.searchParams.get("accountId");
    const participantId = request.nextUrl.searchParams.get("participantId");
    const messageId = request.nextUrl.searchParams.get("messageId");
    const rawUrl = request.nextUrl.searchParams.get("url");

    console.info("[MEDIA_PROXY_DEBUG] request-start", {
      debugId,
      accountId,
      participantId,
      hasRawUrl: Boolean(rawUrl),
      range: request.headers.get("range"),
    });

    let targetUrl: URL;
    let mediaAccessToken: string | null = null;

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
        console.error("[MEDIA_PROXY_DEBUG] account-not-found", { debugId, accountId });
        return new NextResponse("Instagram account not found", { status: 404 });
      }

      mediaAccessToken = await getValidInstagramAccessToken(account.id);
    }

    if (rawUrl) {
      try {
        targetUrl = new URL(rawUrl);
      } catch {
        return new NextResponse("Invalid media URL", { status: 400 });
      }
    } else if (accountId) {
      const freshImageUrl = await fetchInstagramImageUrl(
        accountId,
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
      return new NextResponse("Media URL is required", { status: 400 });
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
      const range = request.headers.get("range");
      const upstreamHeaders: Record<string, string> = {
        Accept: "*/*",
        ...(mediaAccessToken
          ? { Authorization: `Bearer ${mediaAccessToken}` }
          : {}),
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0 Safari/537.36",
        Referer: "https://www.instagram.com/",
      };

      if (range) {
        upstreamHeaders.Range = range;
      }

      console.info("[MEDIA_PROXY_DEBUG] upstream-start", {
        debugId,
        targetHost: targetUrl.hostname,
        targetPath: targetUrl.pathname,
        hasAuth: Boolean(mediaAccessToken),
        range: range || null,
      });

      const response = await fetch(targetUrl.toString(), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: upstreamHeaders,
      });

      console.info("[MEDIA_PROXY_DEBUG] upstream-response", {
        debugId,
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length"),
        contentRange: response.headers.get("content-range"),
        acceptRanges: response.headers.get("accept-ranges"),
      });

      if (!response.ok || !response.body) {
        const responseBody = await response.text().catch(() => "");

        if (
          accountId &&
          messageId &&
          [401, 403, 404, 410].includes(response.status)
        ) {
          const freshUrl = await fetchInstagramMessageMediaUrl(accountId, messageId);
          if (freshUrl && freshUrl !== targetUrl.toString()) {
            const freshTarget = new URL(freshUrl);
            if (
              freshTarget.protocol === "https:" &&
              isAllowedInstagramHost(freshTarget.hostname)
            ) {
              const retryHeaders = { ...upstreamHeaders };
              const retryResponse = await fetch(freshTarget.toString(), {
                method: "GET",
                cache: "no-store",
                signal: controller.signal,
                headers: retryHeaders,
              });

              if (retryResponse.ok && retryResponse.body) {
                const retryHeadersOut = new Headers();
                const retryContentType = retryResponse.headers.get("content-type");
                const retryContentLength = retryResponse.headers.get("content-length");
                const retryContentRange = retryResponse.headers.get("content-range");
                const retryAcceptRanges = retryResponse.headers.get("accept-ranges");
                if (retryContentType) retryHeadersOut.set("content-type", retryContentType);
                if (retryContentLength) retryHeadersOut.set("content-length", retryContentLength);
                if (retryContentRange) retryHeadersOut.set("content-range", retryContentRange);
                if (retryAcceptRanges) retryHeadersOut.set("accept-ranges", retryAcceptRanges);
                retryHeadersOut.set("accept-ranges", "bytes");
                retryHeadersOut.set("cache-control", "private, max-age=300, stale-while-revalidate=60");
                retryHeadersOut.set("x-content-type-options", "nosniff");
                return new NextResponse(retryResponse.body, {
                  status: retryResponse.status === 206 ? 206 : 200,
                  headers: retryHeadersOut,
                });
              }
            }
          }
        }

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
      const contentRange = response.headers.get("content-range");
      const acceptRanges = response.headers.get("accept-ranges");
      if (contentRange) headers.set("content-range", contentRange);
      if (acceptRanges) headers.set("accept-ranges", acceptRanges);
      if (etag) headers.set("etag", etag);
      if (lastModified) headers.set("last-modified", lastModified);

      headers.set("accept-ranges", "bytes");
      headers.set(
        "cache-control",
        accountId
          ? "private, max-age=300, stale-while-revalidate=60"
          : "private, max-age=300, stale-while-revalidate=60",
      );
      headers.set("x-content-type-options", "nosniff");

      return new NextResponse(response.body, {
        status: response.status === 206 ? 206 : 200,
        headers,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("[MEDIA_PROXY_DEBUG] unhandled-error", {
      debugId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new NextResponse("Instagram media proxy error", {
      status: 502,
    });
  }
}
