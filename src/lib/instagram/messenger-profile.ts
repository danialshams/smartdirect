import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

const INSTAGRAM_API_VERSION = "v26.0";

type InstagramMessengerProfileResponse = {
  result?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

function getMessengerProfileUrl(instagramUserId: string) {
  return `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/${instagramUserId}/messenger_profile`;
}

async function callMessengerProfileApi({
  instagramAccountId,
  instagramUserId,
  method,
  body,
  fields,
}: {
  instagramAccountId: string;
  instagramUserId: string;
  method: "GET" | "POST" | "DELETE";
  body?: Record<string, unknown>;
  fields?: string;
}) {
  const accessToken = await getValidInstagramAccessToken(instagramAccountId);

  const url = new URL(getMessengerProfileUrl(instagramUserId));

  url.searchParams.set("platform", "instagram");

  if (fields) {
    url.searchParams.set("fields", fields);
  }

  console.log("[Instagram Messenger Profile] Request:", {
    method,
    url: url.toString(),
    body,
  });

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body
      ? {
          body: JSON.stringify(body),
        }
      : {}),
    cache: "no-store",
  });

  const responseText = await response.text();

  let data: InstagramMessengerProfileResponse | unknown;

  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }

  console.log("[Instagram Messenger Profile] Response:", {
    status: response.status,
    ok: response.ok,
    data,
  });

  if (!response.ok) {
    const errorData = data as InstagramMessengerProfileResponse;

    const message =
      errorData?.error?.message ||
      `Instagram API returned HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export async function configureInstagramIceBreakers({
  instagramAccountId,
  instagramUserId,
  items,
}: {
  instagramAccountId: string;
  instagramUserId: string;
  items: Array<{
    question: string;
    payload: string;
  }>;
}) {
  if (items.length > 4) {
    throw new Error("Instagram حداکثر ۴ Ice Breaker را پشتیبانی می‌کند.");
  }

  const normalizedItems = items.map((item) => {
    const question = item.question.trim();
    const payload = item.payload.trim();

    if (!question) {
      throw new Error("متن Ice Breaker نمی‌تواند خالی باشد.");
    }

    if (!payload) {
      throw new Error("Payload مربوط به Ice Breaker نمی‌تواند خالی باشد.");
    }

    if (question.length > 80) {
      throw new Error("متن Ice Breaker نباید بیشتر از ۸۰ کاراکتر باشد.");
    }

    return {
      question,
      payload,
    };
  });

  if (normalizedItems.length === 0) {
    return callMessengerProfileApi({
      instagramAccountId,
      instagramUserId,
      method: "DELETE",
      fields: "ice_breakers",
    });
  }

  return callMessengerProfileApi({
    instagramAccountId,
    instagramUserId,
    method: "POST",
    body: {
      platform: "instagram",
      ice_breakers: [
        {
          locale: "default",
          call_to_actions: normalizedItems,
        },
      ],
    },
  });
}

export async function configureInstagramPersistentMenu({
  instagramAccountId,
  instagramUserId,
  enabled,
  items,
}: {
  instagramAccountId: string;
  instagramUserId: string;
  enabled: boolean;
  items: Array<{
    title: string;
    payload: string;
  }>;
}) {
  if (!enabled || items.length === 0) {
    return callMessengerProfileApi({
      instagramAccountId,
      instagramUserId,
      method: "DELETE",
      fields: "persistent_menu",
    });
  }

  if (items.length > 5) {
    throw new Error("حداکثر ۵ آیتم برای Persistent Menu قابل استفاده است.");
  }

  const normalizedItems = items.map((item) => {
    const title = item.title.trim();
    const payload = item.payload.trim();

    if (!title) {
      throw new Error("عنوان Persistent Menu نمی‌تواند خالی باشد.");
    }

    if (!payload) {
      throw new Error("Payload مربوط به Persistent Menu نمی‌تواند خالی باشد.");
    }

    if (title.length > 30) {
      throw new Error("عنوان Persistent Menu نباید بیشتر از ۳۰ کاراکتر باشد.");
    }

    return {
      type: "postback",
      title,
      payload,
    };
  });

  return callMessengerProfileApi({
    instagramAccountId,
    instagramUserId,
    method: "POST",
    body: {
      platform: "instagram",
      persistent_menu: [
        {
          locale: "default",
          composer_input_disabled: false,
          call_to_actions: normalizedItems,
        },
      ],
    },
  });
}
