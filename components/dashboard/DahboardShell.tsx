"use client";

import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { usePathname } from "next/navigation";
import { useState } from "react";

import DashboardTheme from "./DashboardTheme";
import DashboardSidebar, { DashboardInstagramIsland } from "./DashboardSidebar";
import DashboardMobileHeader from "./DashboardMobileHeader";
import DashboardOverview from "./DashboardOverview";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type DashboardShellProps = {
  user: {
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  };
  instagramAccounts: InstagramAccount[];
  children?: ReactNode;
};

export default function DashboardShell({
  user,
  instagramAccounts,
  children,
}: DashboardShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const pathname = usePathname();
  const isInbox = pathname.startsWith("/dashboard/inbox");

  return (
    <DashboardTheme>
      <Box
        dir="rtl"
        className="dashboard-theme"
        sx={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default",
          color: "text.primary",
        }}
      >
        <DashboardMobileHeader onMenuOpen={() => setMobileSidebarOpen(true)} mobileOpen={mobileSidebarOpen} accountMenuOpen={accountMenuOpen} />

        <DashboardSidebar
          instagramAccounts={instagramAccounts}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {!isInbox && <DashboardInstagramIsland instagramAccounts={instagramAccounts} accountMenuOpen={accountMenuOpen} onAccountMenuOpenChange={setAccountMenuOpen} />}

        <Box
          sx={{
            minWidth: 0,
            flex: 1,
            marginInlineStart: { xs: 0, lg: "196px" },
          }}
        >
          <Box
            component="main"
            sx={{
              minHeight: 0,
              px: { xs: 2, md: 3, lg: 4 },
              py: { xs: 2, md: 3, lg: 4 },
              pb: { xs: isInbox ? "calc(16px + env(safe-area-inset-bottom, 0px))" : "calc(88px + env(safe-area-inset-bottom, 0px))", lg: 4 },
              boxSizing: "border-box",
            }}
          >
            <Box
              className="dashboard-page-unified"
              sx={{
                width: "100%",
                maxWidth: isInbox ? 1400 : 1152,
                mx: "auto",
              }}
            >
              {children ?? (
                <DashboardOverview
                  user={user}
                  instagramAccounts={instagramAccounts}
                />
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </DashboardTheme>
  );
}
