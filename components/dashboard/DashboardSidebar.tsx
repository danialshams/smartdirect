"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  Check,
  ImagePlus,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  MessageCircleReply,
  MessageCircleQuestion,
  Plus,
  Ticket,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  Avatar,
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
  profilePictureUrl?: string | null;
};

type DashboardSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
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
      { title: "پاسخ خودکار استوری", href: "/dashboard/story-automation", icon: Zap },
      { title: "سؤال‌های شروع گفتگو", href: "/dashboard/ice-breaker", icon: MessageCircleQuestion },
      { title: "منوی دایرکت", href: "/dashboard/persistent-menu", icon: MenuIcon },
      { title: "تیکت‌ها", href: "/dashboard/tickets", icon: Ticket },
    ],
  },
];

function Brand() {
  return (
    <Box dir="rtl" sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
      <Box sx={{ width: 40, height: 40, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 2.5, bgcolor: "#2563EB", color: "#FFFFFF", fontSize: 16, fontWeight: 900, letterSpacing: "-0.04em" }}>S</Box>
      <Box dir="ltr" sx={{ minWidth: 0, textAlign: "left" }}>
        <Typography fontSize={14.5} fontWeight={800} noWrap color="#0F172A">SmartDirect</Typography>
        <Typography fontSize={10} noWrap sx={{ mt: 0.2, color: "#64748B" }}>Automate · Connect · Grow</Typography>
      </Box>
    </Box>
  );
}

