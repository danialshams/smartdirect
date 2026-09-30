"use client";

import type { ReactNode } from "react";
import { ConfigProvider } from "antd";
import faIR from "antd/locale/fa_IR";

export default function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      direction="rtl"
      locale={faIR}
      theme={{
        token: {
          colorPrimary: "#2563EB",
          colorPrimaryHover: "#1D4ED8",
          colorPrimaryActive: "#1D4ED8",
          colorInfo: "#2563EB",
          colorSuccess: "#16A34A",
          colorWarning: "#D97706",
          colorError: "#DC2626",
          colorText: "#0F172A",
          colorTextSecondary: "#64748B",
          colorBorder: "#E2E8F0",
          colorBgLayout: "#F8FAFC",
          colorBgContainer: "#FFFFFF",
          borderRadius: 10,
          controlHeight: 40,
          fontFamily: "Vazirmatn, Arial, sans-serif",
        },
        components: {
          Layout: { headerBg: "#FFFFFF", siderBg: "#FFFFFF", bodyBg: "#F8FAFC" },
          Menu: { itemBorderRadius: 8, itemSelectedBg: "#EFF6FF", itemSelectedColor: "#2563EB" },
          Table: { headerBg: "#F8FAFC", headerColor: "#0F172A" },
          Card: { borderRadiusLG: 12 },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
