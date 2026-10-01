"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronDown,
  Menu as MenuIcon,
  Plus,
  UserRound,
  X,
} from "lucide-react";
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
            position: "relative",
          }}
        >
          <IconButton
            onClick={onMenuOpen}
            aria-label="باز کردن منو"
            sx={{
              display: { xs: "inline-flex", lg: "none" },
              position: { xs: "absolute", lg: "static" },
              right: { xs: 12, sm: 20 },
              color: "#0F172A",
              width: 40,
              height: 40,
            }}
          >
            <MenuIcon size={20} strokeWidth={2} />
          </IconButton>

          <Typography
            sx={{
              display: { xs: "block", lg: "none" },
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: { xs: 14, sm: 15 },
              fontWeight: 800,
              color: "#0F172A",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            SmartDirect
          </Typography>

          <Box sx={{ flex: 1 }} />

          <Box sx={{ display: { xs: "none", lg: "block" } }}>
            <Button
              onClick={(event) => setAccountMenuAnchor(event.currentTarget)}
              endIcon={<ChevronDown size={17} strokeWidth={2} />}
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
                    <UserRound size={18} strokeWidth={1.9} />
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
                  <Plus size={18} strokeWidth={1.9} />
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
          right: 0,
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
            borderRadius: "10px 0 0 10px",
            border: "1px solid #E2E8F0",
            borderRight: 0,
            bgcolor: "#FFFFFF",
            color: "#64748B",
            boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
            "&:hover": {
              bgcolor: "#F8FAFC",
            },
          }}
        >
          <UserRound size={18} strokeWidth={1.9} />
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
            <Plus size={11} strokeWidth={2.2} color="#0F172A" />
          </Box>
        </Button>
      </Box>

      <Drawer
        anchor="right"
        open={accountSheetOpen}
        onClose={() => setAccountSheetOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: 270, sm: 300 },
            height: "auto",
            maxHeight: "none",
            top: "50%",
            transform: "translateY(-50%) !important",
            borderRadius: "14px 0 0 14px",
            border: "1px solid #E2E8F0",
            borderRight: 0,
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
              <X size={18} strokeWidth={1.9} />
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
              <UserRound size={19} strokeWidth={1.9} color="#64748B" />
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
            startIcon={<Plus size={18} strokeWidth={1.9} />}
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
