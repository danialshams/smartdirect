import { createHash } from "node:crypto";
import {
  instagramApiRequest,
} from "@/lib/instagram/client";

/** Scope all operations of one access token to one fallback bucket instead of
 * accidentally creating independent buckets for each media/comment/participant.
 * Callers with a connected account MUST supply the canonical database ID. */
export function instagramQuotaAccountKey(accessToken: string, accountId?: string) {
  if (accountId?.trim()) return accountId.trim();
  if (!accessToken) throw new Error("INSTAGRAM_QUOTA_ACCOUNT_CONTEXT_REQUIRED");
  return "token:" + createHash("sha256").update(accessToken).digest("hex").slice(0, 32);
}

export type InstagramInsightValue = {
  value: number;
  end_time?: string;
};

export type InstagramInsightMetric = {
  name: string;
  period?: string;
  values?: InstagramInsightValue[];
  total_value?: {
    value?: number;
  };
};

export type InstagramInsightsResponse = {
  data: InstagramInsightMetric[];
};

export async function getInstagramProfile(accessToken: string, instagramAccountId?: string) {
  return instagramApiRequest<{
    id?: string;
    user_id?: string;
    username?: string;
    name?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
    biography?: string;
    website?: string;
    profile_picture_url?: string;
    account_type?: string;
  }>("me", {
    accessToken,
    params: {
      fields:
        "id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,account_type",
    },
    rateLimit: { instagramAccountId: instagramQuotaAccountKey(accessToken, instagramAccountId), operation: "PROFILE_READ" },
  });
}

export async function getInstagramAccountInsights(
  instagramUserId: string,
  accessToken: string,
  days = 7,
  instagramAccountId?: string,
) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - days * 24 * 60 * 60;

  return instagramApiRequest<InstagramInsightsResponse>(
    `${instagramUserId}/insights`,
    {
      accessToken,
      params: {
        metric:
          "reach,views,accounts_engaged,total_interactions,profile_views",
        period: "day",
        metric_type: "time_series",
        since,
        until,
      },
      rateLimit: { instagramAccountId: instagramQuotaAccountKey(accessToken, instagramAccountId), operation: "INSIGHTS_READ" },
    },
  );
}

export async function getInstagramMedia(
  instagramUserId: string,
  accessToken: string,
  limit = 25,
  instagramAccountId?: string,
) {
  return instagramApiRequest<{
    data: Array<{
      id: string;
      caption?: string;
      media_type?: string;
      media_product_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
      timestamp?: string;
    }>;
    paging?: {
      next?: string;
    };
  }>(`${instagramUserId}/media`, {
    accessToken,
    params: {
      fields:
        "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp",
      limit,
    },
    rateLimit: { instagramAccountId: instagramQuotaAccountKey(accessToken, instagramAccountId), operation: "MEDIA_READ" },
  });
}

export type InstagramMediaComment = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  from?: {
    id?: string;
    username?: string;
  };
};

export type InstagramUserProfile = {
  id?: string;
  name?: string;
  username?: string;
  profile_pic?: string;
  follower_count?: number;
  is_user_follow_business?: boolean;
  is_business_follow_user?: boolean;
};

export async function getInstagramUserProfile(
  instagramScopedUserId: string,
  accessToken: string,
  instagramAccountId?: string,
) {
  return instagramApiRequest<InstagramUserProfile>(instagramScopedUserId, {
    accessToken,
    params: {
      fields:
        "id,name,username,profile_pic,follower_count,is_user_follow_business,is_business_follow_user",
    },
    rateLimit: { instagramAccountId: instagramQuotaAccountKey(accessToken, instagramAccountId), operation: "PROFILE_READ" },
  });
}

export async function getInstagramMediaComments(
  mediaId: string,
  accessToken: string,
  limit = 50,
  instagramAccountId?: string,
) {
  return instagramApiRequest<{
    data: InstagramMediaComment[];
    paging?: {
      next?: string;
    };
  }>(`${mediaId}/comments`, {
    accessToken,
    params: {
      fields: "id,text,username,timestamp,from",
      limit,
    },
    rateLimit: { instagramAccountId: instagramQuotaAccountKey(accessToken, instagramAccountId), operation: "MEDIA_READ" },
  });
}

export async function getInstagramComment(
  commentId: string,
  accessToken: string,
  instagramAccountId?: string,
) {
  return instagramApiRequest<{
    id?: string;
    text?: string;
    username?: string;
    timestamp?: string;
    from?: {
      id?: string;
      username?: string;
    };
  }>(commentId, {
    accessToken,
    params: {
      fields: "id,text,username,timestamp,from",
    },
    rateLimit: { instagramAccountId: instagramQuotaAccountKey(accessToken, instagramAccountId), operation: "CONVERSATION_READ" },
  });
}

export async function replyToInstagramComment(
  commentId: string,
  accessToken: string,
  message: string,
  instagramAccountId?: string,
) {
  return instagramApiRequest<{
    id?: string;
  }>(`${commentId}/replies`, {
    method: "POST",
    accessToken,
    body: new URLSearchParams({
      message,
    }),
    maxRetries: 0,
    rateLimit: { instagramAccountId: instagramQuotaAccountKey(accessToken, instagramAccountId), operation: "COMMENT_REPLY" },
  });
}

export async function getInstagramMediaInsights(
  mediaId: string,
  accessToken: string,
  instagramAccountId?: string,
) {
  return instagramApiRequest<InstagramInsightsResponse>(
    `${mediaId}/insights`,
    {
      accessToken,
      params: {
        metric:
          "views,reach,likes,comments,saved,shares,total_interactions",
      },
      rateLimit: { instagramAccountId: instagramQuotaAccountKey(accessToken, instagramAccountId), operation: "INSIGHTS_READ" },
    },
  );
}
