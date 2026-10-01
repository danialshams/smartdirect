"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  CreditCard,
  ImagePlus,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  MessageCircleReply,
  Plus,
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
      { title: "سؤال‌های شروع گفتگو", href: "/dashboard/ice-breaker", icon: MessageCircle },
      { title: "منوی دایرکت", href: "/dashboard/persistent-menu", icon: MenuIcon },
      { title: "تیکت‌ها", href: "/dashboard/tickets", icon: MessageCircle },
    ],
  },
  {
    label: "حساب",
    items: [
      { title: "اشتراک", href: "/dashboard/subscription", icon: CreditCard },
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, minWidth: 0, px: 0.9, py: 0.85, borderRadius: 1.75, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
        <Box sx={{ position: "relative", flexShrink: 0 }}>
          <Avatar src={activeAccount?.profilePictureUrl || undefined} alt={activeAccount?.igUsername || "Instagram"} sx={{ width: 34, height: 34, bgcolor: "#E2E8F0", color: "#64748B" }}>
            {!activeAccount?.profilePictureUrl ? <UserRound size={16} /> : null}
          </Avatar>
          {activeAccount && <Box sx={{ position: "absolute", right: -1, bottom: -1, width: 9, height: 9, borderRadius: "50%", bgcolor: "#22C55E", border: "2px solid #F8FAFC" }} />}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography dir="ltr" noWrap fontSize={11.5} fontWeight={600} color="#0F172A" sx={{ textAlign: "right" }}>
            {activeAccount ? `@${activeAccount.igUsername}` : "پیجی متصل نیست"}
          </Typography>
          <Typography noWrap fontSize={9.5} sx={{ mt: 0.15, color: "#64748B" }}>
            {activeAccount ? "پیج فعال" : "برای شروع پیج متصل کنید"}
          </Typography>
        </Box>
        <Box component={Link} href="/api/instagram/connect" aria-label="اتصال پیج جدید" sx={{ width: 28, height: 28, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 1.5, color: "#2563EB", bgcolor: "#EFF6FF", textDecoration: "none", "&:hover": { bgcolor: "#DBEAFE" } }}>
          <Plus size={15} strokeWidth={2} />
        </Box>
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
          <Box component="div" dir="rtl" sx={{ width: "100%", px: 1.1, mb: 0.65, color: "#94A3B8", fontSize: 10, fontWeight: 700, lineHeight: 1.5, textAlign: "right", direction: "rtl" }}>
            {group.label}
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
      <Box sx={{ minHeight: 68, display: "flex", alignItems: "center", gap: 1.25, px: 1.75, borderBottom: "1px solid #E2E8F0" }}>
        <Link href="/dashboard" onClick={onClose} style={{ textDecoration: "none", minWidth: 0, flex: 1 }}>
          <Brand />
        </Link>
        {mobile && <IconButton size="small" onClick={onClose} aria-label="بستن منو" sx={{ color: "#64748B" }}><X size={18} /></IconButton>}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Navigation onNavigate={onClose} />
        <Divider sx={{ mx: 1.25, borderColor: "#E2E8F0" }} />
        <AccountSection instagramAccounts={instagramAccounts} />
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
      <Drawer variant="permanent" anchor="right" sx={{ display: { xs: "none", lg: "block" }, width: 220, flexShrink: 0, "& .MuiDrawer-paper": { width: 220, boxSizing: "border-box", borderLeft: "1px solid #E2E8F0", borderRight: 0, direction: "rtl" } }}>
        <SidebarContent instagramAccounts={instagramAccounts} />
      </Drawer>
      <Drawer variant="temporary" anchor="right" open={mobileOpen} onClose={onMobileClose} ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", lg: "none" }, "& .MuiDrawer-paper": { width: { xs: "min(84vw, 300px)", sm: 320 }, boxSizing: "border-box", borderLeft: "1px solid #E2E8F0", borderRight: 0, direction: "rtl" } }}>
        <SidebarContent mobile onClose={onMobileClose} instagramAccounts={instagramAccounts} />
      </Drawer>
    </>
  );
}
