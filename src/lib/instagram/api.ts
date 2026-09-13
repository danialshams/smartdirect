const INSTAGRAM_API_VERSION = "v26.0";

const INSTAGRAM_GRAPH_URL = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;

type InstagramApiError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
};

type InstagramApiResponse<T> = T & {
  error?: InstagramApiError;
};

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

async function instagramFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${INSTAGRAM_GRAPH_URL}/${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json()) as InstagramApiResponse<T>;

  if (!response.ok || data.error) {
    throw new Error(
      data.error?.message ||
        `Instagram API request failed with status ${response.status}`,
    );
  }

  return data;
}

export async function getInstagramProfile(accessToken: string) {
  return instagramFetch<{
    id?: string;
    user_id?: string;
    username?: string;
    name?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
  }>("me", accessToken, {
    fields:
      "id,user_id,username,name,followers_count,follows_count,media_count",
  });
}

export async function getInstagramAccountInsights(
  instagramUserId: string,
  accessToken: string,
  days = 7,
) {
  const until = Math.floor(Date.now() / 1000);

  const since = until - days * 24 * 60 * 60;

  return instagramFetch<InstagramInsightsResponse>(
    `${instagramUserId}/insights`,
    accessToken,
    {
      metric: "reach,views,accounts_engaged,total_interactions,profile_views",

      period: "day",

      metric_type: "time_series",

      since: String(since),

      until: String(until),
    },
  );
}

export async function getInstagramMedia(
  instagramUserId: string,
  accessToken: string,
  limit = 25,
) {
  return instagramFetch<{
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
  }>(`${instagramUserId}/media`, accessToken, {
    fields:
      "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp",

    limit: String(limit),
  });
}

export async function getInstagramMediaInsights(
  mediaId: string,
  accessToken: string,
) {
  return instagramFetch<InstagramInsightsResponse>(
    `${mediaId}/insights`,
    accessToken,
    {
      metric: "views,reach,likes,comments,saved,shares,total_interactions",
    },
  );
}
