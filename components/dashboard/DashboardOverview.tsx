"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
  instagramStatus: string | null;
};

export default function DashboardOverview({
  instagramAccounts,
  instagramStatus,
}: DashboardOverviewProps) {
  const connectedAccounts = instagramAccounts.filter(
    (account) => account.isConnected,
  );

  const [accountId, setAccountId] = useState(connectedAccounts[0]?.id || "");
  const [profileName, setProfileName] = useState("");
  const [profileLoading, setProfileLoading] = useState(Boolean(connectedAccounts[0]?.id));

  useEffect(() => {
    if (!connectedAccounts.some((account) => account.id === accountId)) {
      setAccountId(connectedAccounts[0]?.id || "");
    }
  }, [accountId, connectedAccounts]);

  const handleProfileLoaded = useCallback((name: string | null) => {
    setProfileName(name || "");
  }, []);

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

  const activeAccount =
    connectedAccounts.find((account) => account.id === accountId) ??
    connectedAccounts[0];

  return (
    <Box dir="rtl" sx={{ width: "100%" }}>
      <Box
        dir="rtl"
        sx={{
          width: "100%",
          px: { xs: 1, sm: 1.5, md: 2.5, lg: 5 },
          pt: { xs: 1.5, sm: 2.5, md: 3.5, lg: 5 },
          minHeight: 62,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-start",
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
              fontSize: { xs: 20, sm: 24, md: 26 },
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: "#0F172A",
            }}
          >
            سلام، {profileName || activeAccount.igUsername}
          </Typography>
        )}
      </Box>

      <style jsx global>{`
        @keyframes sdGreetingPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>

      {instagramStatus === "connected" ? (
        <Alert
          severity="success"
          sx={{
            mb: 2.5,
            border: "1px solid #BBF7D0",
            bgcolor: "#F0FDF4",
            color: "#166534",
            "& .MuiAlert-icon": { color: "#16A34A" },
          }}
        >
          پیج با موفقیت متصل شد.
        </Alert>
      ) : null}

      {instagramStatus && instagramStatus !== "connected" ? (
        <Alert
          severity="error"
          sx={{
            mb: 2.5,
            border: "1px solid #FECACA",
            bgcolor: "#FEF2F2",
            color: "#991B1B",
            "& .MuiAlert-icon": { color: "#DC2626" },
          }}
        >
          اتصال پیج انجام نشد. دوباره تلاش کنید.
        </Alert>
      ) : null}

      <InstagramProfileDashboard
        accountId={accountId}
        onProfileLoaded={handleProfileLoaded}
        onProfileLoadingChange={handleProfileLoadingChange}
      />
    </Box>
  );
}
