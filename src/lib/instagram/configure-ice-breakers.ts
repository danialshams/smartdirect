import { prisma } from "@/lib/prisma";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { instagramApiRequest } from "@/lib/instagram/client";

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

  return instagramApiRequest("me/messenger_profile", {
    method: "POST",
    accessToken,
    params: { platform: "instagram" },
    body: {
      ice_breakers: iceBreakers.map((item) => ({
        question: item.question,
        payload: item.payload,
      })),
    },
  });
}
