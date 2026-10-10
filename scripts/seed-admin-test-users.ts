import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { prisma } from "../src/lib/prisma";

const prefix = "sd-admin-test-";
const marker = "[تست پنل]";
const cases = [
  { n: 1, name: "آزمایش فعال", plan: "admin-test-monthly", status: "ACTIVE" as const, days: 30 },
  { n: 2, name: "آزمایش منقضی", plan: "admin-test-monthly", status: "EXPIRED" as const, days: -5 },
  { n: 3, name: "آزمایش تعلیق‌شده", plan: "admin-test-monthly", status: "SUSPENDED" as const, days: 20 },
  { n: 4, name: "آزمایش بدون اشتراک", plan: null, status: null, days: 0 },
  { n: 5, name: "آزمایش تمدیدشده", plan: "admin-test-yearly", status: "ACTIVE" as const, days: 365 },
] as const;

function expectedHostArg() {
  return process.argv.find((arg) => arg.startsWith("--expected-host="))?.slice("--expected-host=".length);
}

function inspectTarget() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL تنظیم نشده است.");
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (!host.endsWith(".neon.tech")) throw new Error("برای این اسکریپت فقط میزبان Neon مجاز است؛ هیچ تغییری انجام نشد.");
  return { host, database: decodeURIComponent(url.pathname.replace(/^\//, "")) };
}

async function main() {
  const target = inspectTarget();
  const emails = cases.map((item) => `${prefix}${String(item.n).padStart(2, "0")}@example.invalid`);
  console.log(JSON.stringify({
    mode: process.argv.includes("--apply") ? "APPLY" : "PLAN ONLY",
    target,
    records: cases.map((item, index) => ({ email: emails[index], name: `${marker} ${item.name}`, subscription: item.status ?? "NONE" })),
  }, null, 2));

  if (!process.argv.includes("--apply")) {
    console.log("حالت فقط-بررسی است؛ دیتابیس تغییر نکرد. برای اجرا، --apply و --expected-host=<host دقیق بالا> را بده.");
    return;
  }
  if (process.env.ALLOW_NEON_TEST_USER_INSERT !== "YES") {
    throw new Error("برای تأیید صریح، متغیر ALLOW_NEON_TEST_USER_INSERT=YES را فقط برای همین فرمان تنظیم کن.");
  }
  if (expectedHostArg() !== target.host) {
    throw new Error("میزبان تأییدشده با میزبان DATABASE_URL یکی نیست؛ هیچ تغییری انجام نشد.");
  }

  const existing = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
  if (existing.length) throw new Error(`ایمیل تست از قبل وجود دارد؛ برای جلوگیری از تغییر حساب موجود، متوقف شد: ${existing.map((u) => u.email).join(", ")}`);

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const output = [];
    for (const [index, item] of cases.entries()) {
      const user = await tx.user.create({
        data: {
          email: emails[index],
          name: `${marker} ${item.name}`,
          // Deliberately not a usable password; these records are for admin UI testing only.
          password: `DISABLED-TEST-ACCOUNT-${item.n}-DO-NOT-LOGIN`,
          role: "USER",
        },
        select: { id: true, email: true, name: true },
      });
      if (item.plan && item.status) {
        const startedAt = new Date(now);
        const expiresAt = new Date(now.getTime() + item.days * 24 * 60 * 60 * 1000);
        await tx.subscription.create({
          data: {
            userId: user.id,
            planKey: item.plan,
            status: item.status,
            source: "MANUAL",
            startedAt,
            expiresAt,
            suspendedAt: item.status === "SUSPENDED" ? now : null,
            note: "TEST_FIXTURE_ADMIN_USER_MANAGEMENT",
            autoRenew: false,
          },
        });
      }
      output.push(user);
    }
    return output;
  });
  console.log("ایجاد با موفقیت انجام شد. شناسه‌ها را برای پاک‌سازی نگه دار:");
  console.log(JSON.stringify(created, null, 2));
}

main()
  .catch((error) => {
    console.error("خطا:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
