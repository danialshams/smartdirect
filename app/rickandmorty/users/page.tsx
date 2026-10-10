"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, InputAdornment,
  InputLabel, MenuItem, Pagination, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { Download, Eye, Pencil, Search, Users, Zap } from "lucide-react";
import { responsiveAdminTableSx } from "@/components/admin/responsiveTableStyles";

type UserRow = { id: string; name: string; email: string; role: string; pagesCount: number; createdAt: string; subscription?: { planKey: string; effectiveStatus: string | null; expiresAt: string } | null };
type BulkAction = "subscription-adjust" | "subscription-change-plan" | "subscription-suspend" | "subscription-activate" | "ticket-create";
type BulkResult = { processed: number; succeeded: number; failed: number; results: { userId: string; success: boolean; message?: string }[] };
const statusLabels: Record<string, string> = { ACTIVE: "فعال", EXPIRED: "منقضی", SUSPENDED: "تعلیق‌شده", CANCELLED: "لغوشده", NONE: "بدون اشتراک" };
const actions: Record<BulkAction, string> = { "subscription-adjust": "افزودن یا کم‌کردن روز اشتراک", "subscription-change-plan": "تغییر نوع اشتراک", "subscription-suspend": "تعلیق اشتراک", "subscription-activate": "فعال‌سازی اشتراک", "ticket-create": "ایجاد تیکت برای کاربران" };

