"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowLeft, Clock3, MessageSquareText, Search, Send, UserRound, X } from "lucide-react";

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  user: { name: string | null; email: string };
  _count: { messages: number };
};

const statuses = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "OPEN", label: "باز" },
  { value: "IN_PROGRESS", label: "در حال بررسی" },
  { value: "WAITING_USER", label: "منتظر پاسخ کاربر" },
  { value: "RESOLVED", label: "حل‌شده" },
  { value: "CLOSED", label: "بسته‌شده" },
];

const statusMeta: Record<string, { label: string; color: "primary" | "info" | "warning" | "success" | "default" }> = {
  OPEN: { label: "باز", color: "primary" },
  IN_PROGRESS: { label: "در حال بررسی", color: "info" },
  WAITING_USER: { label: "منتظر پاسخ کاربر", color: "warning" },
  RESOLVED: { label: "حل‌شده", color: "success" },
  CLOSED: { label: "بسته‌شده", color: "default" },
};

const priorityMeta: Record<string, { label: string; color: "error" | "warning" | "default" }> = {
  LOW: { label: "کم", color: "default" },
  NORMAL: { label: "عادی", color: "default" },
  HIGH: { label: "زیاد", color: "warning" },
  URGENT: { label: "فوری", color: "error" },
};

const formatShortDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function TicketsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const queryParams = new URLSearchParams();
        if (q.trim()) queryParams.set("q", q.trim());
        if (status) queryParams.set("status", status);

        const r = await fetch(`/api/admin/tickets?${queryParams.toString()}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.message || "دریافت فهرست تیکت‌ها ناموفق بود");
        if (!cancelled) setRows(Array.isArray(j.data) ? j.data : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "خطا در دریافت اطلاعات تیکت‌ها");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, status, refreshKey]);

  return (
    <Stack dir="rtl" spacing={{ xs: 2, sm: 2.5 }} sx={{ width: "100%", maxWidth: 1100, mx: "auto", pb: 4 }}>
      {/* سربرگ و اکشن ارسال گروهی */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800, color: "#0F172A" }}>
            تیکت‌های پشتیبانی
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748B", mt: 0.5 }}>
            پیگیری درخواست‌ها و پاسخ‌گویی به کاربران در یک نگاه
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => router.push("/rickandmorty/tickets/bulk")}
          endIcon={<Send size={16} />}
          sx={{
            borderRadius: 2.5,
            minHeight: 42,
            fontWeight: 700,
            bgcolor: "#2563EB",
            boxShadow: "none",
            "&:hover": { bgcolor: "#1D4ED8", boxShadow: "none" },
          }}
        >
          ارسال گروهی تیکت
        </Button>
      </Box>

      {/* فیلتر و جستجو */}
      <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, borderColor: "#E2E8F0", bgcolor: "#FFFFFF" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" }, gap: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در عنوان یا نام کاربر…"
            inputProps={{ "aria-label": "جستجوی تیکت‌ها", dir: "rtl" }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} color="#94A3B8" />
                </InputAdornment>
              ),
              endAdornment: q ? (
                <InputAdornment position="end">
                  <IconButton onClick={() => setQ("")} size="small" aria-label="پاک کردن جستجو">
                    <X size={16} />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#FAFBFD" } }}
          />

          <FormControl size="small" fullWidth>
            <Select
              value={status}
              displayEmpty
              onChange={(e) => setStatus(e.target.value)}
              renderValue={(selected) => {
                const found = statuses.find((x) => x.value === selected);
                return found ? found.label : "همه وضعیت‌ها";
              }}
              inputProps={{ "aria-label": "فیلتر وضعیت تیکت", dir: "rtl" }}
              sx={{ borderRadius: 2, bgcolor: "#FAFBFD" }}
            >
              {statuses.map((x) => (
                <MenuItem key={x.value} value={x.value}>
                  {x.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1.5, px: 0.5 }}>
          <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 700 }}>
            {loading ? "در حال دریافت آمار…" : `${rows.length.toLocaleString("fa-IR")} تیکت`}
          </Typography>
          {(status || q) && (
            <Button
              size="small"
              onClick={() => {
                setStatus("");
                setQ("");
              }}
              sx={{ minWidth: 0, fontSize: 12, p: 0.5 }}
            >
              حذف فیلترها
            </Button>
          )}
        </Box>
      </Card>

      {error && (
        <Alert
          severity="error"
          sx={{ borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setRefreshKey((v) => v + 1)}>
              تلاش مجدد
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* لیست تیکت‌ها */}
      <Stack spacing={1.25}>
        {loading && rows.length === 0 ? (
          <Box
            role="status"
            aria-label="در حال بارگذاری تیکت‌ها"
            sx={{ minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <CircularProgress size={36} thickness={4} />
          </Box>
        ) : rows.length > 0 ? (
          rows.map((t) => {
            const st = statusMeta[t.status] || { label: t.status, color: "default" as const };
            const pr = priorityMeta[t.priority] || { label: t.priority, color: "default" as const };

            return (
              <Card
                key={t.id}
                variant="outlined"
                onClick={() => router.push(`/rickandmorty/tickets/${t.id}`)}
                sx={{
                  borderRadius: 2.5,
                  borderColor: "#E2E8F0",
                  cursor: "pointer",
                  transition: "all 0.18s ease-in-out",
                  bgcolor: "#FFFFFF",
                  p: { xs: 1.5, sm: 2 },
                  "&:hover": {
                    borderColor: "#93C5FD",
                    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.06)",
                    transform: "translateY(-1px)",
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                  <Typography
                    sx={{
                      fontSize: { xs: 14.5, sm: 16 },
                      fontWeight: 800,
                      color: "#0F172A",
                      lineHeight: 1.6,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {t.subject}
                  </Typography>
                  <ArrowLeft size={18} color="#94A3B8" style={{ flexShrink: 0, marginTop: 4 }} />
                </Box>

                <Typography
                  variant="body2"
                  sx={{
                    fontSize: 12.5,
                    color: "#64748B",
                    mt: 0.5,
                    fontWeight: 600,
                  }}
                >
                  کاربر: {t.user.name || "کاربر ناشناس"}
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    gap: 1,
                    mt: 1.5,
                    pt: 1.25,
                    borderTop: "1px dashed #F1F5F9",
                  }}
                >
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={st.label}
                      color={st.color}
                      variant="filled"
                      sx={{ height: 24, fontSize: 11, fontWeight: 700, borderRadius: 1.5 }}
                    />
                    <Chip
                      size="small"
                      label={`اولویت ${pr.label}`}
                      color={pr.color}
                      variant="outlined"
                      sx={{ height: 24, fontSize: 11, fontWeight: 700, borderRadius: 1.5 }}
                    />
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{ color: "#64748B", fontSize: 11.5, alignSelf: { xs: "flex-end", sm: "center" } }}
                  >
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <MessageSquareText size={14} />
                      <Typography variant="caption">{t._count.messages.toLocaleString("fa-IR")}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Clock3 size={13} />
                      <Typography variant="caption">{formatShortDate(t.updatedAt)}</Typography>
                    </Stack>
                  </Stack>
                </Box>
              </Card>
            );
          })
        ) : (
          <Card
            variant="outlined"
            sx={{
              borderRadius: 3,
              borderStyle: "dashed",
              borderColor: "#CBD5E1",
              p: { xs: 4, sm: 6 },
              textAlign: "center",
              bgcolor: "#FFFFFF",
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                mx: "auto",
                mb: 1.5,
                display: "grid",
                placeItems: "center",
                borderRadius: 2.5,
                bgcolor: "#F1F5F9",
                color: "#64748B",
              }}
            >
              <UserRound size={22} />
            </Box>
            <Typography sx={{ fontWeight: 800, color: "#1E293B", fontSize: 15 }}>تیکتی یافت نشد</Typography>
            <Typography sx={{ color: "#64748B", fontSize: 13, mt: 0.5 }}>
              فیلترهای انتخابی را بررسی کرده یا عبارت دیگری را جستجو کنید.
            </Typography>
            {(q || status) && (
              <Button
                variant="outlined"
                size="small"
                sx={{ mt: 2, borderRadius: 2 }}
                onClick={() => {
                  setQ("");
                  setStatus("");
                }}
              >
                نمایش تمام تیکت‌ها
              </Button>
            )}
          </Card>
        )}
      </Stack>
    </Stack>
  );
}
