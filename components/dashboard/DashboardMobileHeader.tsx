"use client";

import { AppBar, Toolbar, Typography } from "@mui/material";

export default function DashboardMobileHeader() {
  return (
    <AppBar
      position="sticky"
      color="inherit"
      sx={{
        display: { xs: "block", lg: "none" },
        bgcolor: "rgba(255,255,255,0.96)",
        color: "#0F172A",
        borderBottom: "1px solid #E2E8F0",
        backdropFilter: "blur(12px)",
        zIndex: (theme) => theme.zIndex.drawer - 1,
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 52, sm: 56 },
          px: { xs: 1.5, sm: 2.5 },
          justifyContent: "center",
        }}
      >
        <Typography
          sx={{
            fontSize: { xs: 14, sm: 15 },
            fontWeight: 800,
            color: "#0F172A",
            whiteSpace: "nowrap",
          }}
        >
          SmartDirect
        </Typography>
      </Toolbar>
    </AppBar>
  );
}
