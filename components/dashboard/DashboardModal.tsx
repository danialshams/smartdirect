"use client";

import type { ReactNode } from "react";
import { Dialog, useMediaQuery, useTheme } from "@mui/material";

/** Portal, focus trap, Escape handling, scroll lock and focus restoration for dashboard dialogs. */
export default function DashboardModal({
  children, onClose, labelledBy, busy = false, large = false,
}: {
  children: ReactNode;
  onClose: () => void;
  labelledBy: string;
  busy?: boolean;
  large?: boolean;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <Dialog
      open
      onClose={() => { if (!busy) onClose(); }}
      disableEscapeKeyDown={busy}
      aria-labelledby={labelledBy}
      aria-busy={busy}
      fullWidth
      maxWidth={large ? "md" : "xs"}
      fullScreen={large && mobile}
      slotProps={{ paper: { dir: "rtl", className: "dashboard-theme dashboard-dialog", sx: { m: large && mobile ? 0 : 2, width: large && mobile ? "100%" : "calc(100% - 32px)", maxHeight: large && mobile ? "100dvh" : "calc(100dvh - 32px)", overflow: "hidden", borderRadius: large && mobile ? 0 : 2 } } }}
    >
      {children}
    </Dialog>
  );
}
