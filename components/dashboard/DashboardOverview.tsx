"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Typography,
} from "@mui/material";
import { Heart } from "lucide-react";

import InstagramProfileDashboard from "./InstagramProfileDashboard";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type DashboardOverviewProps = {
  user: {
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  };
  instagramAccounts: InstagramAccount[];
};

export default function DashboardOverview({
  user,
  instagramAccounts,
}: DashboardOverviewProps) {
  const connectedAccounts = instagramAccounts.filter(
    (account) => account.isConnected,
  );

  const [accountId, setAccountId] = useState(connectedAccounts[0]?.id || "");
  const [profileLoading, setProfileLoading] = useState(Boolean(connectedAccounts[0]?.id));

  useEffect(() => {
    if (!connectedAccounts.some((account) => account.id === accountId)) {
      setAccountId(connectedAccounts[0]?.id || "");
    }
  }, [accountId, connectedAccounts]);

  useEffect(() => {
    setProfileLoading(Boolean(accountId));
  }, [accountId]);

  const handleProfileLoadingChange = useCallback((loading: boolean) => {
    setProfileLoading(loading);
  }, []);

  if (!connectedAccounts.length) {
    return (
      <Box
        dir="rtl"
        sx={{
          minHeight: "calc(100vh - 120px)",
          display: "grid",
          placeItems: "center",
          px: 2,
        }}
      >
        <Button
          component="a"
          href="/api/instagram/connect"
          variant="contained"
          sx={{
            minHeight: 44,
            px: 3,
            bgcolor: "#2563EB",
            "&:hover": { bgcolor: "#1D4ED8" },
          }}
        >
          اتصال پیج
        </Button>
      </Box>
    );
  }

  return (
    <Box dir="rtl" sx={{ width: "100%" }}>
      {!profileLoading ? (
      <Box
        dir="rtl"
        sx={{
          width: "100%",
          px: { xs: 1, sm: 1.5, md: 2.5, lg: 5 },
          pt: { xs: 1.5, sm: 2.5, md: 3.5, lg: 5 },
        }}
      >
        <Box
          sx={{
            width: "100%",
            minHeight: { xs: 78, sm: 88, md: 96 },
            px: { xs: 2, sm: 2.5, md: 3 },
            py: { xs: 1.75, sm: 2, md: 2.25 },
            border: "1px solid #E2E8F0",
            borderRadius: { xs: 3, md: 3.5 },
            bgcolor: "#FFFFFF",
            boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
            display: "flex",
            alignItems: "center",
            animation: "sdGreetingEnter 500ms ease both",
          }}
        >
          <Typography
            component="h1"
            sx={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 0.75,
              fontSize: { xs: 14, sm: 17, md: 19 },
              fontWeight: 600,
              letterSpacing: "-0.025em",
              color: "#0F172A",
              whiteSpace: "nowrap",
              lineHeight: 1.4,
            }}
          >
            <span>{"سلام " + user.name + "، به پنل خودت خوش اومدی"}</span>
            <Heart aria-hidden="true" size={16} strokeWidth={2.2} fill="currentColor" style={{ flexShrink: 0 }} />
          </Typography>
        </Box>
      </Box>
      ) : null}

      <style jsx global>{`
        @keyframes sdGreetingPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes sdGreetingEnter {
          from { opacity: 0; transform: translateX(-28px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <InstagramProfileDashboard
        accountId={accountId}
        onProfileLoadingChange={handleProfileLoadingChange}
      />
    </Box>
  );
}
