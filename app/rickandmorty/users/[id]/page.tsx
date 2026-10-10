"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, Divider, Grid, MenuItem, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { Check, Minus, Pause, Play, Plus } from "lucide-react";
import { responsiveAdminTableSx } from "@/components/admin/responsiveTableStyles";

type UserDetail = {
  id: string; name: string; email: string; createdAt: string;
  instagramAccounts: { id: string; igUsername: string; igUserId: string; isConnected: boolean; createdAt: string }[];
  subscriptions: { id: string; planKey: string; status: string; source: string; startedAt: string; expiresAt: string; note?: string | null; autoRenew: boolean; createdAt: string }[];
};

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [days, setDays] = useState(30);
  const [planKey, setPlanKey] = useState("monthly");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; severity: "success" | "error" } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${params.id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "دریافت اطلاعات کاربر ناموفق بود");
      setUser(j);
      const parts = String(j.name || "").trim().split(/\s+/);
      setFirstName(parts.shift() || "");
      setLastName(parts.join(" "));
      if (j.subscriptions?.[0]) setPlanKey(j.subscriptions[0].planKey);
    } catch (e) { setNotice({ text: e instanceof Error ? e.message : "خطا در دریافت اطلاعات", severity: "error" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (params.id) load(); }, [params.id]);

  const saveProfile = async () => {
    const first = firstName.trim(), last = lastName.trim();
    if (!first || !last) { setNotice({ text: "نام و نام خانوادگی را وارد کنید", severity: "error" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/users/${params.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName: first, lastName: last }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "ذخیره اطلاعات ناموفق بود");
      setUser(prev => prev ? { ...prev, name: j.name } : prev);
      setNotice({ text: "تغییرات کاربر ذخیره شد", severity: "success" });
    } catch (e) { setNotice({ text: e instanceof Error ? e.message : "ذخیره اطلاعات ناموفق بود", severity: "error" }); }
    finally { setSaving(false); }
  };

  const action = async (actionName: string, customDays?: number) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/users/${params.id}/subscription`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName, days: customDays ?? days, planKey }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "عملیات اشتراک ناموفق بود");
      await load();
      setNotice({ text: actionName === "suspend" ? "اشتراک کاربر تعلیق شد" : actionName === "activate" ? "اشتراک کاربر فعال شد" : "اشتراک به‌روزرسانی شد", severity: "success" });
    } catch (e) { setNotice({ text: e instanceof Error ? e.message : "عملیات اشتراک ناموفق بود", severity: "error" }); }
    finally { setBusy(false); }
  };

  if (loading) return <Stack spacing={2}><Box sx={{ height: 110, borderRadius: 3, bgcolor: "action.hover" }} /><Box sx={{ height: 260, borderRadius: 3, bgcolor: "action.hover" }} /></Stack>;
  if (!user) return <Alert severity="error">کاربر پیدا نشد</Alert>;

  const current = user.subscriptions[0];
  const active = current?.status === "ACTIVE" && new Date(current.expiresAt) > new Date();
  const suspended = current?.status === "SUSPENDED";
  const statusLabel = active ? "فعال" : suspended ? "معلق" : current ? "منقضی" : "بدون اشتراک";

  return <Stack spacing={{ xs: 1.5, sm: 2.5 }}>
    <Box><Typography variant="h5" fontWeight={700}>جزئیات کاربر</Typography><Typography variant="body2" color="text.secondary">اطلاعات حساب و مدیریت اشتراک</Typography></Box>
    <Card><CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ width: 52, height: 52, bgcolor: "#EFF6FF", color: "#2563EB" }}>{firstName[0] || "U"}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={700}>{firstName} {lastName}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{user.email}</Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75 }}>
              <Chip size="small" label={user.instagramAccounts.length ? `${user.instagramAccounts.length} پیج متصل` : "بدون پیج متصل"} variant="outlined" />
              {user.instagramAccounts.length > 0 && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>@{user.instagramAccounts[0].igUsername}</Typography>}
            </Stack>
          </Box>
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">عضویت: {new Date(user.createdAt).toLocaleDateString("fa-IR")}</Typography>
      </Stack>
      <Divider sx={{ my: 2.5 }} />
      <Typography variant="subtitle1" fontWeight={700} mb={1.5}>اطلاعات کاربر</Typography>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" label="نام" value={firstName} onChange={e => setFirstName(e.target.value)} /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" label="نام خانوادگی" value={lastName} onChange={e => setLastName(e.target.value)} /></Grid>
        <Grid size={{ xs: 12 }}><TextField fullWidth size="small" label="ایمیل" value={user.email} disabled /></Grid>
      </Grid>
    </CardContent></Card>

    <Card><CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>مدیریت اشتراک</Typography>
      {current ? <Box sx={{ mb: 2.5, p: 2, border: "1px solid #E2E8F0", borderRadius: 2.5, bgcolor: "background.default" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
          <Box><Typography fontWeight={600}>{current.planKey}</Typography><Typography variant="caption" color="text.secondary">انقضا: {new Date(current.expiresAt).toLocaleString("fa-IR")}</Typography></Box>
          <Chip label={statusLabel} color={active ? "success" : suspended ? "warning" : "default"} variant="outlined" />
        </Stack>
      </Box> : <Alert severity="info" sx={{ mb: 2.5 }}>این کاربر هنوز اشتراکی ندارد.</Alert>}
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" select label="پلن اشتراک" value={planKey} onChange={e => setPlanKey(e.target.value)}><MenuItem value="monthly">ماهانه</MenuItem><MenuItem value="quarterly">سه‌ماهه</MenuItem><MenuItem value="yearly">سالانه</MenuItem></TextField></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" type="number" label="تعداد روز" value={days} inputProps={{ min: 1 }} onChange={e => setDays(Math.max(1, Number(e.target.value) || 1))} /></Grid>
      </Grid>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
        <Button variant="contained" disabled={busy} startIcon={<Check size={16} />} onClick={() => action(current ? "activate" : "create", days)}>{suspended ? "فعال‌سازی مجدد" : current ? "فعال‌سازی اشتراک" : "ایجاد اشتراک"}</Button>
        <Button variant="outlined" disabled={busy || !current} startIcon={suspended ? <Play size={16} /> : <Pause size={16} />} onClick={() => action(suspended ? "activate" : "suspend")}>{suspended ? "رفع تعلیق" : "تعلیق اشتراک"}</Button>
        <Button variant="outlined" disabled={busy} startIcon={<Plus size={16} />} onClick={() => action(current ? "extend" : "create", 7)}>افزودن ۷ روز</Button>
        <Button variant="outlined" disabled={busy} startIcon={<Plus size={16} />} onClick={() => action(current ? "extend" : "create", 30)}>افزودن ۳۰ روز</Button>
        <Button variant="outlined" disabled={busy || !current} startIcon={<Minus size={16} />} onClick={() => action("adjust", -7)}>کاهش ۷ روز</Button>
      </Stack>
    </CardContent></Card>

    <Card><CardContent sx={{ p: { xs: 1.25, sm: 2.5 } }}>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>تاریخچه اشتراک</Typography>
      <TableContainer sx={{ overflowX: "auto", minWidth: 0 }}>
        <Table sx={responsiveAdminTableSx}><TableHead><TableRow><TableCell>پلن</TableCell><TableCell>وضعیت</TableCell><TableCell>منبع</TableCell><TableCell>شروع</TableCell><TableCell>انقضا</TableCell></TableRow></TableHead>
          <TableBody>{user.subscriptions.map(s => <TableRow key={s.id}>
            <TableCell data-label="پلن">{s.planKey}</TableCell>
            <TableCell data-label="وضعیت"><Chip size="small" label={s.status === "ACTIVE" ? "فعال" : s.status === "SUSPENDED" ? "معلق" : s.status === "CANCELLED" ? "لغو شده" : "منقضی"} color={s.status === "ACTIVE" ? "success" : s.status === "SUSPENDED" ? "warning" : "default"} variant="outlined" /></TableCell>
            <TableCell data-label="منبع">{s.source === "MANUAL" ? "دستی" : s.source === "PURCHASE" ? "خرید" : s.source === "COUPON" ? "کد تخفیف" : "سیستمی"}</TableCell>
            <TableCell data-label="شروع">{new Date(s.startedAt).toLocaleDateString("fa-IR")}</TableCell>
            <TableCell data-label="انقضا">{new Date(s.expiresAt).toLocaleDateString("fa-IR")}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>
    </CardContent></Card>
    <Button fullWidth size="large" variant="contained" disabled={saving || !firstName.trim() || !lastName.trim()} startIcon={<Check size={18} />} onClick={saveProfile}>{saving ? "در حال ذخیره..." : "ذخیره تغییرات"}</Button>
    <Snackbar open={!!notice} autoHideDuration={3500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
      <Alert onClose={() => setNotice(null)} severity={notice?.severity || "success"} variant="filled">{notice?.text}</Alert>
    </Snackbar>
  </Stack>;
}
