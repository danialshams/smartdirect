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
  Settings2,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import {
  Avatar,
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Portal,
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
      { title: "کامنت‌های بی‌پاسخ", href: "/dashboard/comments", icon: MessageSquareText },
      { title: "صندوق دایرکت", href: "/dashboard/inbox", icon: Inbox },
      { title: "پیام‌های شروع گفتگو", href: "/dashboard/ice-breaker", icon: MessageCircleQuestion },
      { title: "منوی دایرکت", href: "/dashboard/persistent-menu", icon: MenuIcon },
      { title: "پاسخ خودکار کامنت", href: "/dashboard/comment-automation", icon: MessageCircleReply },
      { title: "پاسخ خودکار استوری", href: "/dashboard/story-automation", icon: Camera },
      { title: "مشاهده و ویرایش پاسخ‌های خودکار", href: "/dashboard/auto-replies", icon: Settings2 },
      { title: "تیکت‌ها", href: "/dashboard/tickets", icon: Ticket },
    ],
  },
];

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
    <Box dir="rtl" sx={{ px: { xs: 1.1, sm: 1.4, lg: 1.25 }, py: { xs: 0.45, sm: 0.55, lg: 0.8 } }}>
      {menuGroups.map((group) => (
        <Box key={group.label} sx={{ mb: { xs: 0.9, sm: 1.1, lg: 1.15 } }}>
          <Box
            component="div"
            dir="ltr"
            sx={{
              width: "100%",
              px: 1.1,
              mb: 0.4,
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
          <List disablePadding sx={{ display: "grid", gridTemplateColumns: mobile ? { xs: "repeat(2, minmax(0, 1fr))", lg: "1fr" } : "1fr", gap: { xs: 0.4, lg: 0.35 } }}>
            {group.items.map(({ href, title, icon: Icon }) => {
              const active = href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
              const fullRowOnMobile = href === "/dashboard/auto-replies";
              return (
                <ListItemButton key={href} component={Link} href={href} onClick={onNavigate} selected={active} dir="rtl"
                  sx={{ gridColumn: mobile && fullRowOnMobile ? "1 / -1" : "auto", minHeight: { xs: 46, sm: 50, lg: 34 }, display: "flex", flexDirection: "row", alignItems: "center", columnGap: { xs: 0.15, sm: 0.25, lg: 0.75 }, borderRadius: 2, px: { xs: 1.25, lg: 0.85 }, color: active ? "#2563EB" : "#475569", "&.Mui-selected": { bgcolor: "#EFF6FF", color: "#2563EB" }, "&.Mui-selected:hover": { bgcolor: "#EFF6FF" }, "&:hover": { bgcolor: "#F8FAFC", color: "#1D4ED8" } }}>
                  <ListItemIcon sx={{ minWidth: 0, width: { xs: 24, lg: 17 }, flex: { xs: "0 0 24px", lg: "0 0 17px" }, color: "inherit", display: "flex", justifyContent: "center", alignItems: "center", m: 0 }}>
                    <Icon size={19} strokeWidth={1.9} />
                  </ListItemIcon>
                  <ListItemText primary={title} sx={{ minWidth: 0, flex: "0 1 auto", m: 0, textAlign: "right", direction: "rtl" }} primaryTypographyProps={{ fontSize: { xs: 12.5, sm: 13.5, lg: 11.5 }, fontWeight: active ? 700 : 500, lineHeight: 1.45, noWrap: !fullRowOnMobile, sx: { overflow: "hidden", textOverflow: "ellipsis", ...(fullRowOnMobile ? { whiteSpace: "normal" } : {}) } }} />
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
    <Box dir="rtl" sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "#FFFFFF", position: "relative" }}>
      {mobile ? (
        <Box sx={{ display: "flex", justifyContent: "flex-end", px: 0.8, pt: 0.7, pb: 0, flexShrink: 0 }}>
          <IconButton size="small" onClick={onClose} aria-label="بستن منو" sx={{ color: "#64748B", width: 32, height: 32 }}>
            <X size={18} strokeWidth={2} />
          </IconButton>
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minHeight: 0, overflow: mobile ? "auto" : "hidden" }}>
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
          zIndex: 2100,
          "& .MuiDrawer-paper": {
            width: { xs: "calc(100vw - 24px)", sm: "min(360px, calc(100vw - 24px))" },
            height: "auto",
            top: { xs: 72, sm: 76 },
            bottom: { xs: 78, sm: 82 },
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


export function DashboardInstagramIsland({
  instagramAccounts,
  accountMenuOpen,
  onAccountMenuOpenChange,
}: {
  instagramAccounts: InstagramAccount[];
  accountMenuOpen: boolean;
  onAccountMenuOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [accounts, setAccounts] = useState(instagramAccounts);
  const islandRef = useRef<HTMLDivElement | null>(null);
  const islandPanelRef = useRef<HTMLDivElement | null>(null);
  const islandButtonRef = useRef<HTMLButtonElement | null>(null);
  const activeAccount = accounts.find((account) => account.isConnected);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const insidePanel = islandPanelRef.current?.contains(target) ?? false;
      const insideButton = islandButtonRef.current?.contains(target) ?? false;
      if (!insidePanel && !insideButton) onAccountMenuOpenChange(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [accountMenuOpen, onAccountMenuOpenChange]);

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
      <Portal>
        <Box
        aria-hidden={!accountMenuOpen}
        onClick={() => onAccountMenuOpenChange(false)}
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 2000,
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
        zIndex: 2001,
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
      <Box ref={islandRef} sx={{ position: "relative", width: "100%", pointerEvents: "auto" }}>
        <Box
          ref={islandPanelRef}
          dir="rtl"
          sx={{
            position: "fixed",
            top: { xs: 416, sm: 476 },
            left: 12,
            right: 12,
            width: "auto",
            maxWidth: 520,
            mx: "auto",
            transform: accountMenuOpen ? "translateY(0)" : "translateY(8px)",
            boxSizing: "border-box",
            border: "1px solid #E2E8F0",
            borderRadius: 3,
            bgcolor: "rgba(255,255,255,0.97)",
            boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
            backdropFilter: "blur(16px)",
            overflow: "hidden",
            opacity: accountMenuOpen ? 1 : 0,
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
              onClick={() => onAccountMenuOpenChange(false)}
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
            onClick={() => onAccountMenuOpenChange(false)}
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
          ref={islandButtonRef}
          component="button"
          type="button"
          onClick={() => onAccountMenuOpenChange(!accountMenuOpen)}
          aria-expanded={accountMenuOpen}
          aria-label="باز کردن اکانت‌های اینستاگرام"
          sx={{
            minWidth: { xs: 148, sm: 164 },
            height: 48,
            mx: "auto",
            px: 1.5,
            border: "1px solid #E2E8F0",
            borderRadius: 999,
            bgcolor: "rgba(255,255,255,0.985)",
            color: accountMenuOpen ? "#2563EB" : "#475569",
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
            اکانت‌های اینستاگرام
          </Typography>
          <Box
            component="span"
            sx={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              bgcolor: accountMenuOpen ? "#EFF6FF" : "#F8FAFC",
              color: accountMenuOpen ? "#2563EB" : "#64748B",
              display: "grid",
              placeItems: "center",
              transition: "background-color 180ms ease, color 180ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
              transform: accountMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>
        </Box>
      </Box>
    </Box>
      </Portal>
    </>
  );
}
