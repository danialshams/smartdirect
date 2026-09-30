"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box, Card, CardContent, Grid, Skeleton, Stack, Typography,
} from "@mui/material";
import { BadgePercent, Camera, Headphones, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Stats = { users: number; pages: number; activeSubscriptions: number; expiredSubscriptions: number; openTickets: number };

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j; })
      .then(setStats)
      .catch(e => setError(e.message || "خطا در دریافت اطلاعات"));
  }, []);

  const cards: Array<{ title: string; value: number; icon: LucideIcon; href: string; color: string }> = stats ? [
    { title: "کاربران", value: stats.users, icon: UserRound, href: "/rickandmorty/users", color: "#2563EB" },
    { title: "پیج‌های متصل", value: stats.pages, icon: Camera, href: "/rickandmorty/users", color: "#0F172A" },
    { title: "اشتراک فعال", value: stats.activeSubscriptions, icon: Users, href: "/rickandmorty/users", color: "#16A34A" },
    { title: "تیکت‌های باز", value: stats.openTickets, icon: Headphones, href: "/rickandmorty/tickets", color: "#D97706" },
  ] : [];

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h5" fontWeight={700}>داشبورد</Typography>
        <Typography variant="body2" color="text.secondary">نمای کلی وضعیت کاربران، اشتراک‌ها و پشتیبانی</Typography>
      </Box>

      {error && <Card sx={{ borderColor: "#FECACA", bgcolor: "#FEF2F2" }}><CardContent><Typography color="error" variant="body2">{error}</Typography></CardContent></Card>}

      <Grid container spacing={2}>
        {stats ? cards.map(card => {
          const Icon = card.icon;
          return (
            <Grid key={card.title} size={{ xs: 12, sm: 6, xl: 3 }}>
              <Link href={card.href} style={{ textDecoration: "none" }}>
                <Card sx={{ height: "100%", transition: "transform .2s, box-shadow .2s", "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 24px rgba(15,23,42,.06)" } }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
                      <Box sx={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 2, bgcolor: "#F8FAFC" }}><Icon size={20} color={card.color} /></Box>
                      <Typography variant="caption" color="text.secondary">{card.title}</Typography>
                    </Stack>
                    <Typography variant="h4" fontWeight={700} color="text.primary">{card.value}</Typography>
                  </CardContent>
                </Card>
              </Link>
            </Grid>
          );
        }) : Array.from({ length: 4 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, xl: 3 }}><Card sx={{ p: 2 }}><Skeleton variant="rounded" height={108} /></Card></Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card><CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>وضعیت اشتراک</Typography>
            {stats ? <Grid container spacing={1.5}>
              {[
                ["فعال", stats.activeSubscriptions, "#16A34A"],
                ["منقضی", stats.expiredSubscriptions, "#DC2626"],
                ["پیج‌های متصل", stats.pages, "#0F172A"],
              ].map(([label, value, color]) => (
                <Grid key={String(label)} size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "#F8FAFC" }}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="h5" fontWeight={700} sx={{ mt: .5, color: String(color) }}>{value}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid> : <Skeleton variant="rounded" height={120} />}
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card><CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>دسترسی سریع</Typography>
            <Stack spacing={1}>
              {[
                { href: "/rickandmorty/users", label: "مدیریت کاربران", Icon: UserRound, color: "#2563EB" },
                { href: "/rickandmorty/tickets", label: "مدیریت تیکت‌ها", Icon: Headphones, color: "#D97706" },
                { href: "/rickandmorty/coupons", label: "مدیریت کدهای تخفیف", Icon: BadgePercent, color: "#16A34A" },
              ].map(({ href, label, Icon, color }) => (
                <Link key={String(href)} href={String(href)} style={{ textDecoration: "none" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, border: "1px solid #E2E8F0", borderRadius: 2, color: "#0F172A", "&:hover": { bgcolor: "#F8FAFC", borderColor: "#BFDBFE" } }}>
                    <Icon size={18} color={color} />
                    <Typography variant="body2">{label}</Typography>
                  </Box>
                </Link>
              ))}
            </Stack>
          </CardContent></Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
