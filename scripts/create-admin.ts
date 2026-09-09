import { PrismaClient } from "../src/generated/prisma/client"; // مسیر درست کلاینت
import { PrismaPg } from "@prisma/adapter-pg"; // اضافه شد
import bcrypt from "bcryptjs";
import dotenv from "dotenv"; // اضافه شد

dotenv.config(); // اضافه شد

// دیتابیس URL رو از فایل .env بخون
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in .env file");
}

// ساخت adapter با استفاده از connection string
const adapter = new PrismaPg({ connectionString });

// ساخت PrismaClient با adapter
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "admin@smartdirect.com";
  const password = "AdminPassword123!"; // رمزت رو اینجا بذار

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword },
    create: {
      email,
      name: "Admin User",
      password: hashedPassword,
      // نقش ادمین رو هم اینجا تنظیم کن
      role: "ADMIN",
    },
  });

  console.log("✅ ادمین با موفقیت ساخته شد:", user.email);
  console.log("نقش:", user.role);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
