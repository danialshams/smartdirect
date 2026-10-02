"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Typography,
} from "@mui/material";

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
          }}
        >
          {profileLoading ? (
            <Box
              aria-hidden="true"
              sx={{
                width: { xs: 150, sm: 175, md: 195 },
                height: { xs: 24, sm: 28, md: 30 },
                borderRadius: 1.5,
                bgcolor: "#E2E8F0",
                animation: "sdGreetingPulse 1.6s ease-in-out infinite",
              }}
            />
          ) : (
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 19, sm: 23, md: 26 },
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "#0F172A",
              }}
            >
              {`سلام ${user.name}، به پنل خودت خوش اومدی`} <span aria-hidden="true" style={{ fontSize: "0.9em", lineHeight: 1 }}>♥</span>
            </Typography>
          )}
        </Box>
      </Box>

      <style jsx global>{`
        @keyframes sdGreetingPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>

      <InstagramProfileDashboard
        accountId={accountId}
        onProfileLoadingChange={handleProfileLoadingChange}
      />
    </Box>
  );
}
