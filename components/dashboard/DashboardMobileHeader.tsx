"use client";

import { Menu as MenuIcon } from "lucide-react";
import { AppBar, Box, IconButton, Toolbar, Typography } from "@mui/material";

type DashboardMobileHeaderProps = { onMenuOpen: () => void };

export default function DashboardMobileHeader({ onMenuOpen }: DashboardMobileHeaderProps) {
  return (
    <AppBar position="sticky" color="inherit" sx={{ bgcolor: "rgba(255,255,255,0.96)", color: "#0F172A", borderBottom: "1px solid #E2E8F0", backdropFilter: "blur(12px)", zIndex: (theme) => theme.zIndex.drawer - 1 }}>
      <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1.5, sm: 2.5, lg: 3.5 }, position: "relative" }}>
        <IconButton onClick={onMenuOpen} aria-label="باز کردن منو" sx={{ display: { xs: "inline-flex", lg: "none" }, position: { xs: "absolute", lg: "static" }, insetInlineStart: { xs: 12, sm: 20 }, insetInlineEnd: "auto", color: "#0F172A", width: 40, height: 40 }}>
          <MenuIcon size={20} strokeWidth={2} />
        </IconButton>
        <Typography sx={{ display: { xs: "block", lg: "none" }, position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: { xs: 14, sm: 15 }, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap", pointerEvents: "none" }}>
          SmartDirect
        </Typography>
        <Box sx={{ flex: 1 }} />
      </Toolbar>
    </AppBar>
  );
}
