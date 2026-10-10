"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BadgePercent,
  Headphones,
  LayoutDashboard,
  Menu as MenuIcon,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from "lucide-react";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";

const items = [
  { href: "/rickandmorty", label: "داشبورد", icon: LayoutDashboard },
  { href: "/rickandmorty/users", label: "کاربران", icon: Users },
  { href: "/rickandmorty/tickets", label: "تیکت‌ها", icon: Ticket },
  { href: "/rickandmorty/coupons", label: "کدهای تخفیف", icon: BadgePercent },
];

function selectedKey(pathname: string) {
  if (pathname.startsWith("/rickandmorty/users")) return "/rickandmorty/users";
  if (pathname.startsWith("/rickandmorty/tickets")) return "/rickandmorty/tickets";
  if (pathname.startsWith("/rickandmorty/coupons")) return "/rickandmorty/coupons";
  return "/rickandmorty";
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = selectedKey(pathname);

  return (
    <List disablePadding sx={{ display: "grid", gap: 0.5 }}>
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = active === href;
        return (
          <ListItemButton
            key={href}
            component={Link}
            href={href}
            onClick={onNavigate}
            selected={isActive}
            sx={{
              minHeight: 44,
              borderRadius: 2,
              px: 1.5,
              color: isActive ? "#2563EB" : "#475569",
              "&.Mui-selected": { bgcolor: "#EFF6FF", color: "#2563EB" },
              "&.Mui-selected:hover": { bgcolor: "#EFF6FF" },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
              <Icon size={19} />
            </ListItemIcon>
            <ListItemText
              primary={label}
              primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 700 : 500 }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
      <Box
        sx={{
          width: compact ? 34 : 40,
          height: compact ? 34 : 40,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: 2.5,
          bgcolor: "#2563EB",
          color: "#fff",
          fontWeight: 800,
          fontSize: compact ? 12 : 14,
        }}
      >
        S
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography fontSize={compact ? 14 : 15} fontWeight={800} noWrap>
          SmartDirect
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "#64748B" }}>
          <ShieldCheck size={12} />
          <Typography fontSize={10.5} noWrap>پنل مدیریت</Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentKey = selectedKey(pathname);
  const currentLabel = items.find((item) => item.href === currentKey)?.label ?? "داشبورد";

  return (
    <Box dir="rtl" sx={{ minHeight: "100vh", bgcolor: "#F8FAFC", direction: "rtl" }}>
      <Drawer
        variant="permanent"
        anchor="right"
        sx={{
          display: { xs: "none", lg: "block" },
          width: 248,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: 248,
            boxSizing: "border-box",
            borderRight: "1px solid #E2E8F0",
            borderLeft: 0,
            bgcolor: "#fff",
          },
        }}
      >
        <Box sx={{ height: 72, display: "flex", alignItems: "center", px: 2.5, borderBottom: "1px solid #E2E8F0" }}>
          <Brand />
        </Box>
        <Box sx={{ px: 1.5, pt: 2 }}><AdminNav /></Box>
        <Box sx={{ position: "absolute", bottom: 16, left: 16, right: 16, p: 1.5, border: "1px solid #E2E8F0", borderRadius: 2.5, bgcolor: "#F8FAFC" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: "#0F172A", color: "#fff", fontSize: 12, fontWeight: 700 }}>A</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontSize={12} fontWeight={700} noWrap>مدیر سیستم</Typography>
              <Typography fontSize={10} color="text.secondary">ADMIN</Typography>
            </Box>
          </Box>
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", lg: "none" },
          "& .MuiDrawer-paper": {
            width: { xs: "min(82vw, 300px)", sm: 320 },
            boxSizing: "border-box",
            borderRight: "1px solid #E2E8F0",
            borderLeft: 0,
          },
        }}
      >
        <Box sx={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, borderBottom: "1px solid #E2E8F0" }}>
          <Brand compact />
          <IconButton size="small" onClick={() => setMobileOpen(false)} aria-label="بستن منو"><X size={19} /></IconButton>
        </Box>
        <Box sx={{ p: 1.5 }}><AdminNav onNavigate={() => setMobileOpen(false)} /></Box>
      </Drawer>

      <Box dir="rtl" sx={{ mr: { lg: "248px" }, minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            bgcolor: "#fff",
            borderBottom: "1px solid #E2E8F0",
            color: "#0F172A",
            zIndex: (theme) => theme.zIndex.drawer - 1,
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1.25, sm: 2.5, lg: 4 }, gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { xs: "inline-flex", lg: "none" }, width: 38, height: 38 }}
              aria-label="باز کردن منو"
            >
              <MenuIcon size={20} />
            </IconButton>
            <Typography sx={{ fontSize: { xs: 13, sm: 14 }, fontWeight: 700, flex: 1, minWidth: 0, textAlign: "right" }}>
              {currentLabel}
            </Typography>

          </Toolbar>
        </AppBar>

        <Box
          component="main"
          dir="rtl"
          sx={{
            minHeight: "calc(100vh - 56px)",
            px: { xs: 1.25, sm: 2.5, lg: 4 },
            py: { xs: 1.5, sm: 2.5, lg: 3 },
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 1440, mx: "auto", animation: "adminFade .25s ease-out" }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
