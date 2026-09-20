import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { instagramApiRequest } from "@/lib/instagram/client";

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

  return instagramApiRequest("me/messenger_profile", {
    method: "POST",
    accessToken,
    params: { platform: "instagram" },
    body: {
      persistent_menu: persistentMenu,
    },
  });
}
