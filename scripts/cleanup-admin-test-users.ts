import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

let disconnectPrisma: (() => Promise<void>) | undefined;

const emails = Array.from({ length: 5 }, (_, index) =>
  `sd-admin-test-${String(index + 1).padStart(2, "0")}@example.invalid`,
);
const marker = "[تست پنل]";

function expectedHostArg() {
  return process.argv.find((arg) => arg.startsWith("--expected-host="))?.slice("--expected-host=".length);
}

function inspectTarget() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL تنظیم نشده است.");
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (!host.endsWith(".neon.tech")) throw new Error("فقط میزبان Neon مجاز است؛ هیچ تغییری انجام نشد.");
  return { host, database: decodeURIComponent(url.pathname.replace(/^\//, "")) };
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  disconnectPrisma = () => prisma.$disconnect();
  const target = inspectTarget();
  const users = await prisma.user.findMany({
    where: { email: { in: emails }, name: { startsWith: marker }, role: "USER" },
    select: {
      id: true, email: true, name: true,
      _count: {
        select: {
          instagramAccounts: true, tickets: true, comments: true, conversations: true,
          forms: true, showcases: true, instagramPublishJobs: true, storageObjects: true,
          couponRedemptions: true,
        },
      },
    },
  });
  console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "APPLY" : "PLAN ONLY", target, matched: users }, null, 2));
  if (!process.argv.includes("--apply")) {
    console.log("حالت فقط-بررسی است؛ چیزی حذف نشد. برای اجرا --apply و میزبان دقیق را بده.");
    return;
  }
  if (process.env.ALLOW_NEON_TEST_USER_DELETE !== "YES") {
    throw new Error("برای تأیید صریح، ALLOW_NEON_TEST_USER_DELETE=YES را فقط برای همین فرمان تنظیم کن.");
  }
  if (expectedHostArg() !== target.host) throw new Error("میزبان تأییدشده با مقصد واقعی یکی نیست؛ حذف لغو شد.");
  if (users.length !== 5) throw new Error(`دقیقاً ۵ کاربر تست قابل‌شناسایی پیدا نشد (پیدا شد: ${users.length})؛ حذف لغو شد.`);

  const hasRelatedData = users.some((u) => Object.values(u._count).some((count) => count > 0));
  if (hasRelatedData) {
    throw new Error("حداقل یک کاربر داده مرتبط دارد؛ برای جلوگیری از حذف داده‌های تست‌شده، حذف خودکار متوقف شد. ابتدا روابط را جداگانه بررسی کن.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findMany({
      where: { email: { in: emails }, name: { startsWith: marker }, role: "USER" },
      select: { id: true, email: true },
    });
    if (current.length !== 5) throw new Error("فهرست کاربران حین اجرا تغییر کرده؛ حذف لغو شد.");
    await tx.subscription.deleteMany({ where: { userId: { in: current.map((u) => u.id) } } });
    return tx.user.deleteMany({ where: { id: { in: current.map((u) => u.id) }, email: { in: emails }, name: { startsWith: marker }, role: "USER" } });
  });
  console.log(`پاک‌سازی انجام شد؛ تعداد کاربران حذف‌شده: ${result.count}`);
}

main()
  .catch((error) => {
    console.error("خطا:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => disconnectPrisma?.());
