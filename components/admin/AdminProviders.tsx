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
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: { styleOverrides: { root: { border: "1px solid #E2E8F0" } } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, backgroundColor: "#F8FAFC" } } },
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
