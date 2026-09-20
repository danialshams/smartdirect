import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { instagramApiRequest } from "@/lib/instagram/client";

type IceBreakerPayload = {
  question: string;
  payload: string;
};

type PersistentMenuItemPayload = {
  title: string;
  payload: string;
};

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

  return instagramApiRequest(`${instagramUserId}/messenger_profile`, {
    method,
    accessToken,
    params: {
      platform: "instagram",
      ...(fields ? { fields } : {}),
    },
    body,
  });
}

export async function setInstagramIceBreakers({
  instagramAccountId,
  instagramUserId,
  iceBreakers,
}: {
  instagramAccountId: string;
  instagramUserId: string;
  iceBreakers: IceBreakerPayload[];
}) {
  if (iceBreakers.length > 4) throw new Error("Instagram allows a maximum of 4 Ice Breakers");

  const normalizedItems = iceBreakers.map((item) => {
    const question = item.question.trim();
    const payload = item.payload.trim();
    if (!question) throw new Error("Ice Breaker question cannot be empty");
    if (!payload) throw new Error("Ice Breaker payload cannot be empty");
    if (question.length > 80) throw new Error("Ice Breaker question must be 80 characters or less");
    return { question, payload };
  });

  if (normalizedItems.length === 0) {
    return deleteInstagramIceBreakers({ instagramAccountId, instagramUserId });
  }

  return callMessengerProfileApi({
    instagramAccountId,
    instagramUserId,
    method: "POST",
    body: {
      platform: "instagram",
      ice_breakers: [{ locale: "default", call_to_actions: normalizedItems }],
    },
  });
}

export async function deleteInstagramIceBreakers({
  instagramAccountId,
  instagramUserId,
}: {
  instagramAccountId: string;
  instagramUserId: string;
}) {
  return callMessengerProfileApi({
    instagramAccountId,
    instagramUserId,
    method: "DELETE",
    fields: "ice_breakers",
  });
}

export async function setInstagramPersistentMenu({
  instagramAccountId,
  instagramUserId,
  items,
}: {
  instagramAccountId: string;
  instagramUserId: string;
  items: PersistentMenuItemPayload[];
}) {
  if (items.length > 3) {
    throw new Error("Instagram Persistent Menu supports up to 3 top-level items");
  }

  const normalizedItems = items.map((item) => {
    const title = item.title.trim();
    const payload = item.payload.trim();
    if (!title) throw new Error("Persistent menu item title cannot be empty");
    if (!payload) throw new Error("Persistent menu item payload cannot be empty");
    if (title.length > 30) throw new Error("Persistent menu item title must be 30 characters or less");
    return { type: "postback", title, payload };
  });

  if (normalizedItems.length === 0) {
    return deleteInstagramPersistentMenu({ instagramAccountId, instagramUserId });
  }

  return callMessengerProfileApi({
    instagramAccountId,
    instagramUserId,
    method: "POST",
    body: {
      platform: "instagram",
      persistent_menu: [{
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: normalizedItems,
      }],
    },
  });
}

export async function deleteInstagramPersistentMenu({
  instagramAccountId,
  instagramUserId,
}: {
  instagramAccountId: string;
  instagramUserId: string;
}) {
  return callMessengerProfileApi({
    instagramAccountId,
    instagramUserId,
    method: "DELETE",
    fields: "persistent_menu",
  });
}

export const configureInstagramIceBreakers = setInstagramIceBreakers;

export async function configureInstagramPersistentMenu({
  instagramAccountId,
  instagramUserId,
  enabled,
  items,
}: {
  instagramAccountId: string;
  instagramUserId: string;
  enabled: boolean;
  items: Array<{ title: string; payload: string }>;
}) {
  if (!enabled || items.length === 0) {
    return deleteInstagramPersistentMenu({ instagramAccountId, instagramUserId });
  }

  return setInstagramPersistentMenu({ instagramAccountId, instagramUserId, items });
}
