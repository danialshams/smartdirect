import { Role } from "@/generated/prisma/client";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL?: string;
      INSTAGRAM_CLIENT_ID?: string;
      INSTAGRAM_CLIENT_SECRET?: string;
      INSTAGRAM_REDIRECT_URI?: string;
      NEXTAUTH_SECRET?: string;
      NEXTAUTH_URL?: string;
    }
  }
}

export type { Role };