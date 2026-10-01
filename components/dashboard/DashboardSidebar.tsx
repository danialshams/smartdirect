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
  MessageCircle,
  MessageCircleReply,
  Settings,
  X,
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

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Box
      dir="rtl"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        minWidth: 0,
      }}
    >
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

      <Box dir="ltr" sx={{ minWidth: 0, textAlign: "left" }}>
        <Typography fontSize={15} fontWeight={800} noWrap color="#0F172A">
          SmartDirect
        </Typography>
        <Typography fontSize={10.5} noWrap sx={{ mt: 0.25, color: "#64748B" }}>
          Automate · Connect · Grow
        </Typography>
      </Box>
    </Box>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <Box dir="rtl" sx={{ px: 1.5, py: 1.5 }}>
      {menuGroups.map((group) => (
        <Box key={group.label} sx={{ mb: 2.5 }}>
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
              textAlign: "right",
              direction: "rtl",
            }}
          >
            {group.label}
          </Typography>

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
                  onClick={onNavigate}
                  selected={active}
                  dir="rtl"
                  sx={{
                    minHeight: 42,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    columnGap: 1,
                    borderRadius: 2,
                    px: 1.25,
                    color: active ? "#2563EB" : "#475569",
                    "&.Mui-selected": {
                      bgcolor: "#EFF6FF",
                      color: "#2563EB",
                    },
                    "&.Mui-selected:hover": {
                      bgcolor: "#EFF6FF",
                    },
                    "&:hover": {
                      bgcolor: "#F8FAFC",
                      color: "#1D4ED8",
                    },
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

                  <ListItemText
                    primary={title}
                    sx={{
                      minWidth: 0,
                      width: "auto",
                      flex: "0 1 auto",
                      m: 0,
                      textAlign: "right",
                      direction: "rtl",
                    }}
                    primaryTypographyProps={{
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                    }}
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
}: {
  mobile?: boolean;
  onClose?: () => void;
}) {
  return (
    <Box
      dir="rtl"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#FFFFFF",
      }}
    >
      <Box
        sx={{
          minHeight: 72,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          borderBottom: "1px solid #E2E8F0",
        }}
      >
        <Link
          href="/dashboard"
          onClick={onClose}
          style={{
            textDecoration: "none",
            minWidth: 0,
            flex: 1,
          }}
        >
          <Brand compact={mobile} />
        </Link>

        {mobile && (
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="بستن منو"
            sx={{ color: "#64748B" }}
          >
            <X size={18} />
          </IconButton>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Navigation onNavigate={onClose} />
      </Box>

      <Divider sx={{ borderColor: "#E2E8F0" }} />

      <Box sx={{ p: 1.5 }}>
        <Box
          component="button"
          type="button"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 1.5,
            border: 0,
            borderRadius: 2,
            bgcolor: "transparent",
            color: "#64748B",
            px: 1.25,
            py: 1.25,
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "right",
            "&:hover": {
              bgcolor: "#FEF2F2",
              color: "#DC2626",
            },
          }}
        >
          <LogOut size={18} strokeWidth={1.9} style={{ flexShrink: 0 }} />
          <Typography component="span" fontSize={13} fontWeight={500}>
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
}: DashboardSidebarProps) {
  return (
    <>
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          display: { xs: "none", lg: "block" },
          width: 248,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: 248,
            boxSizing: "border-box",
            borderRight: "1px solid #E2E8F0",
            direction: "rtl",
          },
        }}
      >
        <SidebarContent />
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
            width: { xs: "min(84vw, 320px)", sm: 340 },
            boxSizing: "border-box",
            borderRight: "1px solid #E2E8F0",
            direction: "rtl",
          },
        }}
      >
        <SidebarContent mobile onClose={onMobileClose} />
      </Drawer>
    </>
  );
}
