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
    primary: { main:dairaPalette.primary.main,dark:dairaPalette.primary.hover,light:dairaTokens["--daira-brand-100"],contrastText:"#FFFFFF" },
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
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: { styleOverrides: { root: { border: "1px solid #E2E8F0" } } },
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
          backgroundColor: "#F8FAFC",
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
