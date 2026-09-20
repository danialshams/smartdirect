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
  }>("me", {
    accessToken,
    params: {
      fields:
        "id,user_id,username,name,followers_count,follows_count,media_count",
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
