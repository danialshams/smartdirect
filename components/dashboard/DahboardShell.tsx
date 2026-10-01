"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Box } from "@mui/material";

import DashboardTheme from "./DashboardTheme";
import DashboardSidebar from "./DashboardSidebar";
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
  instagramStatus: string | null;
  children?: ReactNode;
};

export default function DashboardShell({
  user,
  instagramAccounts,
  instagramStatus,
  children,
}: DashboardShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <DashboardTheme>
      <Box
        dir="rtl"
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          color: "text.primary",
        }}
      >
        <DashboardSidebar
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        <Box
          sx={{
            minWidth: 0,
            marginInlineStart: { xs: 0, lg: "248px" },
          }}
        >
          <DashboardMobileHeader
            instagramAccounts={instagramAccounts}
            onMenuOpen={() => setMobileSidebarOpen(true)}
          />

          <Box
            component="main"
            sx={{
              minHeight: "calc(100vh - 64px)",
              px: { xs: 1.5, sm: 2.5, md: 3.5, lg: 4 },
              py: { xs: 2, sm: 3, lg: 4 },
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
                  instagramStatus={instagramStatus}
                />
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </DashboardTheme>
  );
}
