import type { SxProps, Theme } from "@mui/material/styles";

/** Shared responsive table treatment for the admin panel.
 * On phones, each record becomes a labeled card; on wider screens the normal
 * table remains horizontally scrollable, with its first column pinned in place.
 */
export const responsiveAdminTableSx: SxProps<Theme> = {
  width: "100%",
  minWidth: { xs: 0, sm: 640 },
  borderCollapse: "separate",
  borderSpacing: { xs: "0 8px", sm: 0 },
  "& thead": { display: { xs: "none", sm: "table-header-group" } },
  "& tbody": { display: { xs: "block", sm: "table-row-group" } },
  "& tbody tr": {
    display: { xs: "grid", sm: "table-row" },
    gridTemplateColumns: { xs: "minmax(0, 1fr) minmax(0, 1fr)", sm: "none" },
    gap: { xs: 1, sm: 0 },
    p: { xs: 1.25, sm: 0 },
    mb: { xs: 1, sm: 0 },
    border: { xs: "1px solid #E2E8F0", sm: 0 },
    borderRadius: { xs: 2, sm: 0 },
    bgcolor: { xs: "#FFFFFF", sm: "transparent" },
    boxShadow: { xs: "0 1px 2px rgba(15,23,42,.03)", sm: "none" },
    "& td": {
      display: { xs: "flex", sm: "table-cell" },
      flexDirection: { xs: "column", sm: "initial" },
      alignItems: { xs: "flex-start", sm: "initial" },
      justifyContent: { xs: "center", sm: "initial" },
      minWidth: 0,
      p: { xs: "5px 4px", sm: "16px" },
      borderBottom: { xs: 0, sm: "1px solid #E2E8F0" },
      overflowWrap: "anywhere",
      verticalAlign: "middle",
    },
    "& td[data-label]::before": {
      content: "attr(data-label)",
      display: { xs: "block", sm: "none" },
      mb: "4px",
      color: "#64748B",
      fontSize: 11,
      fontWeight: 600,
      lineHeight: 1.4,
    },
    "& td:first-of-type": {
      gridColumn: { xs: "1 / -1", sm: "auto" },
      position: { xs: "static", sm: "sticky" },
      right: { xs: "auto", sm: 0 },
      zIndex: { xs: "auto", sm: 1 },
      bgcolor: { xs: "transparent", sm: "#FFFFFF" },
      p: { xs: "5px 4px 9px", sm: "16px" },
    },
    "& td:last-of-type": { gridColumn: { xs: "1 / -1", sm: "auto" } },
  },
  "& thead th:first-of-type": {
    position: { xs: "static", sm: "sticky" },
    right: { xs: "auto", sm: 0 },
    zIndex: { xs: "auto", sm: 2 },
    bgcolor: { xs: "#F8FAFC", sm: "#F8FAFC" },
  },
  "& tbody tr:last-child td": { borderBottom: 0 },
};
