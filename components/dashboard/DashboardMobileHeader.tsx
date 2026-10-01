"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Add,
  ChevronDown,
  Close,
  Menu as MenuIcon,
  PersonOutline,
} from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";

type InstagramAccount = {
  id: string;
  igUsername: string;
  isConnected: boolean;
};

type DashboardMobileHeaderProps = {
  instagramAccounts: InstagramAccount[];
  onMenuOpen: () => void;
};

export default function DashboardMobileHeader({
  instagramAccounts,
  onMenuOpen,
}: DashboardMobileHeaderProps) {
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [accountMenuAnchor, setAccountMenuAnchor] = useState<HTMLElement | null>(null);
  const activeAccount = instagramAccounts.find((account) => account.isConnected);

  return (
    <>
      <AppBar
        position="sticky"
        color="inherit"
        sx={{
          bgcolor: "rgba(255,255,255,0.96)",
          color: "#0F172A",
          borderBottom: "1px solid #E2E8F0",
          backdropFilter: "blur(12px)",
          zIndex: (theme) => theme.zIndex.drawer - 1,
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, sm: 64 },
            px: { xs: 1.5, sm: 2.5, lg: 3.5 },
          }}
        >
          <IconButton
            onClick={onMenuOpen}
            aria-label="باز کردن منو"
            sx={{
              display: { xs: "inline-flex", lg: "none" },
              color: "#0F172A",
              width: 40,
              height: 40,
            }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flex: 1 }} />

          <Typography
            sx={{
              display: { xs: "block", lg: "none" },
              fontSize: { xs: 14, sm: 15 },
              fontWeight: 800,
              color: "#0F172A",
            }}
          >
            SmartDirect
          </Typography>

          <Box sx={{ flex: 1 }} />

          <Box sx={{ display: { xs: "none", lg: "block" } }}>
            <Button
              onClick={(event) => setAccountMenuAnchor(event.currentTarget)}
              endIcon={<ChevronDown sx={{ fontSize: 17 }} />}
              sx={{
                minWidth: 0,
                height: 38,
                px: 1.25,
                color: "#0F172A",
                fontSize: 12,
                fontWeight: 600,
                "&:hover": { bgcolor: "#F8FAFC" },
              }}
            >
              <Typography
                component="span"
                dir="ltr"
                noWrap
                sx={{
                  maxWidth: 160,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {activeAccount ? `@${activeAccount.igUsername}` : "اتصال پیج"}
              </Typography>
            </Button>

            <Menu
              anchorEl={accountMenuAnchor}
              open={Boolean(accountMenuAnchor)}
              onClose={() => setAccountMenuAnchor(null)}
              dir="rtl"
              PaperProps={{
                sx: {
                  mt: 0.75,
                  minWidth: 190,
                  border: "1px solid #E2E8F0",
                  borderRadius: 2,
                  boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
                },
              }}
            >
              {activeAccount ? (
                <MenuItem disabled sx={{ opacity: "1 !important", minHeight: 42 }}>
                  <ListItemIcon>
                    <PersonOutline fontSize="small" />
                  </ListItemIcon>
                  <Typography component="span" dir="ltr" fontSize={12}>
                    @{activeAccount.igUsername}
                  </Typography>
                </MenuItem>
              ) : null}

              {activeAccount ? <Divider /> : null}

              <MenuItem
                component={Link}
                href="/api/instagram/connect"
                onClick={() => setAccountMenuAnchor(null)}
                sx={{ minHeight: 42, fontSize: 12, fontWeight: 600 }}
              >
                <ListItemIcon>
                  <Add fontSize="small" />
                </ListItemIcon>
                اتصال پیج جدید
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          position: "fixed",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          display: { xs: "block", lg: "none" },
        }}
      >
        <Button
          onClick={() => setAccountSheetOpen(true)}
          aria-label="اتصال پیج جدید"
          sx={{
            minWidth: 34,
            width: 34,
            height: 48,
            p: 0,
            borderRadius: "0 10px 10px 0",
            border: "1px solid #E2E8F0",
            borderLeft: 0,
            bgcolor: "#FFFFFF",
            color: "#64748B",
            boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
            "&:hover": {
              bgcolor: "#F8FAFC",
            },
          }}
        >
          <PersonOutline sx={{ fontSize: 18 }} />
          <Box
            sx={{
              position: "absolute",
              right: 2,
              bottom: 3,
              width: 13,
              height: 13,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              bgcolor: "#FFFFFF",
            }}
          >
            <Add sx={{ fontSize: 11, color: "#0F172A" }} />
          </Box>
        </Button>
      </Box>

      <Drawer
        anchor="left"
        open={accountSheetOpen}
        onClose={() => setAccountSheetOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: 270, sm: 300 },
            height: "auto",
            maxHeight: "none",
            top: "50%",
            transform: "translateY(-50%) !important",
            borderRadius: "0 14px 14px 0",
            border: "1px solid #E2E8F0",
            borderLeft: 0,
            boxSizing: "border-box",
          },
        }}
      >
        <Box dir="rtl" sx={{ p: 2 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1.5,
            }}
          >
            <Box>
              <Typography fontSize={15} fontWeight={700}>
                پیج‌های متصل
              </Typography>
              <Typography sx={{ mt: 0.5, color: "#64748B", fontSize: 11 }}>
                پیج فعال را مدیریت کنید یا پیج جدیدی متصل کنید.
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setAccountSheetOpen(false)}
              aria-label="بستن"
              sx={{ color: "#64748B" }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>

          {activeAccount ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                p: 1.25,
                borderRadius: 2,
                bgcolor: "#F8FAFC",
                border: "1px solid #E2E8F0",
              }}
            >
              <PersonOutline sx={{ color: "#64748B", fontSize: 19 }} />
              <Box sx={{ minWidth: 0, flex: 1, textAlign: "right" }}>
                <Typography dir="ltr" noWrap fontSize={12} fontWeight={600}>
                  @{activeAccount.igUsername}
                </Typography>
                <Typography sx={{ mt: 0.25, color: "#64748B", fontSize: 10 }}>
                  پیج فعال
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography sx={{ px: 1, py: 1, color: "#64748B", fontSize: 12 }}>
              هنوز پیجی متصل نشده است.
            </Typography>
          )}

          <Button
            component={Link}
            href="/api/instagram/connect"
            fullWidth
            variant="outlined"
            startIcon={<Add />}
            sx={{
              mt: 1.25,
              minHeight: 40,
              borderColor: "#E2E8F0",
              color: "#0F172A",
              fontSize: 12,
              fontWeight: 600,
              "&:hover": {
                borderColor: "#94A3B8",
                bgcolor: "#F8FAFC",
              },
            }}
          >
            اتصال پیج جدید
          </Button>
        </Box>
      </Drawer>
    </>
  );
}
