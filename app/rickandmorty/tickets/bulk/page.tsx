"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowRight, Search, Send, Users } from "lucide-react";

type UserRow = {
  id: string;
  name: string | null;
  email?: string;
  pagesCount?: number;
  subscription?: {
    planKey: string;
    effectiveStatus: string | null;
    expiresAt: string;
  } | null;
};

type Filters = {
  q: string;
  planKey: string;
  status: string;
  expiryWithin: string;
  connection: string;
};

type Result = {
  processed: number;
  succeeded: number;
  failed: number;
  results: { userId: string; success: boolean; message?: string }[];
};

const planLabels: Record<string, string> = {
  "": "همه پلن‌ها",
  free: "رایگان",
  monthly: "ماهانه",
  yearly: "سالانه",
};

const statusLabels: Record<string, string> = {
  "": "همه وضعیت‌ها",
  ACTIVE: "فعال",
  EXPIRED: "منقضی",
  SUSPENDED: "تعلیق‌شده",
  CANCELLED: "لغوشده",
  NONE: "بدون اشتراک",
};

const expiryLabels: Record<string, string> = {
  "": "همه زمان‌ها",
  "3": "کمتر از ۳ روز",
  "7": "کمتر از ۷ روز",
};

const connectionLabels: Record<string, string> = {
  "": "همه وضعیت‌ها",
  connected: "دارای پیج متصل",
  disconnected: "بدون پیج متصل",
};

