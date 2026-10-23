"use client";

import type { ReactNode } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { dairaPalette, dairaTokens } from "../../lib/design-system/palette";

const cache = createCache({ key: "mui-rtl", stylisPlugins: [prefixer, rtlPlugin] });

const theme = createTheme({
  direction: "rtl",
  palette: {
    mode: "light",
    primary: { main:dairaPalette.primary.main,dark:dairaPalette.primary.hover,light:dairaTokens["--daira-brand-100"],contrastText:dairaTokens["--daira-inverse-text"] },
    secondary: {main:dairaPalette.text.secondary},
    success: {main:dairaPalette.status.success},
    warning: {main:dairaPalette.status.warning},
    error: {main:dairaPalette.status.error},
    info: {main:dairaPalette.status.info},
    background: {default:dairaPalette.background.page,paper:dairaPalette.background.surface},
    text: {primary:dairaPalette.text.heading,secondary:dairaPalette.text.secondary},
    divider:dairaPalette.border,
  },
  typography: {
    fontFamily: "Vazirmatn, Arial, sans-serif",
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiPopover: { styleOverrides: { paper: {
      background:"var(--daira-glass-popover)",backdropFilter:"blur(12px) saturate(110%)",
      border:"1px solid var(--daira-glass-rim)",boxShadow:"var(--daira-shadow-floating)",borderRadius:16
    } } },
    MuiMenu: { styleOverrides: { paper: {
      background:"var(--daira-glass-popover)",backdropFilter:"blur(12px)",
      border:"1px solid var(--daira-glass-rim)",borderRadius:15
    } } },
    MuiChip: { styleOverrides: { root: {borderColor:"var(--daira-border)"} } },
    MuiTooltip: { styleOverrides: {tooltip: {backgroundColor:"var(--daira-tooltip-bg)",color:"var(--daira-tooltip-text)"} } },
    MuiAlert: { styleOverrides: {root: {borderRadius:13}} },
    MuiSkeleton: {styleOverrides: {root: {backgroundColor:"var(--daira-skeleton-base)"}} },
    MuiTabs: {styleOverrides: {indicator: {backgroundColor:"var(--daira-primary)"}} },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: { styleOverrides: { root: { border: "1px solid var(--daira-border)" } } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: "12px 16px",
          whiteSpace: "nowrap",
          "@media (max-width:600px)": {
            padding: "9px 10px",
            fontSize: "0.78rem",
          },
        },
        head: {
          fontWeight: 700,
          backgroundColor: "var(--daira-surface-hover)",
          "@media (max-width:600px)": {
            fontSize: "0.72rem",
          },
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          minWidth: 620,
          "@media (max-width:600px)": {
            minWidth: 560,
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 20,
          "@media (max-width:600px)": {
            padding: 14,
            "&:last-child": { paddingBottom: 14 },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          margin: 12,
          background:"var(--daira-glass-modal)",
          backdropFilter:"blur(18px)",
          border:"1px solid var(--daira-glass-rim)",
          boxShadow:"var(--daira-shadow-floating)",
          width: "calc(100% - 24px)",
          "@media (min-width:600px)": {
            margin: 32,
            width: "100%",
          },
        },
      },
    },
  },
});

export default function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </CacheProvider>
    </AppRouterCacheProvider>
  );
}
