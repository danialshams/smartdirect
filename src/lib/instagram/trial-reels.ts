import { instagramApiRequest } from "@/lib/instagram/client";

export const TRIAL_REEL_MIN_FOLLOWERS = 200;

export type TrialEligibility = {
  eligible: boolean;
  followersCount: number | null;
  accountType: string | null;
  minimumFollowers: number;
  reason: string | null;
};

type TrialProfile = { followers_count?: number; account_type?: string };

export function evaluateTrialReelEligibility(profile: TrialProfile): TrialEligibility {
  const raw = profile.followers_count;
  const followersCount = typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  const accountType = typeof profile.account_type === "string" ? profile.account_type.toUpperCase() : null;
  const professional = ["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(accountType || "");
  const reason = !professional
    ? "Trial Reels فقط برای پیج حرفه‌ای (Business یا Creator) فعال است."
    : followersCount === null
      ? "تعداد فالوورها از اینستاگرام دریافت نشد و شرایط Trial قابل تأیید نیست."
      : followersCount < TRIAL_REEL_MIN_FOLLOWERS
        ? `برای Trial Reels حداقل ${TRIAL_REEL_MIN_FOLLOWERS} فالوور نیاز است. این پیج ${followersCount} فالوور دارد.`
        : null;
  return { eligible: reason === null, followersCount, accountType, minimumFollowers: TRIAL_REEL_MIN_FOLLOWERS, reason };
}

/** Live Meta check. No cache; scheduled jobs must be checked again at execution. */
export async function getTrialReelEligibility(accessToken: string): Promise<TrialEligibility> {
  const profile = await instagramApiRequest<TrialProfile>("/me", {
    accessToken,
    params: { fields: "followers_count,account_type" },
    timeoutMs: 12_000,
    maxRetries: 1,
  });
  return evaluateTrialReelEligibility(profile);
}

export async function requireTrialReelEligibility(accessToken: string): Promise<TrialEligibility> {
  let result: TrialEligibility;
  try {
    result = await getTrialReelEligibility(accessToken);
  } catch (error) {
    console.warn("[Instagram Trial] Live eligibility lookup failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    throw new Error("بررسی زنده شرایط Trial از اینستاگرام ناموفق بود؛ دوباره تلاش کن.");
  }
  if (!result.eligible) throw new Error(result.reason || "این پیج واجد شرایط Trial Reels نیست.");
  // Professional/public/recommendation eligibility and per-app trial quotas
  // are finally enforced by Meta when creating the container.
  return result;
}
