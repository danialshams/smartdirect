import { Box, Typography } from "@mui/material";

import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function ProfilePage() {
  return (
    <DashboardRoute>
      <Box dir="rtl">
        <Box
          component="header"
          sx={{
            mb: 3,
            pb: 2.5,
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <Typography sx={{ color: "#94A3B8", fontSize: 12, fontWeight: 600 }}>
            پروفایل
          </Typography>
          <Typography
            component="h1"
            sx={{
              mt: 0.5,
              color: "#0F172A",
              fontSize: { xs: 24, sm: 28 },
              fontWeight: 700,
              letterSpacing: "-0.025em",
            }}
          >
            پروفایل پیج
          </Typography>
          <Typography sx={{ mt: 1, color: "#64748B", fontSize: 13.5 }}>
            اطلاعات عمومی و آمار پایه پیج متصل.
          </Typography>
        </Box>

        <DashboardAccountsClient mode="profile" />
      </Box>
    </DashboardRoute>
  );
}
