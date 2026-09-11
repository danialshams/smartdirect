import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

const INSTAGRAM_API_VERSION = "v26.0";

export async function syncPersistentMenu(instagramAccountId: string) {
  const menu = await prisma.persistentMenu.findUnique({
    where: {
      instagramAccountId,
    },
    include: {
      items: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  const accessToken = await getValidInstagramAccessToken(instagramAccountId);

  const persistentMenu = menu?.enabled
    ? [
        {
          locale: "default",
          composer_input_disabled: false,
          call_to_actions: menu.items.map((item) => ({
            type: "postback",
            title: item.title,
            payload: item.payload,
          })),
        },
      ]
    : [
        {
          locale: "default",
          composer_input_disabled: false,
          call_to_actions: [],
        },
      ];

  const response = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/me/messenger_profile`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        persistent_menu: persistentMenu,
      }),
      cache: "no-store",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("[Instagram Persistent Menu] Sync failed:", data);

    throw new Error(
      data?.error?.message || "Instagram Persistent Menu sync failed",
    );
  }

  return data;
}
