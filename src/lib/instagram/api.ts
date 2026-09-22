import {
  instagramApiRequest,
} from "@/lib/instagram/client";

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

export async function getInstagramProfile(accessToken: string) {
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
        "id,user_id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,account_type",
    },
  });
}

export async function getInstagramAccountInsights(
  instagramUserId: string,
  accessToken: string,
  days = 7,
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
    },
  );
}

export async function getInstagramMedia(
  instagramUserId: string,
  accessToken: string,
  limit = 25,
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
  });
}

export type InstagramMediaComment = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
};

export async function getInstagramMediaComments(
  mediaId: string,
  accessToken: string,
  limit = 50,
) {
  return instagramApiRequest<{
    data: InstagramMediaComment[];
    paging?: {
      next?: string;
    };
  }>(`${mediaId}/comments`, {
    accessToken,
    params: {
      fields: "id,text,username,timestamp",
      limit,
    },
  });
}

export async function getInstagramComment(
  commentId: string,
  accessToken: string,
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
  });
}

export async function replyToInstagramComment(
  commentId: string,
  accessToken: string,
  message: string,
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
  });
}

export async function getInstagramMediaInsights(
  mediaId: string,
  accessToken: string,
) {
  return instagramApiRequest<InstagramInsightsResponse>(
    `${mediaId}/insights`,
    {
      accessToken,
      params: {
        metric:
          "views,reach,likes,comments,saved,shares,total_interactions",
      },
    },
  );
}
