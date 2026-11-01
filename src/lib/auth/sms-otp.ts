import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/lib/sms/provider";
import { asciiDigits } from "./phone";

export type OtpPurpose = "login" | "reset" | "verify";
export const OTP_LIFETIME_SECONDS = 120;
const MAX_ATTEMPTS = 5;
const SECRET = () => {
  const key = process.env.NEXTAUTH_SECRET;
  if (!key || key.length < 32) throw new Error("OTP_SECRET_UNAVAILABLE");
  return key;
};
export function isSmsReady(): boolean {
  return !!process.env.NEXTAUTH_SECRET && !!getSmsProvider();
}
function digest(value: string) {
  return createHmac("sha256", SECRET()).update(value).digest("hex");
}
function codeDigest(userId: string, phone: string, purpose: OtpPurpose, code: string) {
  return digest(["auth-otp-v1", userId, phone, purpose, code].join(":"));
}
export function hashRequestIp(ip: string) {
  return digest("otp-ip:" + ip);
}

/** Issue only when a real configured SMS provider exists; never log or return codes. */
export async function sendOtp(userId: string, phone: string, purpose: OtpPurpose, ipHash: string) {
  const provider = getSmsProvider();
  if (!provider) throw new Error("SMS_NOT_CONFIGURED");
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60_000);
  const oneHourAgo = new Date(now.getTime() - 3_600_000);
  const [recent, phoneCount, ipCount] = await Promise.all([
    prisma.authSmsChallenge.count({ where: { phone, purpose, createdAt: { gt: oneMinuteAgo } } }),
    prisma.authSmsChallenge.count({ where: { phone, createdAt: { gt: oneHourAgo } } }),
    prisma.authSmsChallenge.count({ where: { ipHash, createdAt: { gt: oneHourAgo } } })
  ]);
  if (recent > 0 || phoneCount >= 4 || ipCount >= 12) throw new Error("OTP_RATE_LIMIT");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const challenge = await prisma.authSmsChallenge.create({
    data: {
      userId, phone, purpose, codeHash: codeDigest(userId, phone, purpose, code),
      expiresAt: new Date(now.getTime() + OTP_LIFETIME_SECONDS * 1000), ipHash
    }
  });
  try {
    const receipts = await provider.sendBatch([{
      phone,
      text: `کد تأیید دایرا: ${code}\nاعتبار: ۲ دقیقه. این کد را در اختیار دیگران قرار ندهید.`,
      reference: challenge.id
    }]);
    if (!receipts.length) throw new Error("SMS_NO_RECEIPT");
  } catch {
    await prisma.authSmsChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    throw new Error("SMS_DELIVERY_FAILED");
  }
}

/** Atomic one-time redemption of the latest unexpired code. Five bad attempts maximum. */
export async function consumeOtp(userId: string, phone: string, purpose: OtpPurpose, input: string) {
  const code = asciiDigits(input).trim();
  if (!/^\d{6}$/.test(code)) return false;
  const now = new Date();
  const challenge = await prisma.authSmsChallenge.findFirst({
    where: { userId, phone, purpose, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "desc" }
  });
  if (!challenge) return false;
  if (challenge.codeHash !== codeDigest(userId, phone, purpose, code)) {
    await prisma.authSmsChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } }
    });
    return false;
  }
  const used = await prisma.authSmsChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: MAX_ATTEMPTS } },
    data: { consumedAt: now }
  });
  if (used.count !== 1) return false;
  await prisma.authSmsChallenge.updateMany({
    where: { userId, phone, purpose, consumedAt: null },
    data: { consumedAt: now }
  });
  return true;
}