export default function AdminUsersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [planKey, setPlanKey] = useState("");
  const [status, setStatus] = useState("");
  const [expiryWithin, setExpiryWithin] = useState("");
  const [connection, setConnection] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [allFiltered, setAllFiltered] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<BulkAction>("subscription-adjust");
  const [days, setDays] = useState("7");
  const [newPlan, setNewPlan] = useState("monthly");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const selectedCount = allFiltered ? Math.max(0, total - excludedIds.length) : selectedIds.length;
  const pageSelected = rows.length > 0 && rows.every((row) => allFiltered ? !excludedIds.includes(row.id) : selectedIds.includes(row.id));

  const clearSelection = () => { setSelectedIds([]); setExcludedIds([]); setAllFiltered(false); setResult(null); };
  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, page: String(page), pageSize: "20" });
      if (planKey) params.set("planKey", planKey);
      if (status) params.set("status", status);
      if (expiryWithin) params.set("expiryWithin", expiryWithin);
      if (connection) params.set("connection", connection);
      const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "دریافت کاربران ناموفق بود");
      setRows(json.data); setTotal(json.total);
    } finally { setLoading(false); }
  };
  useEffect(() => { load().catch((e) => setError(e instanceof Error ? e.message : "خطا در دریافت کاربران")); }, [q, page, planKey, status, expiryWithin, connection]);
  const changeFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); clearSelection(); };
  const togglePage = (checked: boolean) => {
    setResult(null);
    if (allFiltered) {
      setExcludedIds((current) => checked ? current.filter((id) => !rows.some((r) => r.id === id)) : [...new Set([...current, ...rows.map((r) => r.id)])]);
      return;
    }
    setSelectedIds((current) => checked ? [...new Set([...current, ...rows.map((r) => r.id)])] : current.filter((id) => !rows.some((r) => r.id === id)));
  };
  const exportCsv = async () => {
    try {
      let exportRows = rows.filter((r) => selectedIds.includes(r.id));
      if (allFiltered || selectedIds.length) {
        const collected: UserRow[] = [];
        for (let p = 1; p <= Math.ceil(total / 50); p++) {
          const params = new URLSearchParams({ q, page: String(p), pageSize: "50" });
          if (planKey) params.set("planKey", planKey);
          if (status) params.set("status", status);
      if (expiryWithin) params.set("expiryWithin", expiryWithin);
      if (connection) params.set("connection", connection);
          const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
          const json = await response.json();
          if (!response.ok) throw new Error(json.message ?? "دریافت خروجی ناموفق بود");
          collected.push(...json.data);
        }
        exportRows = allFiltered ? collected.filter((r) => !excludedIds.includes(r.id)) : collected.filter((r) => selectedIds.includes(r.id));
      }
      if (!exportRows.length) throw new Error("ابتدا کاربران را انتخاب کنید");
      const csvEscape = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
      const csv = ["نام,ایمیل,تعداد پیج,پلن,وضعیت,تاریخ انقضا", ...exportRows.map((r) => [r.name, r.email, r.pagesCount, r.subscription?.planKey ?? "", r.subscription?.effectiveStatus ? statusLabels[r.subscription.effectiveStatus] ?? r.subscription.effectiveStatus : "بدون اشتراک", r.subscription?.expiresAt ? new Date(r.subscription.expiresAt).toLocaleDateString("fa-IR") : ""].map(csvEscape).join(","))].join("\r\n");
      const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a"); a.href = url; a.download = "smartdirect-users.csv"; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "ساخت خروجی ناموفق بود"); }
  };
  const runAction = async () => {
    setSubmitting(true); setError(""); setResult(null);
    try {
      const selection = allFiltered ? { mode: "filtered", filters: { q, planKey, status, expiryWithin, connection }, excludeUserIds: excludedIds } : { mode: "ids", userIds: selectedIds };
      const payload: Record<string, unknown> = { action, selection };
      if (action === "subscription-adjust") payload.days = Number(days);
      if (action === "subscription-change-plan") payload.planKey = newPlan;
      if (action === "ticket-create") { payload.subject = subject; payload.message = message; }
      const response = await fetch("/api/admin/users/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "اجرای عملیات ناموفق بود");
      setResult(json as BulkResult); setSelectedIds([]); setExcludedIds([]); setAllFiltered(false); setDialogOpen(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "اجرای عملیات ناموفق بود"); }
    finally { setSubmitting(false); }
  };

  if (loading && rows.length === 0 && !error) return <Box role="status" aria-label="در حال بارگذاری کاربران" sx={{ minHeight: "calc(100dvh - 100px)", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 1.5 }}><CircularProgress size={40} thickness={4} /><Typography variant="body2" color="text.secondary">در حال دریافت فهرست کاربران…</Typography></Box>;

  return <Stack spacing={{ xs: 1.5, sm: 2.5 }}>
    <Box><Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: 20, sm: 24 } }}>کاربران</Typography><Typography variant="body2" color="text.secondary">مدیریت کاربران، فیلتر اشتراک و عملیات گروهی</Typography></Box>
    {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
    {result && <Alert severity={result.failed ? "warning" : "success"} onClose={() => setResult(null)}>عملیات انجام شد: {result.succeeded} موفق و {result.failed} ناموفق از {result.processed} کاربر. {result.failed > 0 && result.results.filter((r) => !r.success).slice(0, 4).map((r) => r.userId + (r.message ? ": " + r.message : "")).join("؛ ")}</Alert>}
    <Card><CardContent sx={{ p: { xs: 1.25, sm: 2.5 }, "&:last-child": { pb: { xs: 1.25, sm: 2.5 } } }}>
      <Stack spacing={1.5}>
        <TextField fullWidth size="small" value={q} placeholder="جستجو بر اساس نام یا ایمیل..." onChange={(e) => changeFilter(setQ, e.target.value)} sx={{ maxWidth: 520 }} InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <FormControl size="small" fullWidth><InputLabel id="plan-filter">نوع اشتراک</InputLabel><Select labelId="plan-filter" label="نوع اشتراک" value={planKey} onChange={(e) => changeFilter(setPlanKey, String(e.target.value))}><MenuItem value="">همه پلن‌ها</MenuItem><MenuItem value="free">رایگان</MenuItem><MenuItem value="monthly">ماهانه</MenuItem><MenuItem value="yearly">سالانه</MenuItem></Select></FormControl>
          <FormControl size="small" fullWidth><InputLabel id="status-filter">وضعیت اشتراک</InputLabel><Select labelId="status-filter" label="وضعیت اشتراک" value={status} onChange={(e) => changeFilter(setStatus, String(e.target.value))}><MenuItem value="">همه وضعیت‌ها</MenuItem>{Object.entries(statusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <FormControl size="small" fullWidth><InputLabel id="expiry-filter">زمان تا انقضا</InputLabel><Select labelId="expiry-filter" label="زمان تا انقضا" value={expiryWithin} onChange={(e) => changeFilter(setExpiryWithin, String(e.target.value))}><MenuItem value="">همه زمان‌ها</MenuItem><MenuItem value="3">کمتر از ۳ روز</MenuItem><MenuItem value="7">کمتر از ۷ روز</MenuItem></Select></FormControl>
          <FormControl size="small" fullWidth><InputLabel id="connection-filter">اتصال اینستاگرام</InputLabel><Select labelId="connection-filter" label="اتصال اینستاگرام" value={connection} onChange={(e) => changeFilter(setConnection, String(e.target.value))}><MenuItem value="">همه وضعیت‌ها</MenuItem><MenuItem value="connected">پیج متصل دارد</MenuItem><MenuItem value="disconnected">پیج متصل ندارد</MenuItem></Select></FormControl>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button size="small" variant="outlined" onClick={() => togglePage(!pageSelected)} disabled={loading || !rows.length}>{pageSelected ? "لغو انتخاب صفحه" : "انتخاب صفحه فعلی"}</Button>
            <Button size="small" variant={allFiltered ? "contained" : "outlined"} onClick={() => { setAllFiltered((v) => !v); setSelectedIds([]); setExcludedIds([]); setResult(null); }} disabled={loading || total === 0}>{allFiltered ? "لغو انتخاب همه نتایج" : `انتخاب همه نتایج (${total})`}</Button>
            {(selectedIds.length > 0 || allFiltered) && <Button size="small" color="inherit" onClick={clearSelection}>پاک‌کردن انتخاب</Button>}
          </Stack>
          <Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<Download size={17} />} onClick={exportCsv} disabled={!selectedIds.length && !allFiltered}>خروجی CSV</Button><Button variant="contained" startIcon={<Zap size={17} />} onClick={() => { setError(""); setDialogOpen(true); }} disabled={selectedCount === 0}>عملیات گروهی ({selectedCount})</Button></Stack>
        </Stack>
      </Stack>
      <Stack spacing={1.5} sx={{ display: { xs: "flex", sm: "none" }, mt: 2, minWidth: 0 }}>
        {rows.map((r) => {
          const selected = allFiltered ? !excludedIds.includes(r.id) : selectedIds.includes(r.id);
          return (
            <Card key={r.id} variant="outlined" sx={{ borderRadius: 3, borderColor: "#E2E8F0", boxShadow: "0 2px 8px rgba(15,23,42,.035)", overflow: "hidden" }}>
              <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                    <Checkbox size="small" checked={selected} onChange={(e) => {
                      setResult(null);
                      if (allFiltered) setExcludedIds((current) => e.target.checked ? current.filter((id) => id !== r.id) : [...new Set([...current, r.id])]);
                      else setSelectedIds((current) => e.target.checked ? [...new Set([...current, r.id])] : current.filter((id) => id !== r.id));
                    }} inputProps={{ "aria-label": "انتخاب " + r.name }} />
                    <Avatar sx={{ bgcolor: "#EFF6FF", color: "#2563EB", width: 44, height: 44, flexShrink: 0, fontWeight: 800 }}>{r.name?.trim()?.[0] || "U"}</Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography fontWeight={800} sx={{ fontSize: 14.5, lineHeight: 1.7, overflowWrap: "anywhere" }}>{r.name || "بدون نام"}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.6, overflowWrap: "anywhere", wordBreak: "break-word" }}>{r.email}</Typography>
                    </Box>
                  </Stack>
                  <Divider />
                  <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 1.25 }}>
                    <Box sx={{ minWidth: 0, p: 1.25, borderRadius: 2, bgcolor: "#F8FAFC" }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>پیج‌های متصل</Typography>
                      <Typography fontWeight={800} sx={{ fontSize: 16 }}>{r.pagesCount.toLocaleString("fa-IR")}</Typography>
                    </Box>
                    <Box sx={{ minWidth: 0, p: 1.25, borderRadius: 2, bgcolor: "#F8FAFC" }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>تاریخ انقضا</Typography>
                      <Typography fontWeight={700} sx={{ fontSize: 12.5, lineHeight: 1.7, overflowWrap: "anywhere" }}>{r.subscription ? new Date(r.subscription.expiresAt).toLocaleDateString("fa-IR") : "—"}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>وضعیت و پلن اشتراک</Typography>
                    {r.subscription ? <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap={0.75}>
                      <Chip size="small" label={r.subscription.planKey === "monthly" ? "ماهانه" : r.subscription.planKey === "yearly" ? "سالانه" : r.subscription.planKey === "free" ? "رایگان" : r.subscription.planKey} variant="outlined" />
                      <Chip size="small" label={statusLabels[r.subscription.effectiveStatus ?? ""] ?? r.subscription.effectiveStatus ?? "نامشخص"} color={r.subscription.effectiveStatus === "ACTIVE" ? "success" : r.subscription.effectiveStatus === "EXPIRED" ? "error" : r.subscription.effectiveStatus === "SUSPENDED" ? "warning" : "default"} variant="outlined" />
                    </Stack> : <Chip size="small" label="بدون اشتراک" variant="outlined" />}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button fullWidth size="medium" variant="outlined" startIcon={<Eye size={16} />} onClick={() => router.push(`/rickandmorty/users/${r.id}`)} sx={{ minHeight: 42, borderRadius: 2, fontWeight: 700 }}>مشاهده</Button>
                    <Button fullWidth size="medium" variant="contained" startIcon={<Pencil size={16} />} onClick={() => router.push(`/rickandmorty/users/${r.id}#subscription`)} sx={{ minHeight: 42, borderRadius: 2, fontWeight: 700 }}>ویرایش</Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <TableContainer sx={{ display: { xs: "none", sm: "block" }, mt: 2, overflowX: "auto", mx: 0, width: "100%", minWidth: 0 }}>
        <Table sx={responsiveAdminTableSx}>
          <TableHead><TableRow><TableCell><Stack direction="row" spacing={1} alignItems="center"><Checkbox size="small" checked={pageSelected} indeterminate={rows.some((r) => (allFiltered ? !excludedIds.includes(r.id) : selectedIds.includes(r.id))) && !pageSelected} onChange={(e) => togglePage(e.target.checked)} disabled={loading || !rows.length} /><span>کاربر</span></Stack></TableCell><TableCell>پیج‌های متصل</TableCell><TableCell>اشتراک</TableCell><TableCell>انقضا</TableCell><TableCell align="right">عملیات</TableCell></TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}><CircularProgress size={28} /></TableCell></TableRow> :
            rows.length ? rows.map((r) => <TableRow key={r.id} hover onClick={() => router.push(`/rickandmorty/users/${r.id}`)} sx={{ cursor: "pointer" }}>
              <TableCell data-label="کاربر"><Stack direction="row" spacing={1} alignItems="center" onClick={(e) => e.stopPropagation()}><Checkbox size="small" checked={allFiltered ? !excludedIds.includes(r.id) : selectedIds.includes(r.id)} onChange={(e) => { setResult(null); if (allFiltered) { setExcludedIds((current) => e.target.checked ? current.filter((id) => id !== r.id) : [...new Set([...current, r.id])]); } else { setSelectedIds((current) => e.target.checked ? [...new Set([...current, r.id])] : current.filter((id) => id !== r.id)); } }} /><Avatar sx={{ bgcolor: "#EFF6FF", color: "#2563EB", width: 38, height: 38 }}>{r.name?.[0] || "U"}</Avatar><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={600} sx={{ whiteSpace: { xs: "normal", sm: "nowrap" }, overflowWrap: "anywhere" }}>{r.name}</Typography><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: { xs: "normal", sm: "nowrap" }, overflowWrap: "anywhere" }}>{r.email}</Typography></Box></Stack></TableCell>
              <TableCell data-label="پیج‌های متصل">{r.pagesCount}</TableCell>
              <TableCell data-label="اشتراک">{r.subscription ? <><Chip size="small" label={r.subscription.planKey} variant="outlined" /> <Chip size="small" label={r.subscription.effectiveStatus ? statusLabels[r.subscription.effectiveStatus] ?? r.subscription.effectiveStatus : "—"} color={r.subscription.effectiveStatus === "ACTIVE" ? "success" : r.subscription.effectiveStatus === "EXPIRED" ? "error" : "warning"} variant="outlined" /></> : <Chip size="small" label="بدون اشتراک" />}</TableCell>
              <TableCell data-label="انقضا">{r.subscription ? new Date(r.subscription.expiresAt).toLocaleDateString("fa-IR") : "—"}</TableCell>
              <TableCell data-label="عملیات" onClick={(e) => e.stopPropagation()}><Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} justifyContent="flex-end"><Button size="small" variant="outlined" startIcon={<Eye size={15} />} onClick={() => router.push(`/rickandmorty/users/${r.id}`)}>مشاهده</Button><Button size="small" variant="contained" startIcon={<Pencil size={15} />} onClick={() => router.push(`/rickandmorty/users/${r.id}#subscription`)}>ویرایش</Button></Stack></TableCell>
            </TableRow>) : <TableRow><TableCell colSpan={5} align="center"><Stack alignItems="center" spacing={1} sx={{ py: 5 }}><Users size={30} color="#94A3B8" /><Typography variant="body2" color="text.secondary">کاربری پیدا نشد</Typography></Stack></TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      {!loading && total > 20 && <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Pagination page={page} count={Math.ceil(total / 20)} onChange={(_, v) => { setPage(v); clearSelection(); }} color="primary" /></Box>}
    </CardContent></Card>
    <Dialog open={dialogOpen} onClose={() => !submitting && setDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>عملیات گروهی برای {selectedCount} کاربر</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Alert severity="info">هر عملیات برای هر کاربر جداگانه اجرا می‌شود و نتیجه هر مورد ثبت می‌شود.</Alert>
        <FormControl fullWidth size="small"><InputLabel id="bulk-action-label">نوع عملیات</InputLabel><Select labelId="bulk-action-label" label="نوع عملیات" value={action} onChange={(e) => setAction(e.target.value as BulkAction)}>{Object.entries(actions).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}<MenuItem disabled value="sms-not-configured">ارسال پیامک — پس از اتصال سرویس</MenuItem></Select></FormControl>
        {action === "subscription-adjust" && <TextField fullWidth size="small" type="number" label="تعداد روز (منفی برای کم‌کردن)" value={days} onChange={(e) => setDays(e.target.value)} inputProps={{ min: -3650, max: 3650, step: 1 }} helperText="برای کاربر بدون اشتراک فقط عدد مثبت مجاز است." />}
        {action === "subscription-change-plan" && <FormControl fullWidth size="small"><InputLabel id="new-plan-label">پلن جدید</InputLabel><Select labelId="new-plan-label" label="پلن جدید" value={newPlan} onChange={(e) => setNewPlan(String(e.target.value))}><MenuItem value="monthly">ماهانه</MenuItem><MenuItem value="yearly">سالانه</MenuItem></Select></FormControl>}
        {action === "ticket-create" && <><TextField fullWidth size="small" label="عنوان تیکت" value={subject} onChange={(e) => setSubject(e.target.value)} inputProps={{ maxLength: 160 }} /><TextField fullWidth multiline minRows={4} label="متن تیکت" value={message} onChange={(e) => setMessage(e.target.value)} inputProps={{ maxLength: 5000 }} helperText="برای هر کاربر یک تیکت مستقل ایجاد می‌شود." /></>}
        {action === "subscription-suspend" && <Alert severity="warning">اشتراک کاربران انتخاب‌شده تعلیق می‌شود.</Alert>}
        {action === "subscription-activate" && <Alert severity="warning">اشتراک فعال می‌شود؛ اگر کاربر اشتراک نداشته باشد، اشتراک ماهانه ۳۰روزه ایجاد می‌شود.</Alert>}
      </Stack></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setDialogOpen(false)} disabled={submitting} color="inherit">انصراف</Button><Button variant="contained" onClick={runAction} disabled={submitting || (action === "subscription-adjust" && (!Number.isInteger(Number(days)) || Number(days) === 0 || Math.abs(Number(days)) > 3650)) || (action === "ticket-create" && (!subject.trim() || !message.trim()))}>{submitting ? <CircularProgress size={20} /> : "اجرای عملیات"}</Button></DialogActions>
    </Dialog>
  </Stack>;
}
