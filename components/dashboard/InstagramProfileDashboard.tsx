"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Box,
  CircularProgress,
  Typography,
} from "@mui/material";

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
}: {
  children: React.ReactNode;
  delay: number;
  visible: boolean;
  sx?: Record<string, unknown>;
}) {
  return (
    <Box
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 700ms ease, transform 700ms ease",
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

  const loadProfile = useCallback(async () => {
    if (!accountId) {
      setLoading(false);
      return;
    }

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
          minHeight: "calc(100dvh - 120px)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          px: 2,
          pt: { xs: 4, sm: 5, md: 6 },
        }}
      >
        <Box
          sx={{
            mt: { xs: "7vh", sm: "9vh", md: "11vh" },
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              width: { xs: 112, sm: 128, md: 144, lg: 160 },
              height: { xs: 112, sm: 128, md: 144, lg: 160 },
              flexShrink: 0,
              borderRadius: "50%",
              bgcolor: "#E2E8F0",
              animation: "sdPulse 1.6s ease-in-out infinite",
            }}
          />
          <Box
            sx={{
              mt: 2.5,
              width: { xs: 96, sm: 108, md: 120, lg: 128 },
              height: { xs: 18, sm: 19, md: 20, lg: 20 },
              flexShrink: 0,
              borderRadius: 1.5,
              bgcolor: "#E2E8F0",
              animation: "sdPulse 1.6s ease-in-out infinite",
            }}
          />
        </Box>

        <Box
          dir="ltr"
          sx={{
            mt: { xs: "12vh", sm: "13vh", md: "15vh", lg: "22vh" },
            width: "100%",
            maxWidth: 600,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
          }}
        >
          {[0, 1, 2].map((item) => (
            <Box
              key={item}
              sx={{
                mx: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
              }}
            >
              <Box
                sx={{
                  width: { xs: 42, sm: 48, md: 54, lg: 58 },
                  height: { xs: 18, sm: 20, md: 22, lg: 24 },
                  borderRadius: 1,
                  bgcolor: "#E2E8F0",
                  animation: "sdPulse 1.6s ease-in-out infinite",
                }}
              />
              <Box
                sx={{
                  width: { xs: 34, sm: 38, md: 44, lg: 48 },
                  height: { xs: 12, sm: 13, md: 14, lg: 15 },
                  borderRadius: 1,
                  bgcolor: "#E2E8F0",
                  animation: "sdPulse 1.6s ease-in-out infinite",
                }}
              />
            </Box>
          ))}
        </Box>
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
        px: { xs: 1, sm: 1.5, md: 2.5, lg: 5 },
        pb: { xs: 12, lg: 5 },
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.55fr) minmax(280px, 0.85fr)" },
          gap: { xs: 1.5, sm: 2, lg: 2.5 },
          alignItems: "stretch",
        }}
      >
        <Reveal visible={visible} delay={180} sx={{ height: "100%" }}>
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
              gap: { xs: 2, sm: 2.5, md: 3 },
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

            <Box sx={{ minWidth: 0, position: "relative" }}>
              <Typography
                sx={{
                  color: "#0F172A",
                  fontSize: { xs: 18, sm: 21, md: 24 },
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                }}
              >
                {profile.name || \`@\${profile.username}\`}
              </Typography>
              <Typography dir="ltr" sx={{ mt: 0.45, color: "#64748B", fontSize: { xs: 12.5, sm: 13.5, md: 14 }, fontWeight: 500 }}>
                @{profile.username}
              </Typography>
              {profile.accountType ? (
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    mt: 1.25,
                    px: 1.1,
                    py: 0.45,
                    borderRadius: 99,
                    bgcolor: "#EFF6FF",
                    color: "#2563EB",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {profile.accountType === "BUSINESS" ? "حساب تجاری" : profile.accountType === "CREATOR" ? "حساب سازنده" : "حساب اینستاگرام"}
                </Box>
              ) : null}
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

        <Reveal visible={visible} delay={300} sx={{ height: "100%" }}>
          <Box
            sx={{
              height: "100%",
              minHeight: { xs: 150, sm: 175, lg: 285 },
              p: { xs: 2, sm: 2.5 },
              border: "1px solid #E2E8F0",
              borderRadius: { xs: 3, md: 3.5 },
              bgcolor: "#F8FAFC",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Typography sx={{ color: "#0F172A", fontSize: { xs: 14, sm: 15 }, fontWeight: 700 }}>
              اطلاعات پیج
            </Typography>
            <Box sx={{ mt: 1.5, display: "grid", gap: 1 }}>
              {profile.website ? (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Typography sx={{ color: "#94A3B8", fontSize: 11.5 }}>وب‌سایت</Typography>
                  <Typography
                    component="a"
                    href={/^https?:\/\//i.test(profile.website) ? profile.website : \`https://\${profile.website}\`}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                    noWrap
                    sx={{ color: "#2563EB", fontSize: 11.5, fontWeight: 600, textDecoration: "none", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {profile.website}
                  </Typography>
                </Box>
              ) : null}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Typography sx={{ color: "#94A3B8", fontSize: 11.5 }}>وضعیت</Typography>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, color: "#16A34A", fontSize: 11.5, fontWeight: 700 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#22C55E" }} />
                  متصل
                </Box>
              </Box>
            </Box>
          </Box>
        </Reveal>
      </Box>

      <Reveal visible={visible} delay={460}>
        <Box sx={{ mt: { xs: 1.5, sm: 2, lg: 2.5 } }}>
          <Typography sx={{ mb: 1.25, color: "#0F172A", fontSize: { xs: 14, sm: 15 }, fontWeight: 700 }}>
            آمار پیج
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: { xs: 1, sm: 1.5, md: 2 },
            }}
          >
            <Box sx={{ minWidth: 0, p: { xs: 1.25, sm: 1.75 }, borderRadius: 2.5, bgcolor: "#EFF6FF", border: "1px solid #DBEAFE" }}>
              <Box sx={{ width: 28, height: 28, mb: 1, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#2563EB", color: "#FFFFFF", fontSize: 12, fontWeight: 800 }}>پ</Box>
              <AnimatedProfileStat label="پست" value={profile.mediaCount} visible={visible} countDelay={720} />
            </Box>
            <Box sx={{ minWidth: 0, p: { xs: 1.25, sm: 1.75 }, borderRadius: 2.5, bgcolor: "#F5F3FF", border: "1px solid #EDE9FE" }}>
              <Box sx={{ width: 28, height: 28, mb: 1, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#7C3AED", color: "#FFFFFF", fontSize: 12, fontWeight: 800 }}>ف</Box>
              <AnimatedProfileStat label="فالوور" value={profile.followersCount} visible={visible} countDelay={860} />
            </Box>
            <Box sx={{ minWidth: 0, p: { xs: 1.25, sm: 1.75 }, borderRadius: 2.5, bgcolor: "#F0FDF4", border: "1px solid #DCFCE7" }}>
              <Box sx={{ width: 28, height: 28, mb: 1, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#16A34A", color: "#FFFFFF", fontSize: 12, fontWeight: 800 }}>ف</Box>
              <AnimatedProfileStat label="فالووینگ" value={profile.followsCount} visible={visible} countDelay={1000} />
            </Box>
          </Box>
        </Box>
      </Reveal>

      <Reveal visible={visible} delay={620}>
        <Box
          sx={{
            mt: { xs: 1.5, sm: 2, lg: 2.5 },
            p: { xs: 2, sm: 2.5 },
            border: "1px solid #E2E8F0",
            borderRadius: { xs: 3, md: 3.5 },
            bgcolor: "#FFFFFF",
            boxShadow: "0 6px 20px rgba(15,23,42,0.035)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography sx={{ color: "#0F172A", fontSize: { xs: 14, sm: 15 }, fontWeight: 700 }}>
              وضعیت اتصال
            </Typography>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.65, px: 1, py: 0.45, borderRadius: 99, bgcolor: "#F0FDF4", color: "#15803D", fontSize: 10.5, fontWeight: 700 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22C55E" }} />
              فعال
            </Box>
          </Box>
          <Typography sx={{ mt: 0.8, color: "#64748B", fontSize: { xs: 11.5, sm: 12.5 }, lineHeight: 1.9 }}>
            اطلاعات این پیج با اتصال فعلی اینستاگرام همگام‌سازی می‌شود.
          </Typography>
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
