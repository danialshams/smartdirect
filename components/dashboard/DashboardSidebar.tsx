"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Camera,
  Check,
  ImagePlus,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  MessageCircleReply,
  MessageCircleQuestion,
  MessageSquareText,
  Plus,
  Ticket,
  UserRound,
  X,
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
      { title: "کامنت‌ها", href: "/dashboard/comments", icon: MessageSquareText },
      { title: "پیام‌ها", href: "/dashboard/inbox", icon: Inbox },
      { title: "سؤال‌های شروع گفتگو", href: "/dashboard/ice-breaker", icon: MessageCircleQuestion },
      { title: "منوی دایرکت", href: "/dashboard/persistent-menu", icon: MenuIcon },
      { title: "تیکت‌ها", href: "/dashboard/tickets", icon: Ticket },
    ],
  },
];

function Brand() {
  return (
    <Box dir="rtl" sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
      <Box sx={{ width: 48, height: 48, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 2.5, bgcolor: "#2563EB", color: "#FFFFFF", fontSize: 18, fontWeight: 900, letterSpacing: "-0.04em" }}>S</Box>
      <Box dir="ltr" sx={{ minWidth: 0, textAlign: "left" }}>
        <Typography fontSize={17} fontWeight={800} noWrap color="#0F172A">SmartDirect</Typography>
        <Typography fontSize={11} noWrap sx={{ mt: 0.2, color: "#64748B" }}>Automate · Connect · Grow</Typography>
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: { xs: 0.8, lg: 0.65 }, px: 0.35 }}>
        <Typography fontSize={10.5} fontWeight={700} color="#64748B">پیج‌های اینستاگرام</Typography>
        <Box component={Link} href="/api/instagram/connect" aria-label="افزودن حساب" sx={{ display: "flex", alignItems: "center", gap: 0.35, color: "#2563EB", textDecoration: "none", fontSize: 11, fontWeight: 700, "&:hover": { color: "#1D4ED8" } }}>
          <Plus size={16} strokeWidth={2.2} />
          <span>افزودن پیج</span>
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.05, minWidth: 0, px: 1, py: 1, borderRadius: 1.75, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
        <Box sx={{ flexShrink: 0 }}>
          <Avatar src={activeAccount?.profilePictureUrl || undefined} alt={activeAccount?.igUsername || "Instagram"} sx={{ width: 40, height: 40, bgcolor: "#E2E8F0", color: "#64748B" }}>
            {!activeAccount?.profilePictureUrl ? <UserRound size={16} /> : null}
          </Avatar>
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography dir="ltr" noWrap fontSize={13.5} fontWeight={600} color="#0F172A" sx={{ textAlign: "right" }}>
            {activeAccount ? `@${activeAccount.igUsername}` : "پیجی متصل نیست"}
          </Typography>
        </Box>
        {activeAccount ? (
          <Box aria-label="پیج فعال" sx={{ width: 24, height: 24, display: "grid", placeItems: "center", color: "#16A34A", flexShrink: 0 }}>
            <Check size={16} strokeWidth={2.4} />
          </Box>
        ) : null}
      </Box>

    </Box>
  );
}

