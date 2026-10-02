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
  const [islandOpen, setIslandOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const islandRef = useRef<HTMLDivElement | null>(null);
  const activeAccount = accounts.find((account) => account.isConnected);

  useEffect(() => {
    if (!islandOpen && !accountMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (islandRef.current && !islandRef.current.contains(event.target as Node)) {
        setIslandOpen(false);
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [islandOpen, accountMenuOpen]);

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

  const shortcuts = [
    { key: "dashboard", href: "/dashboard", title: "داشبورد", icon: LayoutDashboard, matches: (path: string) => path === "/dashboard" },
    { key: "insights", href: "/dashboard/insights", title: "تحلیل پیج", icon: BarChart3, matches: (path: string) => path === "/dashboard/insights" },
    { key: "publishing", href: "/dashboard/publishing", title: "انتشار محتوا", icon: ImagePlus, matches: (path: string) => path === "/dashboard/publishing" || path.startsWith("/dashboard/publishing/") },
    { key: "comments", href: "/dashboard/comments", title: "کامنت‌ها", icon: MessageSquareText, matches: (path: string) => path === "/dashboard/comments" || path.startsWith("/dashboard/comments/") },
    { key: "inbox", href: "/dashboard/inbox", title: "پیام‌ها", icon: Inbox, matches: (path: string) => path === "/dashboard/inbox" || path.startsWith("/dashboard/inbox/") },
    { key: "ice-breaker", href: "/dashboard/ice-breaker", title: "شروع گفتگو", icon: MessageCircleQuestion, matches: (path: string) => path === "/dashboard/ice-breaker" || path.startsWith("/dashboard/ice-breaker/") },
    { key: "persistent-menu", href: "/dashboard/persistent-menu", title: "منوی دایرکت", icon: MenuIcon, matches: (path: string) => path === "/dashboard/persistent-menu" || path.startsWith("/dashboard/persistent-menu/") },
    { key: "comment-automation", href: "/dashboard/comment-automation", title: "پاسخ خودکار کامنت", icon: MessageCircleReply, matches: (path: string) => path === "/dashboard/comment-automation" || path.startsWith("/dashboard/comment-automation/") },
    { key: "story-automation", href: "/dashboard/story-automation", title: "پاسخ خودکار استوری", icon: Camera, matches: (path: string) => path === "/dashboard/story-automation" || path.startsWith("/dashboard/story-automation/") },
  ];

  const contextualOrder: Record<string, string[]> = {
    "/dashboard": ["insights", "publishing", "inbox", "comments", "comment-automation", "story-automation"],
    "/dashboard/insights": ["publishing", "comments", "inbox", "comment-automation", "story-automation"],
    "/dashboard/publishing": ["insights", "inbox", "comments", "comment-automation", "story-automation"],
    "/dashboard/comments": ["comment-automation", "publishing", "inbox", "story-automation", "insights"],
    "/dashboard/inbox": ["comment-automation", "story-automation", "persistent-menu", "ice-breaker", "publishing"],
    "/dashboard/ice-breaker": ["persistent-menu", "inbox", "story-automation", "comment-automation", "publishing"],
    "/dashboard/persistent-menu": ["ice-breaker", "inbox", "comment-automation", "story-automation", "publishing"],
    "/dashboard/comment-automation": ["story-automation", "publishing", "inbox", "comments", "persistent-menu"],
    "/dashboard/story-automation": ["comment-automation", "publishing", "inbox", "persistent-menu", "ice-breaker"],
  };

  const currentShortcut = shortcuts.find((item) => item.matches(pathname));
  const currentBase = currentShortcut?.href ?? pathname;
  const preferredOrder =
    contextualOrder[currentBase] ??
    ["dashboard", "insights", "publishing", "inbox", "comments", "comment-automation", "story-automation", "ice-breaker", "persistent-menu"];

  const selectedShortcuts = preferredOrder
    .map((key) => shortcuts.find((item) => item.key === key))
    .filter((item): item is (typeof shortcuts)[number] => Boolean(item) && !item.matches(pathname))
    .slice(0, 3);

  const fallbackShortcuts = shortcuts
    .filter((item) => !item.matches(pathname) && !selectedShortcuts.some((selected) => selected.key === item.key))
    .slice(0, 3 - selectedShortcuts.length);

  const visibleShortcuts = [...selectedShortcuts, ...fallbackShortcuts];

  return (
    <>
      <Box
        aria-hidden={!islandOpen}
        onClick={() => {
          setIslandOpen(false);
          setAccountMenuOpen(false);
        }}
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1199,
          display: { xs: "block", lg: "none" },
          pointerEvents: islandOpen ? "auto" : "none",
          opacity: islandOpen ? 1 : 0,
          visibility: islandOpen ? "visible" : "hidden",
          backgroundColor: "rgba(15,23,42,0.018)",
          backdropFilter: islandOpen ? "blur(1.5px)" : "blur(0px)",
          WebkitBackdropFilter: islandOpen ? "blur(1.5px)" : "blur(0px)",
          transition: "opacity 300ms ease, backdrop-filter 360ms ease, visibility 300ms ease",
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
          pointerEvents: "none",
        }}
      >
        <Box ref={islandRef} sx={{ position: "relative", pointerEvents: "none" }}>
          <Box
            dir="rtl"
            sx={{
              position: "absolute",
              right: 0,
              bottom: "calc(100% + 10px)",
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #E2E8F0",
              borderRadius: 3,
              bgcolor: "rgba(255,255,255,0.985)",
              boxShadow: "0 8px 24px rgba(15,23,42,0.07)",
              backdropFilter: "blur(14px)",
              overflow: "visible",
              opacity: islandOpen ? 1 : 0,
              transform: islandOpen ? "translateY(0) scale(1)" : "translateY(8px) scale(0.985)",
              transformOrigin: "bottom center",
              visibility: islandOpen ? "visible" : "hidden",
              pointerEvents: islandOpen ? "auto" : "none",
              transition: "opacity 220ms ease, transform 300ms cubic-bezier(0.22, 1, 0.36, 1), visibility 300ms ease",
              zIndex: 1,
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                minHeight: 72,
                direction: "rtl",
                bgcolor: "#F8FAFC",
                borderRadius: "inherit",
                overflow: "hidden",
              }}
            >
              <Box
                component="button"
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-expanded={accountMenuOpen}
                aria-label="باز کردن انتخاب پیج"
                sx={{
                  minWidth: 0,
                  minHeight: 72,
                  border: 0,
                  borderLeft: "1px solid #E2E8F0",
                  bgcolor: accountMenuOpen ? "#EFF6FF" : "#F8FAFC",
                  color: accountMenuOpen ? "#2563EB" : "#475569",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.25,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  p: 0.5,
                  transition: "background-color 160ms ease, color 160ms ease",
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
                    display: "grid",
                    placeItems: "center",
                    color: "inherit",
                    transform: accountMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                    lineHeight: 0,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Box>
              </Box>

              {visibleShortcuts.map(({ key, href, title, icon: Icon }) => (
                <Box
                  key={key}
                  component={Link}
                  href={href}
                  onClick={() => {
                    setIslandOpen(false);
                    setAccountMenuOpen(false);
                  }}
                  sx={{
                    minWidth: 0,
                    minHeight: 72,
                    border: 0,
                    borderLeft: key === visibleShortcuts[visibleShortcuts.length - 1]?.key ? 0 : "1px solid #E2E8F0",
                    bgcolor: "transparent",
                    color: "#475569",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.5,
                    textDecoration: "none",
                    px: 0.45,
                    transition: "background-color 160ms ease, color 160ms ease",
                    "&:hover": { bgcolor: "#EFF6FF", color: "#2563EB" },
                  }}
                >
                  <Icon size={21} strokeWidth={1.9} />
                  <Typography
                    noWrap
                    fontSize={{ xs: 10.5, sm: 11 }}
                    fontWeight={600}
                    color="inherit"
                    sx={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {title}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                position: "absolute",
                right: 0,
                bottom: "100%",
                width: "25%",
                minHeight: 112,
                boxSizing: "border-box",
                border: "1px solid #E2E8F0",
                borderBottom: 0,
                borderRadius: "14px 14px 0 0",
                bgcolor: "rgba(255,255,255,0.985)",
                boxShadow: "0 6px 18px rgba(15,23,42,0.055)",
                overflow: "hidden",
                opacity: accountMenuOpen ? 1 : 0,
                transform: accountMenuOpen ? "translateY(0)" : "translateY(6px)",
                visibility: accountMenuOpen ? "visible" : "hidden",
                pointerEvents: accountMenuOpen ? "auto" : "none",
                transition: "opacity 190ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1), visibility 240ms ease",
                zIndex: 2,
              }}
            >
              <Box
                component={Link}
                href="/dashboard"
                onClick={() => {
                  setIslandOpen(false);
                  setAccountMenuOpen(false);
                }}
                sx={{
                  minHeight: 72,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.45,
                  color: "#0F172A",
                  textDecoration: "none",
                  bgcolor: "#F8FAFC",
                  "&:hover": { bgcolor: "#EFF6FF", color: "#2563EB" },
                }}
              >
                <Avatar
                  src={activeAccount?.profilePictureUrl || undefined}
                  alt={activeAccount?.igUsername || "Instagram"}
                  sx={{ width: 34, height: 34, bgcolor: "#E2E8F0", color: "#64748B" }}
                >
                  {!activeAccount?.profilePictureUrl ? <UserRound size={15} /> : null}
                </Avatar>
                <Typography
                  dir="ltr"
                  noWrap
                  fontSize={10.5}
                  fontWeight={700}
                  sx={{ maxWidth: "calc(100% - 10px)", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {activeAccount ? `@${activeAccount.igUsername}` : "پیجی متصل نیست"}
                </Typography>
              </Box>
              <Box
                component={Link}
                href="/api/instagram/connect"
                onClick={() => {
                  setIslandOpen(false);
                  setAccountMenuOpen(false);
                }}
                sx={{
                  minHeight: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.45,
                  borderTop: "1px solid #E2E8F0",
                  color: "#2563EB",
                  textDecoration: "none",
                  bgcolor: "#FFFFFF",
                  "&:hover": { bgcolor: "#EFF6FF" },
                }}
              >
                <Plus size={14} strokeWidth={2.2} />
                <Typography fontSize={10} fontWeight={700}>افزودن پیج</Typography>
              </Box>
            </Box>
          </Box>

          <Box
            component="button"
            type="button"
            onClick={() => {
              setIslandOpen((open) => {
                const nextOpen = !open;
                if (!nextOpen) setAccountMenuOpen(false);
                return nextOpen;
              });
            }}
            aria-expanded={islandOpen}
            aria-label={islandOpen ? "بستن دسترسی سریع" : "باز کردن دسترسی سریع"}
            sx={{
              minWidth: { xs: 148, sm: 164 },
              height: 48,
              mx: "auto",
              px: 1.5,
              border: "1px solid #E2E8F0",
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.985)",
              color: islandOpen ? "#2563EB" : "#475569",
              boxShadow: "0 6px 18px rgba(15,23,42,0.07)",
              backdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.65,
              cursor: "pointer",
              fontFamily: "inherit",
              pointerEvents: "auto",
              transition: "color 180ms ease, background-color 180ms ease, box-shadow 220ms ease, transform 220ms ease",
              "&:hover": {
                bgcolor: "#FFFFFF",
                color: "#2563EB",
                boxShadow: "0 7px 20px rgba(15,23,42,0.08)",
              },
              "&:active": { transform: "scale(0.985)" },
            }}
          >
            <Typography component="span" fontSize={11.5} fontWeight={700} color="inherit">
              دسترسی سریع
            </Typography>
            <Box
              component="span"
              sx={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                bgcolor: islandOpen ? "#EFF6FF" : "#F8FAFC",
                color: islandOpen ? "#2563EB" : "#64748B",
                display: "grid",
                placeItems: "center",
                transition: "background-color 180ms ease, color 180ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                transform: islandOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}
