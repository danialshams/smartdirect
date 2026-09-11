import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";

const INSTAGRAM_API_VERSION = "v26.0";

export async function syncIceBreakers(instagramAccountId: string) {
  const account = await prisma.instagramAccount.findUnique({
    where: {
      id: instagramAccountId,
    },
  });

  if (!account) {
    throw new Error("Instagram account not found");
  }

  const iceBreakers = await prisma.iceBreaker.findMany({
    where: {
      instagramAccountId,
      isActive: true,
    },
    orderBy: {
      order: "asc",
    },
  });

  const accessToken = await getValidInstagramAccessToken(instagramAccountId);

  const response = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_API_VERSION}/me/messenger_profile`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ice_breakers: iceBreakers.map((item) => ({
          question: item.question,
          payload: item.payload,
        })),
      }),
      cache: "no-store",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("[Instagram Ice Breakers] Sync failed:", data);

    throw new Error(
      data?.error?.message || "Instagram Ice Breakers sync failed",
    );
  }

  return data;
}
