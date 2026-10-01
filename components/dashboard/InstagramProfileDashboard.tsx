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
  greetingName,
  onProfileLoaded,
}: {
  accountId: string;
  greetingName: string;
  onProfileLoaded?: (name: string | null) => void;
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
    }
  }, [accountId, onProfileLoaded]);

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
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          px: 2,
          pt: { xs: 4, sm: 5, md: 6 },
        }}
      >
        <Box sx={{ width: "100%", textAlign: "right" }}>
          <Box
            sx={{
              ml: "auto",
              width: 145,
              height: 22,
              borderRadius: 1.5,
              bgcolor: "#E2E8F0",
              animation: "sdPulse 1.6s ease-in-out infinite",
            }}
          />
        </Box>

        <Box
          sx={{
            mt: { xs: "12vh", sm: "14vh", md: "15vh" },
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              width: { xs: 112, sm: 128, md: 144, lg: 160 },
              height: { xs: 112, sm: 128, md: 144, lg: 160 },
              borderRadius: "50%",
              bgcolor: "#E2E8F0",
              animation: "sdPulse 1.6s ease-in-out infinite",
            }}
          />
          <Box
            sx={{
              mt: 2.5,
              width: 128,
              height: 20,
              borderRadius: 1.5,
              bgcolor: "#E2E8F0",
              animation: "sdPulse 1.6s ease-in-out infinite",
            }}
          />
        </Box>

        <Box
          dir="ltr"
          sx={{
            mt: { xs: "18vh", sm: "19vh", md: "20vh", lg: "22vh" },
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
                width: 56,
                height: 40,
                borderRadius: 1.5,
                bgcolor: "#E2E8F0",
                animation: "sdPulse 1.6s ease-in-out infinite",
              }}
            />
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
        position: "relative",
        minHeight: "calc(100dvh - 120px)",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        px: { xs: 2, sm: 3, md: 4, lg: 5 },
        pt: { xs: 2.5, sm: 3.5, md: 4, lg: 5 },
      }}
    >
      <Reveal
        visible={visible}
        delay={0}
        sx={{ width: "100%", alignSelf: "flex-start" }}
      >
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 20, sm: 24, md: 26 },
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "#0F172A",
          }}
        >
          سلام، {greetingName}
        </Typography>
      </Reveal>

      <Box sx={{ display: "flex", width: "100%", flexDirection: "column", alignItems: "center" }}>
        <Reveal visible={visible} delay={180}>
          <Box
            sx={{
              mt: { xs: "12vh", sm: "14vh", md: "15vh", lg: "16vh" },
              width: { xs: 112, sm: 128, md: 144, lg: 160 },
              height: { xs: 112, sm: 128, md: 144, lg: 160 },
              overflow: "hidden",
              borderRadius: "50%",
              border: "1px solid #E2E8F0",
              bgcolor: "#F8FAFC",
            }}
          >
            {profile.profilePictureUrl ? (
              <Avatar
                src={profile.profilePictureUrl}
                alt={profile.username}
                sx={{ width: "100%", height: "100%" }}
              />
            ) : (
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  color: "#64748B",
                  fontSize: 34,
                  fontWeight: 300,
                }}
              >
                ?
              </Box>
            )}
          </Box>
        </Reveal>

        <Reveal visible={visible} delay={340}>
          <Typography
            dir="ltr"
            sx={{
              mt: 2.5,
              color: "#64748B",
              fontSize: { xs: 14, md: 15 },
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            @{profile.username}
          </Typography>
        </Reveal>
      </Box>

      <Box
        dir="ltr"
        sx={{
          mt: { xs: "18vh", sm: "19vh", md: "20vh", lg: "22vh" },
          width: "100%",
          maxWidth: 600,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
        }}
      >
        <Reveal visible={visible} delay={520}>
          <AnimatedProfileStat
            label="پست"
            value={profile.mediaCount}
            visible={visible}
            countDelay={1220}
          />
        </Reveal>
        <Reveal visible={visible} delay={680}>
          <AnimatedProfileStat
            label="فالوور"
            value={profile.followersCount}
            visible={visible}
            countDelay={1380}
          />
        </Reveal>
        <Reveal visible={visible} delay={840}>
          <AnimatedProfileStat
            label="فالووینگ"
            value={profile.followsCount}
            visible={visible}
            countDelay={1540}
          />
        </Reveal>
      </Box>

      <style jsx global>{`
        @keyframes sdPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>
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