function AccountSection({ instagramAccounts }: { instagramAccounts: InstagramAccount[] }) {
  const [accounts, setAccounts] = useState(instagramAccounts);
  const activeAccount = accounts.find((account) => account.isConnected);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/instagram/accounts", { cache: "no-store" });
        const result = await response.json();
        if (!cancelled && response.ok && result.success && Array.isArray(result.accounts)) {
          setAccounts(result.accounts);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Box sx={{ px: 1.25, py: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.65, px: 0.35 }}>
        <Typography fontSize={10.5} fontWeight={700} color="#64748B">پیج‌های اینستاگرام</Typography>
        <Box component={Link} href="/api/instagram/connect" aria-label="افزودن حساب" sx={{ display: "flex", alignItems: "center", gap: 0.35, color: "#2563EB", textDecoration: "none", fontSize: 10.5, fontWeight: 700, "&:hover": { color: "#1D4ED8" } }}>
          <Plus size={14} strokeWidth={2.2} />
          <span>افزودن پیج</span>
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, minWidth: 0, px: 0.9, py: 0.85, borderRadius: 1.75, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
        <Box sx={{ flexShrink: 0 }}>
          <Avatar src={activeAccount?.profilePictureUrl || undefined} alt={activeAccount?.igUsername || "Instagram"} sx={{ width: 34, height: 34, bgcolor: "#E2E8F0", color: "#64748B" }}>
            {!activeAccount?.profilePictureUrl ? <UserRound size={16} /> : null}
          </Avatar>
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography dir="ltr" noWrap fontSize={11.5} fontWeight={600} color="#0F172A" sx={{ textAlign: "right" }}>
            {activeAccount ? `@${activeAccount.igUsername}` : "پیجی متصل نیست"}
          </Typography>
        </Box>
        {activeAccount ? (
          <Box aria-label="پیج فعال" sx={{ width: 22, height: 22, display: "grid", placeItems: "center", color: "#16A34A", flexShrink: 0 }}>
            <Check size={14} strokeWidth={2.4} />
          </Box>
        ) : null}
      </Box>

    </Box>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <Box dir="rtl" sx={{ px: 1.25, py: 1.25 }}>
      {menuGroups.map((group) => (
        <Box key={group.label} sx={{ mb: 2 }}>
          <Box
            component="div"
            dir="ltr"
            sx={{
              width: "100%",
              px: 1.1,
              mb: 0.65,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            <Box
              component="span"
              dir="rtl"
              sx={{
                color: "#94A3B8",
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1.5,
                whiteSpace: "nowrap",
              }}
            >
              {group.label}
            </Box>
          </Box>
          <List disablePadding sx={{ display: "grid", gap: 0.35 }}>
            {group.items.map(({ href, title, icon: Icon }) => {
              const active = href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <ListItemButton key={href} component={Link} href={href} onClick={onNavigate} selected={active} dir="rtl"
                  sx={{ minHeight: 40, display: "flex", flexDirection: "row", alignItems: "center", columnGap: 1, borderRadius: 1.75, px: 1.1, color: active ? "#2563EB" : "#475569", "&.Mui-selected": { bgcolor: "#EFF6FF", color: "#2563EB" }, "&.Mui-selected:hover": { bgcolor: "#EFF6FF" }, "&:hover": { bgcolor: "#F8FAFC", color: "#1D4ED8" } }}>
                  <ListItemIcon sx={{ minWidth: 0, width: 18, flex: "0 0 18px", color: "inherit", display: "flex", justifyContent: "center", alignItems: "center", m: 0 }}>
                    <Icon size={18} strokeWidth={1.9} />
                  </ListItemIcon>
                  <ListItemText primary={title} sx={{ minWidth: 0, flex: "0 1 auto", m: 0, textAlign: "right", direction: "rtl" }} primaryTypographyProps={{ fontSize: 12.5, fontWeight: active ? 700 : 500 }} />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      ))}
    </Box>
  );
}

function SidebarContent({
  mobile = false,
  onClose,
  instagramAccounts,
}: {
  mobile?: boolean;
  onClose?: () => void;
  instagramAccounts: InstagramAccount[];
}) {
  return (
    <Box dir="rtl" sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "#FFFFFF" }}>
      <Box sx={{ minHeight: { xs: 68, sm: 72, lg: 76 }, boxSizing: "border-box", flexShrink: 0, display: "flex", alignItems: "center", gap: 1.25, px: 1.75, borderBottom: "1px solid #E2E8F0" }}>
        <Link href="/dashboard" onClick={onClose} style={{ textDecoration: "none", minWidth: 0, flex: 1 }}>
          <Brand />
        </Link>
        {mobile && <IconButton size="small" onClick={onClose} aria-label="بستن منو" sx={{ color: "#64748B" }}><X size={18} /></IconButton>}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Navigation onNavigate={onClose} />
      </Box>
      <Divider sx={{ borderColor: "#E2E8F0" }} />
      <Box sx={{ p: 1.25 }}>
        <Box component="button" type="button" onClick={() => void signOut({ callbackUrl: "/login" })}
          sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1.25, border: 0, borderRadius: 1.75, bgcolor: "transparent", color: "#DC2626", px: 1.1, py: 1.1, cursor: "pointer", fontFamily: "inherit", textAlign: "right", "&:hover": { bgcolor: "#FEF2F2", color: "#B91C1C" } }}>
          <LogOut size={18} strokeWidth={1.9} />
          <Typography component="span" fontSize={12.5} fontWeight={600}>خروج از حساب</Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function DashboardSidebar({
  mobileOpen,
  onMobileClose,
  instagramAccounts,
}: DashboardSidebarProps) {
  return (
    <>
      <Drawer variant="permanent" anchor="left" sx={{ display: { xs: "none", lg: "block" }, width: 196, flexShrink: 0, "& .MuiDrawer-paper": { width: 196, boxSizing: "border-box", borderLeft: "1px solid #E2E8F0", borderRight: 0, direction: "rtl" } }}>
        <SidebarContent instagramAccounts={instagramAccounts} />
      </Drawer>
      <Drawer variant="temporary" anchor="left" open={mobileOpen} onClose={onMobileClose} ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", lg: "none" }, "& .MuiDrawer-paper": { width: { xs: "min(68vw, 220px)", sm: 235 }, boxSizing: "border-box", borderLeft: "1px solid #E2E8F0", borderRight: 0, direction: "rtl" } }}>
        <SidebarContent mobile onClose={onMobileClose} instagramAccounts={instagramAccounts} />
      </Drawer>
    </>
  );
}


export function DashboardInstagramIsland({ instagramAccounts }: { instagramAccounts: InstagramAccount[] }) {
  return (
    <Box
      dir="rtl"
      sx={{
        position: "fixed",
        zIndex: (theme) => theme.zIndex.drawer + 2,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        left: { xs: 12, lg: "calc(50% - 98px)" },
        right: { xs: 12, lg: "auto" },
        transform: { xs: "none", lg: "translateX(-50%)" },
        width: { xs: "auto", lg: "calc(100% - 244px)" },
        maxWidth: 520,
        boxSizing: "border-box",
        border: "1px solid #E2E8F0",
        borderRadius: 3,
        bgcolor: "rgba(255,255,255,0.97)",
        boxShadow: "0 12px 36px rgba(15,23,42,0.12)",
        backdropFilter: "blur(16px)",
        overflow: "hidden",
      }}
    >
      <AccountSection instagramAccounts={instagramAccounts} />
    </Box>
  );
}
