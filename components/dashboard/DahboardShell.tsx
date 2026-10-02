"use client";

import type { ReactNode } from "react";
import { Box } from "@mui/material";
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

  return (
    <DashboardTheme>
      <Box
        dir="rtl"
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default",
          color: "text.primary",
        }}
      >
        <DashboardMobileHeader onMenuOpen={() => setMobileSidebarOpen(true)} mobileOpen={mobileSidebarOpen} />

        <DashboardSidebar
          instagramAccounts={instagramAccounts}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        <DashboardInstagramIsland instagramAccounts={instagramAccounts} />

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
              height: { xs: "calc(100dvh - 92px)", lg: "auto" },
              overflow: { xs: "hidden", lg: "visible" },
              px: { xs: 1, sm: 1.75, md: 2.75, lg: 4 },
              py: { xs: 1.25, sm: 2, lg: 4 },
              pb: { xs: 13, sm: 13, lg: 4 },
              boxSizing: "border-box",
            }}
          >
            <Box
              sx={{
                width: "100%",
                maxWidth: 1400,
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
