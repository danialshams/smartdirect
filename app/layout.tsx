import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "SmartDirect",
  description: "مدیریت هوشمند اتوماسیون اینستاگرام",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" dir="rtl" richColors duration={4500} visibleToasts={1} />
      </body>
    </html>
  );
}
