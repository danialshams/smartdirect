"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  InputAdornment, Pagination, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { Eye, Search, Users } from "lucide-react";
import { responsiveAdminTableSx } from "@/components/admin/responsiveTableStyles";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  pagesCount: number;
  createdAt: string;
  subscription?: { planKey: string; effectiveStatus: string | null; expiresAt: string } | null;
};

const statusLabels: Record<string, string> = {
  ACTIVE: "فعال",
  EXPIRED: "منقضی",
  SUSPENDED: "تعلیق‌شده",
  CANCELLED: "لغوشده",
};
const planLabels: Record<string, string> = {
  free: "رایگان",
  monthly: "ماهانه",
  quarterly: "سه‌ماهه",
  yearly: "سالانه",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fa-IR");
}

function SubscriptionChip({ user }: { user: UserRow }) {
  if (!user.subscription) return <Chip size="small" label="بدون اشتراک" variant="outlined" />;
  const status = user.subscription.effectiveStatus;
  const color = status === "ACTIVE" ? "success" : status === "EXPIRED" ? "error" : status === "SUSPENDED" ? "warning" : "default";
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} useFlexGap flexWrap="wrap">
      <Chip size="small" label={planLabels[user.subscription.planKey] ?? user.subscription.planKey} variant="outlined" />
      <Chip size="small" label={status ? statusLabels[status] ?? status : "نامشخص"} color={color} variant="outlined" />
    </Stack>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/users?q=" + encodeURIComponent(q) + "&page=" + page + "&pageSize=20", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || "دریافت کاربران ناموفق بود");
        if (!cancelled) {
          setRows(Array.isArray(json.data) ? json.data : []);
          setTotal(Number(json.total) || 0);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "دریافت کاربران ناموفق بود");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [q, page]);

  const openUser = (id: string) => router.push("/rickandmorty/users/" + id);

  return (
    <Stack spacing={{ xs: 2, sm: 2.5 }} sx={{ minWidth: 0, width: "100%" }}>
      <Box>
        <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: 21, sm: 25 } }}>کاربران</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>مدیریت کاربران، پیج‌های متصل و وضعیت اشتراک</Typography>
      </Box>

      <Card sx={{ minWidth: 0, overflow: "hidden" }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, "&:last-child": { pb: { xs: 1.5, sm: 2.5 } } }}>
          <TextField
            fullWidth
            size="small"
            value={q}
            placeholder="جستجو بر اساس نام یا ایمیل..."
            onChange={(event) => { setPage(1); setQ(event.target.value); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }}
            sx={{ maxWidth: { sm: 520 }, mb: 2 }}
          />

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {loading ? (
            <Box role="status" aria-label="در حال بارگذاری کاربران" sx={{
              minHeight: { xs: "calc(100dvh - 250px)", sm: 360 },
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "100%", flexDirection: "column", gap: 1.5,
            }}>
              <CircularProgress size={38} thickness={4} />
              <Typography variant="body2" color="text.secondary">در حال دریافت فهرست کاربران…</Typography>
            </Box>
          ) : rows.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" spacing={1.25} sx={{ minHeight: 240, py: 5 }}>
              <Users size={34} color="#94A3B8" />
              <Typography fontWeight={700}>کاربری پیدا نشد</Typography>
              <Typography variant="body2" color="text.secondary">عبارت جستجو را تغییر دهید یا جستجو را پاک کنید.</Typography>
              {q && <Button size="small" onClick={() => { setQ(""); setPage(1); }}>پاک کردن جستجو</Button>}
            </Stack>
          ) : (
            <>
              {/* Mobile: purpose-built cards, not table cells styled as cards. */}
              <Stack spacing={1.5} sx={{ display: { xs: "flex", sm: "none" }, minWidth: 0 }}>
                {rows.map((user) => (
                  <Card key={user.id} variant="outlined" sx={{
                    minWidth: 0, borderRadius: 3, borderColor: "#E2E8F0",
                    boxShadow: "0 2px 8px rgba(15,23,42,.035)", overflow: "hidden",
                  }}>
                    <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
                      <Stack spacing={1.75}>
                        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                          <Avatar sx={{ flexShrink: 0, bgcolor: "#EFF6FF", color: "#2563EB", width: 44, height: 44, fontWeight: 800 }}>
                            {user.name?.trim()?.[0] || "U"}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={800} sx={{ fontSize: 14.5, lineHeight: 1.7, overflowWrap: "anywhere" }}>
                              {user.name || "بدون نام"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{
                              display: "block", lineHeight: 1.6, overflowWrap: "anywhere", wordBreak: "break-word",
                            }}>
                              {user.email}
                            </Typography>
                          </Box>
                        </Stack>

                        <Box sx={{ height: "1px", bgcolor: "#E2E8F0" }} />

                        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 1.25 }}>
                          <Box sx={{ minWidth: 0, p: 1.25, borderRadius: 2, bgcolor: "#F8FAFC" }}>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>پیج‌های متصل</Typography>
                            <Typography fontWeight={800} sx={{ fontSize: 16 }}>{user.pagesCount}</Typography>
                          </Box>
                          <Box sx={{ minWidth: 0, p: 1.25, borderRadius: 2, bgcolor: "#F8FAFC" }}>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>تاریخ انقضا</Typography>
                            <Typography fontWeight={700} sx={{ fontSize: 12.5, lineHeight: 1.7, overflowWrap: "anywhere" }}>
                              {formatDate(user.subscription?.expiresAt)}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>وضعیت اشتراک</Typography>
                          <SubscriptionChip user={user} />
                        </Box>

                        <Button
                          fullWidth variant="contained" size="medium"
                          startIcon={<Eye size={17} />}
                          onClick={() => openUser(user.id)}
                          sx={{ minHeight: 42, borderRadius: 2, fontWeight: 700 }}
                        >
                          مشاهده جزئیات کاربر
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>

              {/* Tablet and desktop: conventional table layout. */}
              <TableContainer sx={{ display: { xs: "none", sm: "block" }, overflowX: "auto", minWidth: 0 }}>
                <Table sx={responsiveAdminTableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell>کاربر</TableCell>
                      <TableCell>پیج‌های متصل</TableCell>
                      <TableCell>اشتراک</TableCell>
                      <TableCell>انقضا</TableCell>
                      <TableCell>نقش</TableCell>
                      <TableCell align="right">عملیات</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((user) => (
                      <TableRow key={user.id} hover onClick={() => openUser(user.id)} sx={{ cursor: "pointer" }}>
                        <TableCell data-label="کاربر">
                          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 190 }}>
                            <Avatar sx={{ bgcolor: "#EFF6FF", color: "#2563EB", width: 38, height: 38, flexShrink: 0 }}>{user.name?.[0] || "U"}</Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{user.name || "بدون نام"}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{user.email}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell data-label="پیج‌های متصل">{user.pagesCount}</TableCell>
                        <TableCell data-label="اشتراک"><SubscriptionChip user={user} /></TableCell>
                        <TableCell data-label="انقضا">{formatDate(user.subscription?.expiresAt)}</TableCell>
                        <TableCell data-label="نقش">
                          <Chip size="small" label={user.role === "ADMIN" ? "مدیر" : "کاربر"} color={user.role === "ADMIN" ? "primary" : "default"} variant="outlined" />
                        </TableCell>
                        <TableCell data-label="عملیات" align="right">
                          <Button size="small" variant="outlined" startIcon={<Eye size={15} />} onClick={(event) => { event.stopPropagation(); openUser(user.id); }}>مشاهده</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {total > 20 && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 2.5, overflowX: "auto" }}>
                  <Pagination page={page} count={Math.ceil(total / 20)} onChange={(_, value) => setPage(value)} color="primary" siblingCount={0} boundaryCount={1} />
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5, textAlign: "center" }}>
                {total.toLocaleString("fa-IR")} کاربر
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
