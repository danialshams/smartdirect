"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Box, Typography } from "@mui/material";
import { Images, UsersRound, UserRoundPlus } from "lucide-react";

type Profile = {
  accountId: string;
  igUserId: string;
  username: string;
  name: string | null;
  biography: string | null;
  website: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  accountType: string | null;
  connectedAt: string;
};

const numberFormatter = new Intl.NumberFormat("fa-IR");

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function Reveal({
  children,
  delay,
  visible,
  sx,
  from = "left",
}: {
  children: React.ReactNode;
  delay: number;
  visible: boolean;
  sx?: Record<string, unknown>;
  from?: "left" | "right";
}) {
  return (
    <Box
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : `translateX(${from === "right" ? "28px" : "-28px"})`,
        transition: "opacity 600ms cubic-bezier(0.22, 1, 0.36, 1), transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
        transitionDelay: `${delay}ms`,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export default function InstagramProfileDashboard({
  accountId,
  onProfileLoaded,
  onProfileLoadingChange,
}: {
  accountId: string;
  onProfileLoaded?: (name: string | null) => void;
  onProfileLoadingChange?: (loading: boolean) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(accountId));
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const loadedAccountIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!accountId) {
      setLoading(false);
      return;
    }

    if (loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;

    try {
      setLoading(true);
      onProfileLoadingChange?.(true);
      setError("");
      setProfile(null);
      setVisible(false);

      const response = await fetch(
        "/api/instagram/profile?accountId=" + encodeURIComponent(accountId),
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!response.ok || !result.success || !result.profile) {
        throw new Error(result.error || "اطلاعات پروفایل دریافت نشد.");
      }

      setProfile(result.profile);
      onProfileLoaded?.(result.profile.name);
      window.setTimeout(() => setVisible(true), 80);
    } catch (requestError) {
      loadedAccountIdRef.current = null;
      setProfile(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "خطا در دریافت اطلاعات پروفایل.",
      );
    } finally {
      setLoading(false);
      onProfileLoadingChange?.(false);
    }
  }, [accountId, onProfileLoaded, onProfileLoadingChange]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (!accountId) return null;

  if (loading) {
    return (
      <Box
        dir="rtl"
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <Box
          aria-label="در حال دریافت اطلاعات"
          sx={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "3px solid #E2E8F0",
            borderTopColor: "#2563EB",
            animation: "sdDashboardSpin 800ms linear infinite",
          }}
        />
        <style jsx global>{`
          @keyframes sdDashboardSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Box>
    );
  }
  if (error) {
    return (
      <Box
        dir="rtl"
        sx={{
          minHeight: "calc(100dvh - 120px)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          px: 2,
          pt: 5,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 560,
            border: "1px solid #FECACA",
            bgcolor: "#FEF2F2",
            color: "#B91C1C",
            borderRadius: 2,
            px: 2,
            py: 1.5,
            textAlign: "center",
            fontSize: 12,
            lineHeight: 2,
          }}
        >
          {error}
        </Box>
      </Box>
    );
  }

  if (!profile) return null;

  return (
    <Box
      dir="rtl"
      sx={{
        width: "100%",
        mt: { xs: 2, sm: 2.5, md: 3, lg: 3.5 },
        px: { xs: 1, sm: 1.5, md: 2.5, lg: 5 },
        pb: { xs: 12, lg: 5 },
      }}
    >
      <Box sx={{ width: "100%" }}>
        <Reveal visible={visible} delay={550} from="right" sx={{ height: "100%" }}>
          <Box
            sx={{
              height: "100%",
              minHeight: { xs: 220, sm: 250, lg: 285 },
              p: { xs: 2, sm: 2.5, md: 3, lg: 3.5 },
              border: "1px solid #E2E8F0",
              borderRadius: { xs: 3, md: 3.5 },
              bgcolor: "#FFFFFF",
              boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
              display: "flex",
              alignItems: "center",
              gap: { xs: 3, sm: 4, md: 5 },
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                width: 180,
                height: 180,
                borderRadius: "50%",
                bgcolor: "rgba(37,99,235,0.055)",
                top: -90,
                left: -60,
              }}
            />
            <Box
              sx={{
                position: "relative",
                width: { xs: 92, sm: 112, md: 132 },
                height: { xs: 92, sm: 112, md: 132 },
                flexShrink: 0,
                overflow: "hidden",
                borderRadius: "50%",
                border: "4px solid #EFF6FF",
                bgcolor: "#F8FAFC",
              }}
            >
              {profile.profilePictureUrl ? (
                <Avatar src={profile.profilePictureUrl} alt={profile.username} sx={{ width: "100%", height: "100%" }} />
              ) : (
                <Box sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#64748B", fontSize: 28, fontWeight: 300 }}>?</Box>
              )}
            </Box>

            <Box sx={{ minWidth: 0, position: "relative", textAlign: "right" }}>
              <Typography
                sx={{
                  color: "#0F172A",
                  fontSize: { xs: 18, sm: 21, md: 24 },
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                }}
              >
                {profile.name || `@${profile.username}`}
              </Typography>
              <Typography dir="ltr" sx={{ mt: 0.45, color: "#64748B", fontSize: { xs: 12.5, sm: 13.5, md: 14 }, fontWeight: 500 }}>
                @{profile.username}
              </Typography>
              {profile.biography ? (
                <Typography
                  sx={{
                    mt: 1.25,
                    color: "#475569",
                    fontSize: { xs: 11.5, sm: 12.5 },
                    lineHeight: 1.9,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {profile.biography}
                </Typography>
              ) : null}
            </Box>
          </Box>
        </Reveal>
      </Box>

      <Reveal visible={visible} delay={1000} from="left">
        <Box sx={{ mt: { xs: 1.5, sm: 2, lg: 2.5 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: { xs: 1, sm: 1.5, md: 2 },
            }}
          >
            <Box sx={{ minWidth: 0, p: { xs: 1.25, sm: 1.75 }, borderRadius: 2.5, bgcolor: "#F0FDF4", border: "1px solid #DCFCE7" }}>
              <Box sx={{ width: 28, height: 28, mb: 1, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#16A34A", color: "#FFFFFF" }}>
                <UserRoundPlus size={15} strokeWidth={2} />
              </Box>
              <AnimatedProfileStat label="فالووینگ" value={profile.followsCount} visible={visible} countDelay={1150} />
            </Box>
            <Box sx={{ minWidth: 0, p: { xs: 1.25, sm: 1.75 }, borderRadius: 2.5, bgcolor: "#F5F3FF", border: "1px solid #EDE9FE" }}>
              <Box sx={{ width: 28, height: 28, mb: 1, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#7C3AED", color: "#FFFFFF" }}>
                <UsersRound size={15} strokeWidth={2} />
              </Box>
              <AnimatedProfileStat label="فالوور" value={profile.followersCount} visible={visible} countDelay={1250} />
            </Box>
            <Box sx={{ minWidth: 0, p: { xs: 1.25, sm: 1.75 }, borderRadius: 2.5, bgcolor: "#EFF6FF", border: "1px solid #DBEAFE" }}>
              <Box sx={{ width: 28, height: 28, mb: 1, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#2563EB", color: "#FFFFFF" }}>
                <Images size={15} strokeWidth={2} />
              </Box>
              <AnimatedProfileStat label="پست" value={profile.mediaCount} visible={visible} countDelay={1350} />
            </Box>
          </Box>
        </Box>
      </Reveal>

    </Box>
  );

}

function AnimatedProfileStat({
  label,
  value,
  visible,
  countDelay,
}: {
  label: string;
  value: number | null;
  visible: boolean;
  countDelay: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!visible || value == null) return;

    let frame = 0;

    const timeout = window.setTimeout(() => {
      const start = performance.now();
      const duration = 900;

      const animate = (timestamp: number) => {
        const progress = Math.min((timestamp - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        setDisplayValue(value * eased);

        if (progress < 1) {
          frame = requestAnimationFrame(animate);
        }
      };

      frame = requestAnimationFrame(animate);
    }, countDelay);

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [countDelay, value, visible]);

  return (
    <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Typography
        sx={{
          color: "#0F172A",
          fontSize: { xs: 16, sm: 18, md: 20 },
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {value == null ? "—" : formatNumber(displayValue)}
      </Typography>
      <Typography
        sx={{
          mt: 0.5,
          color: "#64748B",
          fontSize: { xs: 11, sm: 12, md: 14 },
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