function Navigation({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <Box dir="rtl" sx={{ px: { xs: 1.1, sm: 1.4, lg: 1.25 }, py: { xs: 1.1, sm: 1.4, lg: 1.25 } }}>
      {menuGroups.map((group) => (
        <Box key={group.label} sx={{ mb: { xs: 1.4, sm: 1.8, lg: 2 } }}>
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
          <List disablePadding sx={{ display: "grid", gridTemplateColumns: mobile ? { xs: "repeat(2, minmax(0, 1fr))", lg: "1fr" } : "1fr", gap: { xs: 0.6, lg: 0.35 } }}>
            {group.items.map(({ href, title, icon: Icon }) => {
              const active = href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <ListItemButton key={href} component={Link} href={href} onClick={onNavigate} selected={active} dir="rtl"
                  sx={{ minHeight: { xs: 58, sm: 62, lg: 40 }, display: "flex", flexDirection: "row", alignItems: "center", columnGap: { xs: 1, lg: 1 }, borderRadius: 2, px: { xs: 1.25, lg: 1.1 }, color: active ? "#2563EB" : "#475569", "&.Mui-selected": { bgcolor: "#EFF6FF", color: "#2563EB" }, "&.Mui-selected:hover": { bgcolor: "#EFF6FF" }, "&:hover": { bgcolor: "#F8FAFC", color: "#1D4ED8" } }}>
                  <ListItemIcon sx={{ minWidth: 0, width: { xs: 24, lg: 18 }, flex: { xs: "0 0 24px", lg: "0 0 18px" }, color: "inherit", display: "flex", justifyContent: "center", alignItems: "center", m: 0 }}>
                    <Icon size={23} strokeWidth={1.9} />
                  </ListItemIcon>
                  <ListItemText primary={title} sx={{ minWidth: 0, flex: "0 1 auto", m: 0, textAlign: "right", direction: "rtl" }} primaryTypographyProps={{ fontSize: { xs: 13.5, sm: 14, lg: 12.5 }, fontWeight: active ? 700 : 500, lineHeight: 1.45 }} />
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
      <Box sx={{ minHeight: { xs: 72, sm: 76, lg: 76 }, boxSizing: "border-box", flexShrink: 0, display: "flex", alignItems: "center", gap: 1.4, px: { xs: 1.6, sm: 1.9, lg: 1.75 }, borderBottom: "1px solid #E2E8F0" }}>
        <Link href="/dashboard" onClick={onClose} style={{ textDecoration: "none", minWidth: 0, flex: 1 }}>
          <Brand />
        </Link>
        {mobile && <IconButton size="small" onClick={onClose} aria-label="بستن منو" sx={{ color: "#64748B" }}><X size={18} /></IconButton>}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Navigation onNavigate={onClose} mobile={mobile} />
      </Box>
      <Box sx={{ display: { xs: "none", lg: "block" } }}>
        <Divider sx={{ mx: 1.25, borderColor: "#E2E8F0" }} />
        <Box sx={{ flexShrink: 0 }}>
          <AccountSection instagramAccounts={instagramAccounts} />
        </Box>
      </Box>
      <Divider sx={{ borderColor: "#E2E8F0", display: { xs: "block", lg: "block" } }} />
      <Box sx={{ p: { xs: 1.5, lg: 1.25 } }}>
        <Box component="button" type="button" onClick={() => void signOut({ callbackUrl: "/login" })}
          sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1.4, border: 0, borderRadius: 2, bgcolor: "transparent", color: "#DC2626", px: 1.25, py: 1.25, cursor: "pointer", fontFamily: "inherit", textAlign: "right", "&:hover": { bgcolor: "#FEF2F2", color: "#B91C1C" } }}>
          <LogOut size={20} strokeWidth={1.9} />
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
        sx={{
          display: { xs: "block", lg: "none" },
          "& .MuiDrawer-paper": {
            width: { xs: "calc(100vw - 24px)", sm: "min(360px, calc(100vw - 24px))" },
            height: "auto",
            top: { xs: 78, sm: 82 },
            bottom: { xs: 88, sm: 92 },
            left: { xs: 12, sm: 12 },
            boxSizing: "border-box",
            border: "1px solid #E2E8F0",
            borderRadius: 3,
            direction: "rtl",
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
          },
          "& .MuiBackdrop-root": {
            backgroundColor: "rgba(15,23,42,0.025)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            transition: "opacity 360ms ease, backdrop-filter 440ms ease",
          },
        }}>
        <SidebarContent mobile onClose={onMobileClose} instagramAccounts={instagramAccounts} />
      </Drawer>
    </>
  );
}


export function DashboardInstagramIsland({ instagramAccounts }: { instagramAccounts: InstagramAccount[] }) {
  const pathname = usePathname();
  const [accounts, setAccounts] = useState(instagramAccounts);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const islandRef = useRef<HTMLDivElement | null>(null);
  const activeAccount = accounts.find((account) => account.isConnected);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (islandRef.current && !islandRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [accountMenuOpen]);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const sections = [
    {
      key: "instagram",
      href: "/dashboard",
      title: "پیج‌های اینستاگرام",
      icon: null,
      active: pathname === "/dashboard",
    },
    {
      key: "comment",
      href: "/dashboard/comment-automation",
      title: "پاسخ خودکار کامنت",
      icon: MessageCircleReply,
      active: pathname === "/dashboard/comment-automation" || pathname.startsWith("/dashboard/comment-automation/"),
    },
    {
      key: "story",
      href: "/dashboard/story-automation",
      title: "پاسخ خودکار استوری",
      icon: Camera,
      active: pathname === "/dashboard/story-automation" || pathname.startsWith("/dashboard/story-automation/"),
    },
  ];

  return (
    <>
      <Box
        aria-hidden={!accountMenuOpen}
        onClick={() => setAccountMenuOpen(false)}
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1199,
          display: { xs: "block", lg: "none" },
          pointerEvents: accountMenuOpen ? "auto" : "none",
          opacity: accountMenuOpen ? 1 : 0,
          visibility: accountMenuOpen ? "visible" : "hidden",
          backgroundColor: "rgba(15,23,42,0.025)",
          backdropFilter: accountMenuOpen ? "blur(2px)" : "blur(0px)",
          WebkitBackdropFilter: accountMenuOpen ? "blur(2px)" : "blur(0px)",
          transition: "opacity 360ms ease, backdrop-filter 440ms ease, visibility 360ms ease",
        }}
      />
      <Box
      dir="rtl"
      component="footer"
      sx={{
        display: { xs: "block", lg: "none" },
        position: "fixed",
        zIndex: 1200,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        left: 12,
        right: 12,
        maxWidth: 520,
        marginLeft: "auto",
        marginRight: "auto",
        boxSizing: "border-box",
      }}
    >
      <Box ref={islandRef} sx={{ position: "relative" }}>
        <Box
          dir="rtl"
          sx={{
            position: "absolute",
            right: 0,
            bottom: "calc(100% + 28px)",
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #E2E8F0",
            borderRadius: 3,
            bgcolor: "rgba(255,255,255,0.97)",
            boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
            backdropFilter: "blur(16px)",
            overflow: "hidden",
            opacity: accountMenuOpen ? 1 : 0,
            transform: accountMenuOpen ? "translateY(0)" : "translateY(8px)",
            transformOrigin: "bottom center",
            visibility: accountMenuOpen ? "visible" : "hidden",
            pointerEvents: accountMenuOpen ? "auto" : "none",
            transition: "opacity 180ms ease, transform 180ms ease, visibility 180ms ease",
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              minHeight: 64,
              display: "flex",
              flexDirection: "row",
              alignItems: "stretch",
              direction: "ltr",
              bgcolor: "#F8FAFC",
              borderBottom: "1px solid #E2E8F0",
            }}
          >
            <Box
              component={Link}
              href="/dashboard"
              onClick={() => setAccountMenuOpen(false)}
              sx={{
                width: "66.666667%",
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                direction: "ltr",
                textDecoration: "none",
                color: "#0F172A",
              }}
            >
              <Box
                sx={{
                  width: "50%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                <Avatar
                  src={activeAccount?.profilePictureUrl || undefined}
                  alt={activeAccount?.igUsername || "Instagram"}
                  sx={{ width: 34, height: 34, flexShrink: 0, bgcolor: "#E2E8F0", color: "#64748B" }}
                >
                  {!activeAccount?.profilePictureUrl ? <UserRound size={15} /> : null}
                </Avatar>
              </Box>
              <Box
                sx={{
                  width: "50%",
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  px: 0.75,
                }}
              >
                <Typography
                  dir="ltr"
                  noWrap
                  fontSize={11.5}
                  fontWeight={700}
                  sx={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {activeAccount ? `@${activeAccount.igUsername}` : "پیجی متصل نیست"}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                width: "33.333333%",
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderLeft: "1px solid #E2E8F0",
              }}
            >
              {activeAccount ? <Check size={17} color="#16A34A" strokeWidth={2.4} /> : null}
            </Box>
          </Box>

          <Box
            component={Link}
            href="/api/instagram/connect"
            onClick={() => setAccountMenuOpen(false)}
            sx={{
              minHeight: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              direction: "ltr",
              gap: 0.6,
              px: 1,
              color: "#2563EB",
              textDecoration: "none",
              "&:hover": { bgcolor: "#EFF6FF" },
            }}
          >
            <Plus size={17} strokeWidth={2.3} />
            <Typography fontSize={11.5} fontWeight={700} dir="rtl">
              افزودن پیج جدید
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            width: "100%",
            minHeight: 68,
            border: "1px solid #E2E8F0",
            borderRadius: 3,
            bgcolor: "rgba(255,255,255,0.97)",
            boxShadow: "0 12px 36px rgba(15,23,42,0.12)",
            backdropFilter: "blur(16px)",
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            direction: "rtl",
          }}
        >
          <Box
            component={Link}
            href="/dashboard/story-automation"
            sx={{
              minWidth: 0,
              minHeight: 68,
              border: 0,
              borderRadius: 0,
              bgcolor: pathname === "/dashboard/story-automation" || pathname.startsWith("/dashboard/story-automation/") ? "#EFF6FF" : "transparent",
              color: pathname === "/dashboard/story-automation" || pathname.startsWith("/dashboard/story-automation/") ? "#2563EB" : "#475569",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.45,
              textDecoration: "none",
              px: 0.5,
            }}
          >
            <Camera size={22} strokeWidth={1.9} />
            <Typography noWrap fontSize={{ xs: 11, sm: 12 }} fontWeight={600} color="inherit">
              پاسخ خودکار استوری
            </Typography>
          </Box>

          <Box
            component={Link}
            href="/dashboard/comment-automation"
            sx={{
              minWidth: 0,
              minHeight: 68,
              border: 0,
              borderRight: "1px solid #E2E8F0",
              borderRadius: 0,
              bgcolor: pathname === "/dashboard/comment-automation" || pathname.startsWith("/dashboard/comment-automation/") ? "#EFF6FF" : "transparent",
              color: pathname === "/dashboard/comment-automation" || pathname.startsWith("/dashboard/comment-automation/") ? "#2563EB" : "#475569",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.45,
              textDecoration: "none",
              px: 0.5,
            }}
          >
            <MessageCircleReply size={22} strokeWidth={1.9} />
            <Typography noWrap fontSize={{ xs: 11, sm: 12 }} fontWeight={600} color="inherit">
              پاسخ خودکار کامنت
            </Typography>
          </Box>

          <Box
            component="button"
            type="button"
            onClick={() => setAccountMenuOpen((open) => !open)}
            aria-expanded={accountMenuOpen}
            aria-label="باز کردن پیج‌های اینستاگرام"
            sx={{
              minWidth: 0,
              minHeight: 68,
              border: 0,
              borderRadius: 0,
              bgcolor: accountMenuOpen || pathname === "/dashboard" ? "#F8FAFC" : "transparent",
              color: pathname === "/dashboard" ? "#2563EB" : "#475569",
              display: "grid",
              placeItems: "center",
              position: "relative",
              cursor: "pointer",
              fontFamily: "inherit",
              p: 0,
            }}
          >
            <Avatar
              src={activeAccount?.profilePictureUrl || undefined}
              alt={activeAccount?.igUsername || "Instagram"}
              sx={{ width: 34, height: 34, bgcolor: "#E2E8F0", color: "#64748B" }}
            >
              {!activeAccount?.profilePictureUrl ? <UserRound size={15} /> : null}
            </Avatar>
            <Box
              sx={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                display: "grid",
                placeItems: "center",
                color: "#64748B",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 14l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
    </>
  );
}
