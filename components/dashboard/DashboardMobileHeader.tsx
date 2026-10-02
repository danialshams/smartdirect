"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Menu as MenuIcon, CreditCard } from "lucide-react";
import { AppBar, Box, IconButton, Popover, Toolbar, Typography } from "@mui/material";

type DashboardMobileHeaderProps = { onMenuOpen: () => void };

const TEST_SUBSCRIPTION_MODE = true;
const TEST_DURATION_MS = 60_000;

type SubscriptionData = {
  planKey: string;
  status: string;
  startedAt: string;
  expiresAt: string;
};

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return { value: totalSeconds, unit: "ثانیه" };
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return { value: totalMinutes, unit: "دقیقه" };
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) return { value: totalHours, unit: "ساعت" };
  return { value: Math.ceil(totalHours / 24), unit: "روز" };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function SubscriptionIndicator() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/subscription/current", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled && result.success && result.subscription) setSubscription(result.subscription);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(timer);
  }, []);

  const timing = useMemo(() => {
    if (TEST_SUBSCRIPTION_MODE) {
      const elapsed = now % TEST_DURATION_MS;
      return { remainingMs: TEST_DURATION_MS - elapsed, totalMs: TEST_DURATION_MS };
    }
    if (!subscription) return null;
    const startedAt = new Date(subscription.startedAt).getTime();
    const expiresAt = new Date(subscription.expiresAt).getTime();
    return { remainingMs: Math.max(0, expiresAt - now), totalMs: Math.max(1, expiresAt - startedAt) };
  }, [now, subscription]);

  const remaining = timing ? formatRemaining(timing.remainingMs) : { value: 0, unit: "روز" };
  const progress = timing ? Math.min(100, Math.max(0, (timing.remainingMs / timing.totalMs) * 100)) : 0;
  const hue = Math.round(Math.max(0, Math.min(120, progress * 1.2)));
  const ringColor = `hsl(${hue} 72% 44%)`;
  const open = Boolean(anchorEl);

  return (
    <>
      <Box component="button" type="button" onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="وضعیت اشتراک"
        sx={{ position: "absolute", right: { xs: 10, sm: 18, lg: 24 }, top: "50%", transform: "translateY(-50%)", width: { xs: 48, sm: 52, lg: 56 }, height: { xs: 48, sm: 52, lg: 56 }, p: 0, border: 0, bgcolor: "transparent", cursor: "pointer", fontFamily: "inherit", display: "grid", placeItems: "center" }}>
        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <svg width="100%" height="100%" viewBox="0 0 60 60" aria-hidden="true" style={{ display: "block" }}>
            <circle cx="30" cy="30" r="27" fill="none" stroke="#E2E8F0" strokeWidth="3.5" />
            <path
              d="M 30 3 A 27 27 0 1 1 30 57 A 27 27 0 1 1 30 3"
              fill="none"
              stroke={ringColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - progress}
              style={{ transition: "stroke-dashoffset 50ms linear, stroke 150ms linear" }}
            />
          </svg>
        </Box>
        <Box sx={{ position: "absolute", inset: 4, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.96)" }} />
        <Box sx={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: "#0F172A" }}>
          <Typography component="span" sx={{ fontSize: { xs: 13, sm: 14, lg: 15 }, fontWeight: 800, lineHeight: 1 }}>{remaining.value.toLocaleString("fa-IR")}</Typography>
          <Typography component="span" sx={{ mt: 0.2, fontSize: { xs: 8, sm: 8.5, lg: 9 }, fontWeight: 600, lineHeight: 1, color: "#64748B" }}>{remaining.unit}</Typography>
        </Box>
      </Box>

      <Popover open={open} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: 1, width: 230, p: 1.5, borderRadius: 2.5, border: "1px solid #E2E8F0", boxShadow: "0 10px 30px rgba(15,23,42,0.10)" } } }}>
        <Box dir="rtl">
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mb: 1.25 }}><CreditCard size={17} /><Typography fontSize={13} fontWeight={800}>اشتراک</Typography></Box>
          <Typography fontSize={12} fontWeight={700} color="#0F172A">{remaining.value.toLocaleString("fa-IR")} {remaining.unit} باقی مانده</Typography>
          {!TEST_SUBSCRIPTION_MODE && subscription ? (
            <Box sx={{ mt: 1.1 }}>
              <Typography fontSize={10.5} color="#64748B">شروع: {formatDate(subscription.startedAt)}</Typography>
              <Typography fontSize={10.5} color="#64748B" sx={{ mt: 0.35 }}>پایان: {formatDate(subscription.expiresAt)}</Typography>
            </Box>
          ) : <Typography fontSize={10.5} color="#94A3B8" sx={{ mt: 0.8 }}>حالت تست: شمارش معکوس ۱ دقیقه‌ای</Typography>}
          <Box component={Link} href="/dashboard/subscription" onClick={() => setAnchorEl(null)}
            sx={{ display: "flex", justifyContent: "center", mt: 1.25, py: 0.7, borderRadius: 1.5, bgcolor: "#EFF6FF", color: "#2563EB", textDecoration: "none", fontSize: 11, fontWeight: 700 }}>
            مدیریت اشتراک
          </Box>
        </Box>
      </Popover>
    </>
  );
}

export default function DashboardMobileHeader({ onMenuOpen }: DashboardMobileHeaderProps) {
  return (
    <AppBar position="sticky" color="inherit"
      sx={{ bgcolor: "rgba(255,255,255,0.96)", color: "#0F172A", borderBottom: "1px solid #E2E8F0", backdropFilter: "blur(12px)", zIndex: (theme) => theme.zIndex.drawer - 1 }}>
      <Toolbar sx={{ minHeight: { xs: 68, sm: 72, lg: 76 }, px: { xs: 1.5, sm: 2.5, lg: 3.5 }, position: "relative" }}>
        <IconButton onClick={onMenuOpen} aria-label="باز کردن منو"
          sx={{ display: { xs: "inline-flex", lg: "none" }, position: "absolute", left: { xs: 12, sm: 20 }, color: "#0F172A", width: 40, height: 40 }}>
          <MenuIcon size={20} strokeWidth={2} />
        </IconButton>
        <Typography sx={{ display: { xs: "block", lg: "none" }, position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: { xs: 14, sm: 15 }, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap", pointerEvents: "none" }}>SmartDirect</Typography>
        <Box sx={{ display: { xs: "none", lg: "block" }, position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", pointerEvents: "none" }}>SmartDirect</Box>
        <SubscriptionIndicator />
        <Box sx={{ flex: 1 }} />
      </Toolbar>
    </AppBar>
  );
}
