"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ImagePlus,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MessageCircleReply,
  Plus,
  Settings,
  Ticket,
  UserRound,
} from "lucide-react";
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { signOut } from "next-auth/react";

type InstagramAccount = {
  id: string;
  igUsername: string;
  isConnected: boolean;
};

type DashboardSidebarProps = {
  instagramAccounts: InstagramAccount[];
};

const menuGroups = [
  {
    label: "نمای کلی",
    items: [
      { title: "داشبورد", href: "/dashboard", icon: LayoutDashboard },
      { title: "تحلیل پیج", href: "/dashboard/insights", icon: BarChart3 },
    ],
  },
  {
    label: "مدیریت",
    items: [
      { title: "انتشار محتوا", href: "/dashboard/publishing", icon: ImagePlus },
      { title: "کامنت‌ها", href: "/dashboard/comments", icon: MessageCircleReply },
      { title: "پیام‌ها", href: "/dashboard/inbox", icon: Inbox },
      { title: "پاسخ خودکار کامنت", href: "/dashboard/comment-automation", icon: Bot },
      { title: "پاسخ خودکار استوری", href: "/dashboard/story-automation", icon: Bot },
      { title: "سؤال‌های شروع گفتگو", href: "/dashboard/ice-breaker", icon: MessageCircle },
      { title: "منوی دایرکت", href: "/dashboard/persistent-menu", icon: MessageCircle },
      { title: "تیکت‌ها", href: "/dashboard/tickets", icon: Ticket },
    ],
  },
  {
    label: "حساب",
    items: [
      { title: "اشتراک", href: "/dashboard/subscription", icon: CreditCard },
      { title: "تنظیمات", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

function Brand({ compact = false, collapsed = false }: { compact?: boolean; collapsed?: boolean }) {
  return (
    <Box dir="rtl" sx={{ display: "flex", alignItems: "center", justifyContent: isMini ? "center" : "flex-start", gap: 1.25, minWidth: 0 }}>
      <Box
        sx={{
          width: compact ? 38 : 42,
          height: compact ? 38 : 42,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: 2.5,
          bgcolor: "#2563EB",
          color: "#FFFFFF",
          fontSize: compact ? 15 : 17,
          fontWeight: 900,
          letterSpacing: "-0.04em",
        }}
      >
        S
      </Box>
      {!collapsed ? (
        <Box dir="ltr" sx={{ minWidth: 0, textAlign: "left" }}>
          <Typography fontSize={15} fontWeight={800} noWrap color="#0F172A">
            SmartDirect
          </Typography>
          <Typography fontSize={10.5} noWrap sx={{ mt: 0.25, color: "#64748B" }}>
            Automate · Connect · Grow
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

function Navigation({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <Box dir="rtl" sx={{ px: isMini ? 0.75 : 1.5, py: 1.5 }}>
      {menuGroups.map((group) => (
        <Box key={group.label} sx={{ mb: collapsed ? 1.5 : 2.5 }}>
          {!collapsed ? (
            <Typography
              component="div"
              dir="rtl"
              sx={{
                width: "100%",
                px: 1.25,
                mb: 0.75,
                color: "#94A3B8",
                fontSize: 10.5,
                fontWeight: 700,
                lineHeight: 1.5,
                textAlign: "right",
              }}
            >
              {group.label}
            </Typography>
          ) : null}

          <List disablePadding sx={{ display: "grid", gap: 0.5 }}>
            {group.items.map(({ href, title, icon: Icon }) => {
              const active =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === href || pathname.startsWith(`${href}/`);

              return (
                <ListItemButton
                  key={href}
                  component={Link}
                  href={href}
                  selected={active}
                  dir="rtl"
                  title={collapsed ? title : undefined}
                  sx={{
                    minHeight: 42,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: isMini ? "center" : "flex-start",
                    columnGap: 1,
                    borderRadius: 2,
                    px: collapsed ? 1 : 1.25,
                    color: active ? "#2563EB" : "#475569",
                    "&.Mui-selected": { bgcolor: "#EFF6FF", color: "#2563EB" },
                    "&.Mui-selected:hover": { bgcolor: "#EFF6FF" },
                    "&:hover": { bgcolor: "#F8FAFC", color: "#1D4ED8" },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      width: 18,
                      flex: "0 0 18px",
                      flexShrink: 0,
                      color: "inherit",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      m: 0,
                    }}
                  >
                    <Icon size={18} strokeWidth={1.9} />
                  </ListItemIcon>

                  {!collapsed ? (
                    <ListItemText
                      primary={title}
                      sx={{ minWidth: 0, width: "auto", flex: "0 1 auto", m: 0, textAlign: "right", direction: "rtl" }}
                      primaryTypographyProps={{ fontSize: 13, fontWeight: active ? 700 : 500 }}
                    />
                  ) : null}
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      ))}
    </Box>
  );
}

function AccountSection({ accounts, collapsed }: { accounts: InstagramAccount[]; collapsed: boolean }) {
  const activeAccount = accounts.find((account) => account.isConnected);

  return (
    <Box dir="rtl" sx={{ px: collapsed ? 0.75 : 1.5, py: 1.25 }}>
      {!collapsed ? (
        <Box
          component={Link}
          href="/dashboard"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            minWidth: 0,
            p: 1,
            borderRadius: 2,
            bgcolor: "#F8FAFC",
            border: "1px solid #E2E8F0",
            color: "#0F172A",
            textDecoration: "none",
            "&:hover": { bgcolor: "#F1F5F9" },
          }}
        >
          <UserRound size={18} strokeWidth={1.9} color="#64748B" />
          <Box sx={{ minWidth: 0, flex: 1, textAlign: "right" }}>
            <Typography fontSize={10.5} color="#64748B">پیج فعال</Typography>
            <Typography dir="ltr" noWrap fontSize={12} fontWeight={700}>
              {activeAccount ? `@${activeAccount.igUsername}` : "بدون پیج"}
            </Typography>
          </Box>
        </Box>
      ) : (
        <IconButton
          component={Link}
          href="/dashboard"
          title={activeAccount ? `@${activeAccount.igUsername}` : "پیج فعال"}
          sx={{ width: "100%", height: 42, borderRadius: 2, color: "#64748B" }}
        >
          <UserRound size={19} strokeWidth={1.9} />
        </IconButton>
      )}

      {!collapsed ? (
        <Box
          component={Link}
          href="/api/instagram/connect"
          sx={{
            mt: 0.75,
            minHeight: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.75,
            borderRadius: 2,
            color: "#2563EB",
            bgcolor: "#EFF6FF",
            textDecoration: "none",
            fontSize: 11.5,
            fontWeight: 700,
            "&:hover": { bgcolor: "#DBEAFE" },
          }}
        >
          <Plus size={16} strokeWidth={2} />
          اتصال پیج جدید
        </Box>
      ) : null}
    </Box>
  );
}

export default function DashboardSidebar({ instagramAccounts }: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const isDesktop = useMediaQuery("(min-width:1200px)", { noSsr: true });
  const isMini = !isDesktop && collapsed;

  return (
    <Drawer
      variant="permanent"
      anchor="left"
      sx={{
        width: { xs: 72, lg: 248 },
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: isMini ? 72 : 248,
          boxSizing: "border-box",
          borderRight: "1px solid #E2E8F0",
          direction: "rtl",
          overflowX: "visible",
          transition: "width 180ms ease",
          boxShadow: isMini ? "none" : { xs: "12px 0 32px rgba(15,23,42,0.10)", lg: "none" },
          zIndex: { xs: 1300, lg: "auto" },
        },
      }}
    >
      <Box
        dir="rtl"
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          bgcolor: "#FFFFFF",
          overflow: "hidden",
        }}
      >
        <Box sx={{ minHeight: 72, display: "flex", alignItems: "center", justifyContent: isMini ? "center" : "space-between", px: isMini ? 1 : 2, borderBottom: "1px solid #E2E8F0" }}>
          <Link href="/dashboard" style={{ textDecoration: "none", minWidth: 0 }}>
            <Brand compact={isMini} collapsed={isMini} />
          </Link>
          <IconButton
            size="small"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={isMini ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
            title={isMini ? "باز کردن منو" : "جمع کردن منو"}
            sx={{
              display: { xs: "inline-flex", lg: "none" },
              color: "#64748B",
              position: isMini ? "absolute" : "static",
              right: isMini ? -13 : "auto",
              top: 25,
              width: 26,
              height: 26,
              bgcolor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              "&:hover": { bgcolor: "#F8FAFC" },
            }}
          >
            {isMini ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <Navigation collapsed={isMini} />
        </Box>

        <Divider sx={{ borderColor: "#E2E8F0" }} />
        <AccountSection accounts={instagramAccounts} collapsed={isMini} />

        <Box sx={{ px: isMini ? 0.75 : 1.5, pb: 1.25 }}>
          <Box
            component="button"
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            title="خروج از حساب"
            sx={{
              width: "100%",
              minHeight: 38,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: isMini ? "center" : "flex-start",
              gap: 1.25,
              border: 0,
              borderRadius: 2,
              bgcolor: "transparent",
              color: "#64748B",
              px: isMini ? 0 : 1.25,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "right",
              "&:hover": { bgcolor: "#FEF2F2", color: "#DC2626" },
            }}
          >
            <LogOut size={18} strokeWidth={1.9} />
            {!isMini ? <Typography component="span" fontSize={12.5} fontWeight={500}>خروج از حساب</Typography> : null}
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
