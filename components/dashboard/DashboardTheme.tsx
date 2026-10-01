"use client";

import type { ReactNode } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";

const rtlCache = createCache({
  key: "smartdirect-dashboard-rtl",
  stylisPlugins: [prefixer, rtlPlugin],
});

const dashboardTheme = createTheme({
  direction: "rtl",
  palette: {
    mode: "light",
    primary: { main: "#2563EB", dark: "#1D4ED8", light: "#3B82F6", contrastText: "#FFFFFF" },
    secondary: { main: "#64748B" },
    success: { main: "#16A34A" },
    warning: { main: "#D97706" },
    error: { main: "#DC2626" },
    background: { default: "#F8FAFC", paper: "#FFFFFF" },
    text: { primary: "#0F172A", secondary: "#64748B" },
    divider: "#E2E8F0",
  },
  typography: {
    fontFamily: '"Vazirmatn", Arial, sans-serif',
    h1: { fontWeight: 700 }, h2: { fontWeight: 700 }, h3: { fontWeight: 700 },
    h4: { fontWeight: 700 }, h5: { fontWeight: 700 }, h6: { fontWeight: 700 },
    button: { fontFamily: '"Vazirmatn", Arial, sans-serif', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#F8FAFC",
          color: "#0F172A",
          fontFamily: '"Vazirmatn", Arial, sans-serif',
        },
        /* react-day-picker renders weeks as table rows/cells. The previous flex rules
           made the Jalali calendar expand and scatter in the RTL dashboard. */
        ".rdp-root": {
          width: "100%",
          fontFamily: '"Vazirmatn", Arial, sans-serif',
        },
        ".rdp-months": {
          width: "100%",
          display: "flex",
          justifyContent: "center",
        },
        ".rdp-month": {
          width: "100%",
          maxWidth: 340,
        },
        ".rdp-month_grid": {
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        },
        ".rdp-weekdays": {
          display: "table-row",
        },
        ".rdp-weekday": {
          display: "table-cell",
          width: "14.2857%",
          textAlign: "center",
          verticalAlign: "middle",
          padding: "6px 0",
        },
        ".rdp-week": {
          display: "table-row",
        },
        ".rdp-day": {
          display: "table-cell",
          width: "14.2857%",
          height: 38,
          padding: 0,
          textAlign: "center",
          verticalAlign: "middle",
        },
        ".rdp-day_button": {
          margin: "0 auto",
          display: "grid",
          placeItems: "center",
        },
        ".rdp-caption": {
          width: "100%",
        },
        ".rdp-caption_label": {
          fontFamily: '"Vazirmatn", Arial, sans-serif',
        },
        ".rdp-dropdowns": {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          flexWrap: "nowrap",
        },
        ".rdp-dropdown_root": {
          display: "inline-flex",
          alignItems: "center",
          flex: "0 0 auto",
          overflow: "hidden",
        },
        ".rdp-dropdown_root select": {
          maxWidth: "100%",
          boxSizing: "border-box",
        },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: {
      styleOverrides: {
        root: { border: "1px solid #E2E8F0", borderRadius: 12 },
      },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#94A3B8" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#2563EB", borderWidth: 1 },
        },
      },
    },
    MuiAppBar: { defaultProps: { elevation: 0 } },
    MuiDrawer: { styleOverrides: { paper: { backgroundColor: "#FFFFFF" } } },
  },
});

export default function DashboardTheme({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <CacheProvider value={rtlCache}>
        <ThemeProvider theme={dashboardTheme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </CacheProvider>
    </AppRouterCacheProvider>
  );
}
