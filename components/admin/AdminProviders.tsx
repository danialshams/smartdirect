"use client";

import type { ReactNode } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

const cache = createCache({ key: "mui-rtl", stylisPlugins: [prefixer, rtlPlugin] });

const theme = createTheme({
  direction: "rtl",
  palette: {
    primary: { main: "#2563EB", dark: "#1D4ED8", light: "#EFF6FF" },
    secondary: { main: "#64748B" },
    success: { main: "#16A34A" },
    warning: { main: "#D97706" },
    error: { main: "#DC2626" },
    background: { default: "#F8FAFC", paper: "#FFFFFF" },
    text: { primary: "#0F172A", secondary: "#64748B" },
    divider: "#E2E8F0",
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
    MuiCssBaseline: {
      styleOverrides: {
        html: { direction: "rtl", textAlign: "right" },
        body: { direction: "rtl", textAlign: "right", overflowX: "hidden", margin: 0 },
        "#__next": { direction: "rtl", textAlign: "right" },
        ".MuiDialog-root, .MuiPopover-root, .MuiMenu-root": { direction: "rtl" },
        ".MuiInputBase-root, .MuiSelect-select, .MuiMenuItem-root": { direction: "rtl", textAlign: "right" },
        ".MuiInputBase-input, .MuiFormLabel-root, .MuiFormHelperText-root": { textAlign: "right" },
        ".MuiFormHelperText-root": { marginInlineEnd: 14, marginInlineStart: 0 },
        ".MuiAlert-root": { direction: "rtl", textAlign: "right" },
        ".MuiAlert-icon": { marginInlineEnd: 12, marginInlineStart: 0 },
        ".MuiAlert-action": { marginInlineStart: -8, marginInlineEnd: "auto" },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: { styleOverrides: { root: { border: "1px solid #E2E8F0" } } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: "12px 16px",
          textAlign: "right",
          whiteSpace: "nowrap",
          "@media (max-width:600px)": {
            padding: "9px 10px",
            fontSize: "0.78rem",
          },
        },
        head: {
          fontWeight: 700,
          textAlign: "right",
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
