import type { Metadata } from "next";
import AuthStudio from "@/components/auth/AuthStudio";

export const metadata: Metadata = {
  title: "ورود و ثبت‌نام | دایرا",
  description: "ورود به داشبورد، ثبت‌نام و بازیابی رمز عبور در دایرا.",
  robots: { index: false, follow: false }
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string | string[] | undefined }>;
};
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = Array.isArray(params.callbackUrl) ? params.callbackUrl[0] : params.callbackUrl;
  return <AuthStudio callbackUrl={callbackUrl} />;
}