export default function BulkTicketPage() {
  const router = useRouter();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    q: "",
    planKey: "",
    status: "",
    expiryWithin: "",
    connection: "",
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [allFiltered, setAllFiltered] = useState(false);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const selectedCount = allFiltered ? Math.max(0, total - excludedIds.length) : selectedIds.length;
  const pageSelected =
    rows.length > 0 &&
    rows.every((r) => (allFiltered ? !excludedIds.includes(r.id) : selectedIds.includes(r.id)));

  const query = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      q: filters.q.trim(),
    });
    if (filters.planKey) p.set("planKey", filters.planKey);
    if (filters.status) p.set("status", filters.status);
    if (filters.expiryWithin) p.set("expiryWithin", filters.expiryWithin);
    if (filters.connection) p.set("connection", filters.connection);
    return p.toString();
  }, [page, filters]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/admin/users?" + query, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message || "دریافت کاربران ناموفق بود");
        if (alive) {
          setRows(Array.isArray(j.data) ? j.data : []);
          setTotal(typeof j.total === "number" ? j.total : 0);
        }
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "خطا در دریافت کاربران");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [query]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
    setSelectedIds([]);
    setExcludedIds([]);
    setAllFiltered(false);
    setResult(null);
  };

  const togglePage = (checked: boolean) => {
    setResult(null);
    if (allFiltered) {
      setExcludedIds((current) =>
        checked ? current.filter((id) => !rows.some((r) => r.id === id)) : [...new Set([...current, ...rows.map((r) => r.id)])]
      );
    } else {
      setSelectedIds((current) =>
        checked ? [...new Set([...current, ...rows.map((r) => r.id)])] : current.filter((id) => !rows.some((r) => r.id === id))
      );
    }
  };

  const sendBulkTickets = async () => {
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const selection = allFiltered
        ? { mode: "filtered", filters, excludeUserIds: excludedIds }
        : { mode: "ids", userIds: selectedIds };

      const r = await fetch("/api/admin/tickets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection, subject: subject.trim(), message: message.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "ارسال گروهی تیکت ناموفق بود");

      setResult(j as Result);
      setSelectedIds([]);
      setExcludedIds([]);
      setAllFiltered(false);
      setSubject("");
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ارسال گروهی ناموفق بود");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack dir="rtl" spacing={2.5} sx={{ width: "100%", maxWidth: 1100, mx: "auto", pb: 4 }}>
      {/* سربرگ */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column-reverse", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 800, color: "#0F172A" }}>
            ارسال گروهی تیکت
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748B", mt: 0.5 }}>
            برای هر کاربر انتخابی، یک تیکت مجزا و اختصاصی ساخته خواهد شد.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowRight size={18} />}
          onClick={() => router.push("/rickandmorty/tickets")}
          sx={{
            alignSelf: { xs: "flex-start", sm: "center" },
            borderRadius: 2,
            fontWeight: 700,
            borderColor: "#CBD5E1",
            color: "#334155",
            "&:hover": { borderColor: "#94A3B8", bgcolor: "#F8FAFC" },
          }}
        >
          بازگشت به فهرست
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert
          severity={result.failed ? "warning" : "success"}
          onClose={() => setResult(null)}
          sx={{ borderRadius: 2 }}
        >
          نتیجه ارسال: {result.succeeded.toLocaleString("fa-IR")} موفق، {result.failed.toLocaleString("fa-IR")} ناموفق از {result.processed.toLocaleString("fa-IR")} کاربر.
        </Alert>
      )}

      {/* مرحله ۱: انتخاب فیلترها و مخاطبان */}
      <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "#E2E8F0", bgcolor: "#FFFFFF" }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={2}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0F172A" }}>
                ۱. انتخاب مخاطبان
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 700 }}>
                مجموع: {total.toLocaleString("fa-IR")} کاربر
              </Typography>
            </Box>

            <TextField
              fullWidth
              size="small"
              value={filters.q}
              onChange={(e) => updateFilter("q", e.target.value)}
              placeholder="جستجو در نام کاربر…"
              inputProps={{ dir: "rtl" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} color="#94A3B8" />
                  </InputAdornment>
                ),
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#FAFBFD" } }}
            />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
                gap: 1.5,
              }}
            >
              <FormControl size="small" fullWidth>
                <InputLabel id="bulk-plan-label" shrink>
                  نوع اشتراک
                </InputLabel>
                <Select
                  labelId="bulk-plan-label"
                  value={filters.planKey}
                  displayEmpty
                  notched
                  label="نوع اشتراک"
                  renderValue={(val) => planLabels[val] || "همه پلن‌ها"}
                  onChange={(e) => updateFilter("planKey", String(e.target.value))}
                >
                  <MenuItem value="">همه پلن‌ها</MenuItem>
                  <MenuItem value="free">رایگان</MenuItem>
                  <MenuItem value="monthly">ماهانه</MenuItem>
                  <MenuItem value="yearly">سالانه</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel id="bulk-status-label" shrink>
                  وضعیت اشتراک
                </InputLabel>
                <Select
                  labelId="bulk-status-label"
                  value={filters.status}
                  displayEmpty
                  notched
                  label="وضعیت اشتراک"
                  renderValue={(val) => statusLabels[val] || "همه وضعیت‌ها"}
                  onChange={(e) => updateFilter("status", String(e.target.value))}
                >
                  <MenuItem value="">همه وضعیت‌ها</MenuItem>
                  {Object.entries(statusLabels)
                    .filter(([k]) => k !== "")
                    .map(([val, lbl]) => (
                      <MenuItem key={val} value={val}>
                        {lbl}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel id="bulk-expiry-label" shrink>
                  زمان تا انقضا
                </InputLabel>
                <Select
                  labelId="bulk-expiry-label"
                  value={filters.expiryWithin}
                  displayEmpty
                  notched
                  label="زمان تا انقضا"
                  renderValue={(val) => expiryLabels[val] || "همه زمان‌ها"}
                  onChange={(e) => updateFilter("expiryWithin", String(e.target.value))}
                >
                  <MenuItem value="">همه زمان‌ها</MenuItem>
                  <MenuItem value="3">کمتر از ۳ روز</MenuItem>
                  <MenuItem value="7">کمتر از ۷ روز</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel id="bulk-connection-label" shrink>
                  اتصال اینستاگرام
                </InputLabel>
                <Select
                  labelId="bulk-connection-label"
                  value={filters.connection}
                  displayEmpty
                  notched
                  label="اتصال اینستاگرام"
                  renderValue={(val) => connectionLabels[val] || "همه وضعیت‌ها"}
                  onChange={(e) => updateFilter("connection", String(e.target.value))}
                >
                  <MenuItem value="">همه وضعیت‌ها</MenuItem>
                  <MenuItem value="connected">دارای پیج متصل</MenuItem>
                  <MenuItem value="disconnected">بدون پیج متصل</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* کنترل‌های انتخاب سریع */}
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                pt: 1,
                borderTop: "1px solid #F1F5F9",
              }}
            >
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => togglePage(!pageSelected)}
                  disabled={loading || rows.length === 0}
                  sx={{ borderRadius: 1.5 }}
                >
                  {pageSelected ? "لغو انتخاب این صفحه" : "انتخاب کل این صفحه"}
                </Button>
                <Button
                  size="small"
                  variant={allFiltered ? "contained" : "outlined"}
                  onClick={() => {
                    setAllFiltered((v) => !v);
                    setSelectedIds([]);
                    setExcludedIds([]);
                  }}
                  disabled={loading || total === 0}
                  sx={{ borderRadius: 1.5 }}
                >
                  {allFiltered ? "لغو انتخاب نتایج فیلتر" : `انتخاب تمام ${total.toLocaleString("fa-IR")} نتیجه`}
                </Button>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 800, color: "#2563EB" }}>
                انتخاب‌شده: {selectedCount.toLocaleString("fa-IR")} کاربر
              </Typography>
            </Box>

            {/* لیست کاربران */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                gap: 1,
                mt: 1,
              }}
            >
              {loading ? (
                <Box
                  role="status"
                  aria-label="در حال بارگذاری کاربران"
                  sx={{
                    gridColumn: "1 / -1",
                    minHeight: 140,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CircularProgress size={30} thickness={4} />
                </Box>
              ) : rows.length > 0 ? (
                rows.map((r) => {
                  const isChecked = allFiltered ? !excludedIds.includes(r.id) : selectedIds.includes(r.id);
                  return (
                    <Box
                      key={r.id}
                      onClick={() => {
                        if (allFiltered) {
                          setExcludedIds((cur) =>
                            isChecked ? [...new Set([...cur, r.id])] : cur.filter((id) => id !== r.id)
                          );
                        } else {
                          setSelectedIds((cur) =>
                            isChecked ? cur.filter((id) => id !== r.id) : [...new Set([...cur, r.id])]
                          );
                        }
                      }}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        p: 1.2,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: isChecked ? "#2563EB" : "#E2E8F0",
                        bgcolor: isChecked ? "#EFF6FF" : "#FFFFFF",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        "&:hover": { borderColor: "#93C5FD", bgcolor: isChecked ? "#EFF6FF" : "#FAFBFD" },
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (allFiltered) {
                            setExcludedIds((cur) =>
                              e.target.checked ? cur.filter((id) => id !== r.id) : [...new Set([...cur, r.id])]
                            );
                          } else {
                            setSelectedIds((cur) =>
                              e.target.checked ? [...new Set([...cur, r.id])] : cur.filter((id) => id !== r.id)
                            );
                          }
                        }}
                        sx={{ p: 0 }}
                      />
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isChecked ? 800 : 600,
                          color: isChecked ? "#1E40AF" : "#1E293B",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {r.name || "کاربر بدون نام"}
                      </Typography>
                    </Box>
                  );
                })
              ) : (
                <Box sx={{ gridColumn: "1 / -1", py: 4, textAlign: "center", color: "#64748B" }}>
                  <Users size={30} style={{ margin: "0 auto 8px" }} />
                  <Typography variant="body2">کاربری یافت نشد.</Typography>
                </Box>
              )}
            </Box>

            {!loading && total > 20 && (
              <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5 }}>
                <Pagination
                  page={page}
                  count={Math.ceil(total / 20)}
                  onChange={(_, v) => setPage(v)}
                  color="primary"
                  shape="rounded"
                  size="small"
                />
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* مرحله ۲: ثبت پیام تیکت */}
      <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "#E2E8F0", bgcolor: "#FFFFFF" }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0F172A" }}>
              ۲. محتوای تیکت
            </Typography>

            <TextField
              fullWidth
              required
              label="عنوان تیکت"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              inputProps={{ maxLength: 160, dir: "rtl" }}
              helperText={`${subject.length}/160 کاراکتر`}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />

            <TextField
              fullWidth
              required
              multiline
              minRows={4}
              maxRows={10}
              label="متن پیام پشتیبانی"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              inputProps={{ maxLength: 5000, dir: "rtl" }}
              helperText={`برای هر مخاطب تیکت جداگانه ثبت خواهد شد. (${message.length}/5000)`}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />

            {/* آیکون Send در سمت چپ جمله با endIcon */}
            <Button
              fullWidth
              variant="contained"
              size="large"
              disabled={submitting || selectedCount === 0 || !subject.trim() || !message.trim()}
              onClick={() => void sendBulkTickets()}
              endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Send size={18} />}
              sx={{
                minHeight: 48,
                borderRadius: 2.5,
                fontWeight: 800,
                fontSize: 15,
                bgcolor: "#2563EB",
                boxShadow: "none",
                "&:hover": { bgcolor: "#1D4ED8", boxShadow: "none" },
              }}
            >
              {submitting
                ? "در حال ایجاد تیکت‌ها…"
                : `ارسال تیکت برای ${selectedCount.toLocaleString("fa-IR")} کاربر`}
            </Button>

            <Typography variant="caption" sx={{ color: "#64748B", textAlign: "center" }}>
              حداکثر سقف مجاز برای هر ارسال گروهی، ۵۰۰ کاربر می‌باشد.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
