"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

type DashboardSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  instagramAccounts: {
    id: string;
    igUsername: string;
    isConnected: boolean;
  }[];
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
    ],
  },
  {
    label: "حساب",
    items: [
      { title: "اشتراک", href: "/dashboard/subscription", icon: CreditCard },
    ],
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Box dir="rtl" sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
      <Box
        sx={{
          width: compact ? 38 : 40,
          height: compact ? 38 : 40,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: 2.5,
          bgcolor: "#2563EB",
          color: "#FFFFFF",
          fontSize: compact ? 15 : 16,
          fontWeight: 900,
          letterSpacing: "-0.04em",
        }}
      >
        S
      </Box>
      <Box dir="ltr" sx={{ minWidth: 0, textAlign: "left" }}>
        <Typography fontSize={14.5} fontWeight={800} noWrap color="#0F172A">
          SmartDirect
        </Typography>
        <Typography fontSize={10} noWrap sx={{ mt: 0.2, color: "#64748B" }}>
          Automate · Connect · Grow
        </Typography>
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
            dir="rtl"
            sx={{
              width: "100%",
              px: 1.1,
              mb: 0.65,
              color: "#94A3B8",
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1.5,
              textAlign: "right",
            }}
          >
            {group.label}
          </Box>

          <List disablePadding sx={{ display: "grid", gap: 0.35 }}>
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
                  onClick={onNavigate}
                  selected={active}
                  dir="rtl"
                  sx={{
                    minHeight: 40,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    columnGap: 1,
                    borderRadius: 1.75,
                    px: 1.1,
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
                      color: "inherit",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      m: 0,
                    }}
                  >
                    <Icon size={18} strokeWidth={1.9} />
                  </ListItemIcon>
                  <ListItemText
                    primary={title}
                    sx={{ minWidth: 0, flex: "0 1 auto", m: 0, textAlign: "right", direction: "rtl" }}
                    primaryTypographyProps={{ fontSize: 12.5, fontWeight: active ? 700 : 500 }}
                  />
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
  instagramAccounts: { id: string; igUsername: string; isConnected: boolean }[];
}) {
  const activeAccount = instagramAccounts.find((account) => account.isConnected);

  return (
    <Box dir="rtl" sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "#FFFFFF" }}>
      <Box
        sx={{
          minHeight: 68,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 1.75,
          borderBottom: "1px solid #E2E8F0",
        }}
      >
        <Link href="/dashboard" onClick={onClose} style={{ textDecoration: "none", minWidth: 0, flex: 1 }}>
          <Brand compact={mobile} />
        </Link>
        {mobile && (
          <IconButton size="small" onClick={onClose} aria-label="بستن منو" sx={{ color: "#64748B" }}>
            <X size={18} />
          </IconButton>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Navigation onNavigate={onClose} />
      </Box>

      <Divider sx={{ borderColor: "#E2E8F0" }} />

      <Box sx={{ px: 1.25, py: 1 }}>
        <Typography sx={{ px: 0.65, mb: 0.65, color: "#94A3B8", fontSize: 10, fontWeight: 700 }}>
          اکانت اینستاگرام
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.9,
            minWidth: 0,
            px: 0.9,
            py: 0.85,
            borderRadius: 1.75,
            bgcolor: "#F8FAFC",
            border: "1px solid #E2E8F0",
          }}
        >
          <UserRound size={17} strokeWidth={1.9} color="#64748B" />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography dir="ltr" noWrap fontSize={11.5} fontWeight={600} color="#0F172A">
              {activeAccount ? `@${activeAccount.igUsername}` : "پیجی متصل نیست"}
            </Typography>
            <Typography fontSize={9.5} sx={{ mt: 0.15, color: "#64748B" }}>
              {activeAccount ? "پیج فعال" : "برای شروع پیج متصل کنید"}
            </Typography>
          </Box>
        </Box>

        <Box
          component={Link}
          href="/api/instagram/connect"
          onClick={onClose}
          sx={{
            mt: 0.65,
            minHeight: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.7,
            borderRadius: 1.75,
            color: "#2563EB",
            bgcolor: "#EFF6FF",
            textDecoration: "none",
            fontSize: 11.5,
            fontWeight: 600,
            "&:hover": { bgcolor: "#DBEAFE" },
          }}
        >
          <Plus size={15} strokeWidth={2} />
          اتصال پیج جدید
        </Box>
      </Box>

      <Divider sx={{ borderColor: "#E2E8F0" }} />

      <Box sx={{ p: 1.25 }}>
        <Box
          component="button"
          type="button"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            border: 0,
            borderRadius: 1.75,
            bgcolor: "transparent",
            color: "#DC2626",
            px: 1.1,
            py: 1.1,
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "right",
            "&:hover": { bgcolor: "#FEF2F2", color: "#B91C1C" },
          }}
        >
          <LogOut size={18} strokeWidth={1.9} style={{ flexShrink: 0 }} />
          <Typography component="span" fontSize={12.5} fontWeight={600}>
            خروج از حساب
          </Typography>
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
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          display: { xs: "none", lg: "block" },
          width: 220,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: 220,
            boxSizing: "border-box",
            borderRight: "1px solid #E2E8F0",
            direction: "rtl",
          },
        }}
      >
        <SidebarContent instagramAccounts={instagramAccounts} />
      </Drawer>

      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", lg: "none" },
          "& .MuiDrawer-paper": {
            width: { xs: "min(84vw, 300px)", sm: 320 },
            boxSizing: "border-box",
            borderRight: "1px solid #E2E8F0",
            direction: "rtl",
          },
        }}
      >
        <SidebarContent mobile onClose={onMobileClose} instagramAccounts={instagramAccounts} />
      </Drawer>
    </>
  );
}
