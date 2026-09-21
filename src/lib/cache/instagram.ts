import "server-only";

import { prisma } from "@/lib/prisma";
import { getInstagramProfile, getInstagramMedia } from "@/lib/instagram/api";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import {
  cacheKey,
  deleteCachedJson,
  getCachedJson,
  getOrSetCachedJson,
  invalidateCacheByPrefix,
  setCachedJson,
} from "./redis-cache";

export type CachedInstagramAccount = {
  id: string;
  userId: string;
  igUserId: string;
  igUsername: string;
  isConnected: boolean;
};

export type CachedInstagramToken = {
  accessToken: string;
  expiresAt: string;
};

export const CACHE_TTL = {
  ACCOUNT: 60,
  TOKEN: 300,
  PROFILE: 300,
  MEDIA: 120,
  AUTOMATION: 60,
} as const;

export function instagramAccountCacheKey(accountId: string) {
  return cacheKey("instagram-account", accountId);
}

export function instagramTokenCacheKey(accountId: string) {
  return cacheKey("instagram-token", accountId);
}

export function instagramProfileCacheKey(accountId: string) {
  return cacheKey("instagram-profile", accountId);
}

export function instagramMediaCacheKey(accountId: string, limit: number) {
  return cacheKey("instagram-media", accountId, limit);
}

export function instagramAutomationCachePrefix(
  accountId: string,
  triggerType?: string,
) {
  return cacheKey("automation", accountId, triggerType ?? "") + ":";
}

export async function getCachedInstagramAccount(accountId: string) {
  return getOrSetCachedJson(
    instagramAccountCacheKey(accountId),
    async () =>
      prisma.instagramAccount.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          userId: true,
          igUserId: true,
          igUsername: true,
          isConnected: true,
        },
      }),
    CACHE_TTL.ACCOUNT,
  );
}

export async function getCachedInstagramToken(accountId: string): Promise<CachedInstagramToken | null> {
  const cached = await getCachedJson<CachedInstagramToken>(instagramTokenCacheKey(accountId));
  if (!cached) return null;

  if (new Date(cached.expiresAt).getTime() <= Date.now()) {
    await deleteCachedJson(instagramTokenCacheKey(accountId));
    return null;
  }

  return cached;
}

export async function setCachedInstagramToken(
  accountId: string,
  token: CachedInstagramToken,
) {
  const remainingSeconds = Math.floor(
    (new Date(token.expiresAt).getTime() - Date.now()) / 1000,
  );
  const ttl = Math.min(CACHE_TTL.TOKEN, Math.max(1, remainingSeconds));
  return setCachedJson(instagramTokenCacheKey(accountId), token, ttl);
}

export async function invalidateInstagramAccountCache(accountId: string) {
  return deleteCachedJson(instagramAccountCacheKey(accountId));
}

export async function invalidateInstagramTokenCache(accountId: string) {
  return deleteCachedJson(instagramTokenCacheKey(accountId));
}

export async function invalidateInstagramProfileCache(accountId: string) {
  return deleteCachedJson(instagramProfileCacheKey(accountId));
}

export async function getCachedInstagramProfile(accountId: string) {
  const account = await getCachedInstagramAccount(accountId);
  if (!account?.isConnected) return null;

  const token = await getValidInstagramAccessToken(accountId);
  return getOrSetCachedJson(
    instagramProfileCacheKey(accountId),
    () => getInstagramProfile(token),
    CACHE_TTL.PROFILE,
  );
}

export async function getCachedInstagramMedia(accountId: string, limit = 50) {
  const account = await getCachedInstagramAccount(accountId);
  if (!account?.isConnected) return null;

  const token = await getValidInstagramAccessToken(accountId);
  return getOrSetCachedJson(
    instagramMediaCacheKey(accountId, limit),
    () => getInstagramMedia(account.igUserId, token, limit),
    CACHE_TTL.MEDIA,
  );
}

export async function invalidateInstagramMediaCache(accountId: string) {
  return invalidateCacheByPrefix(cacheKey("instagram-media", accountId));
}

export async function invalidateAutomationCache(accountId: string) {
  return invalidateCacheByPrefix(cacheKey("automation", accountId));
}
