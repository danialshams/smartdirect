"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, Divider, FormControl,
  CircularProgress, Grid, MenuItem, Select, Snackbar, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import { Check, Clock3, Minus, Pause, Plus, RefreshCw, Save, ShieldCheck, Ticket, UserRound, Users } from "lucide-react";
import { responsiveAdminTableSx } from "@/components/admin/responsiveTableStyles";

type UserDetail = {
  id: string; name: string; createdAt: string;
  instagramAccounts: { id: string; igUsername: string; igUserId: string; isConnected: boolean; createdAt: string }[];
  subscriptions: { id: string; planKey: string; status: string; source: string; startedAt: string; expiresAt: string; note?: string | null; autoRenew: boolean; createdAt: string }[];
  tickets: { id: string; subject: string; status: string; priority: string; updatedAt: string }[];
};
type Notice = { text: string; severity: "success" | "error" | "info" };

const faDate = (value: string, withTime = false) =>
  new Date(value).toLocaleString("fa-IR", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [planKey, setPlanKey] = useState("monthly");
  const [savedPlanKey, setSavedPlanKey] = useState("monthly");
  const [daysDelta, setDaysDelta] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const current = user?.subscriptions?.[0];
  const dirty = planKey !== savedPlanKey || daysDelta !== 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${params.id}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "دریافت اطلاعات کاربر ناموفق بود");
      setUser(json);
      const nextPlan = json.subscriptions?.[0]?.planKey ?? "monthly";
      setPlanKey(nextPlan);
      setSavedPlanKey(nextPlan);
      setDaysDelta(0);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "خطا در دریافت اطلاعات", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { if (params.id) void load(); }, [params.id, load]);

  const save = async () => {
    if (!dirty) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/users/${params.id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", days: daysDelta, planKey }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "ذخیره تغییرات ناموفق بود");
      setNotice({ text: "تغییرات با موفقیت ذخیره شد", severity: "success" });
      await load();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "ذخیره تغییرات ناموفق بود", severity: "error" });
    } finally {
      setBusy(false);
    }
  };

  const suspend = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/users/${params.id}/subscription`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend" }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "تعلیق اشتراک ناموفق بود");
      setNotice({ text: "اشتراک کاربر تعلیق شد", severity: "success" });
      await load();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "عملیات ناموفق بود", severity: "error" });
    } finally { setBusy(false); }
  };

  if (loading) return <Box role="status" aria-label="در حال بارگذاری اطلاعات کاربر" sx={{ minHeight: "calc(100dvh - 150px)", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress size={40} thickness={4} /></Box>;
  if (!user) return <Alert severity="error">اطلاعات کاربر پیدا نشد.</Alert>;

  const active = current?.status === "ACTIVE" && new Date(current.expiresAt) > new Date();
  const status = active ? "فعال" : current?.status === "SUSPENDED" ? "تعلیق‌شده" : current ? "منقضی یا غیرفعال" : "بدون اشتراک";
  const statusColor = active ? "success" : current?.status === "SUSPENDED" ? "warning" : "default";

  return (
    <Stack spacing={{ xs: 1.5, sm: 2.5 }} dir="rtl" sx={{ pb: { xs: 11, sm: 3 }, minWidth: 0 }}>
      <Box>
        <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: 21, sm: 25 } }}>جزئیات کاربر</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>اطلاعات اتصال، اشتراک و پشتیبانی کاربر را از این صفحه مدیریت کنید.</Typography>
      </Box>

      <Grid container spacing={{ xs: 1.5, md: 2 }}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: "100%", border: "1px solid #E2E8F0", borderRadius: 3, boxShadow: "0 2px 10px rgba(15,23,42,.025)" }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.25 }}>
                <Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#EFF6FF", color: "#2563EB" }}><UserRound size={19} /></Box>
                <Box><Typography fontWeight={800}>اطلاعات کاربر</Typography><Typography variant="caption" color="text.secondary">مشخصات و اتصال‌های اینستاگرام</Typography><Typography variant="caption" color="text.secondary">عضویت از {faDate(user.createdAt)}</Typography></Box>
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 1.5, bgcolor: "#F8FAFC", borderRadius: 2.5, minWidth: 0 }}>
                <Avatar sx={{ width: 52, height: 52, bgcolor: "#DBEAFE", color: "#1D4ED8", fontWeight: 800 }}>{user.name?.trim()?.[0] ?? "ک"}</Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={800} sx={{ overflowWrap: "anywhere" }}>{user.name || "نام ثبت نشده"}</Typography>
                  
                </Box>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary">تعداد پیج‌های متصل</Typography>
                <Chip icon={<Users size={15} />} label={user.instagramAccounts.length.toLocaleString("fa-IR")} color="primary" variant="outlined" />
              </Stack>
              {user.instagramAccounts.length ? (
                <Stack spacing={1}>
                  {user.instagramAccounts.map((account) => (
                    <Box key={account.id} sx={{ p: 1.5, border: "1px solid #E2E8F0", borderRadius: 2.5, minWidth: 0 }}>
                      <Typography fontWeight={700} sx={{ overflowWrap: "anywhere", minWidth: 0, textAlign: "right" }}>@{account.igUsername || "بدون نام کاربری"}</Typography>
                    </Box>
                  ))}
                </Stack>
              ) : <Box sx={{ py: 3, px: 1, textAlign: "center", border: "1px dashed #CBD5E1", borderRadius: 2.5 }}><Typography variant="body2" color="text.secondary">هنوز پیجی به حساب متصل نشده است.</Typography></Box>}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: "100%", border: "1px solid #E2E8F0", borderRadius: 3, boxShadow: "0 2px 10px rgba(15,23,42,.025)" }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 2.25 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#F0FDF4", color: "#15803D" }}><ShieldCheck size={19} /></Box>
                  <Box><Typography fontWeight={800}>وضعیت اشتراک</Typography><Typography variant="caption" color="text.secondary">وضعیت فعلی و زمان انقضا</Typography></Box>
                </Stack>
                <Chip size="small" label={status} color={statusColor as "success" | "warning" | "default"} variant="outlined" />
              </Stack>
              {current ? (
                <Box sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2.5, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">پلن فعلی</Typography><Typography fontWeight={700} sx={{ mt: 0.5 }}>{current.planKey === "yearly" ? "سالانه" : current.planKey === "monthly" ? "ماهانه" : current.planKey}</Typography></Grid>
                    <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">تاریخ انقضا</Typography><Typography fontWeight={700} sx={{ mt: 0.5, overflowWrap: "anywhere" }}>{faDate(current.expiresAt, true)}</Typography></Grid>
                  </Grid>
                </Box>
              ) : <Alert severity="info" sx={{ mb: 1 }}>برای این کاربر هنوز اشتراکی ثبت نشده است. با ذخیره پلن و مدت، اشتراک ایجاد می‌شود.</Alert>}
              <Divider sx={{ my: 2 }} />
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 0.75 }}>نوع اشتراک</Typography>
                  <FormControl fullWidth size="small">
                    <Select value={planKey} onChange={(event) => setPlanKey(String(event.target.value))} inputProps={{ "aria-label": "نوع اشتراک" }}>
                      <MenuItem value="monthly">ماهانه</MenuItem>
                      <MenuItem value="yearly">سالانه</MenuItem>
                      {current?.planKey && !["monthly", "yearly"].includes(current.planKey) && (
                        <MenuItem value={current.planKey}>{current.planKey === "free" ? "دوره رایگان (فعلی)" : current.planKey}</MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 0.75 }}>تغییر مدت اشتراک</Typography>
                  <Grid container spacing={1}>
                    {[{ value: 7, label: "افزودن ۷ روز", icon: <Plus size={15} /> }, { value: 30, label: "افزودن ۳۰ روز", icon: <Plus size={15} /> }, { value: 90, label: "افزودن ۹۰ روز", icon: <Plus size={15} /> }, { value: -7, label: "کاهش ۷ روز", icon: <Minus size={15} /> }].map((item) => (
                      <Grid key={item.value} size={{ xs: 6, sm: 3 }}><Button fullWidth size="small" variant={daysDelta === item.value ? "contained" : "outlined"} color={item.value < 0 ? "error" : "primary"} endIcon={item.icon} onClick={() => setDaysDelta((v) => v + item.value)} sx={{ minHeight: 42, whiteSpace: "nowrap", px: 1 }}>{item.label}</Button></Grid>
                    ))}
                  </Grid>
                  <Box sx={{ mt: 1.25, p: 1.25, borderRadius: 2, bgcolor: daysDelta ? (daysDelta > 0 ? "#F0FDF4" : "#FEF2F2") : "#F8FAFC", border: "1px solid", borderColor: daysDelta ? (daysDelta > 0 ? "#BBF7D0" : "#FECACA") : "#E2E8F0" }}>
                    <Typography variant="body2" fontWeight={700}>
                      {daysDelta === 0 ? "تغییری در مدت اشتراک انتخاب نشده" : daysDelta > 0 ? `افزایش مدت به میزان ${daysDelta.toLocaleString("fa-IR")} روز` : `کاهش مدت به میزان ${Math.abs(daysDelta).toLocaleString("fa-IR")} روز`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">این تغییر تا زمان فشردن دکمه ذخیره اعمال نمی‌شود.</Typography>
                  </Box>
                </Box>
                {current?.status !== "SUSPENDED" && current && <Button fullWidth variant="outlined" color="warning" endIcon={<Pause size={16} />} disabled={busy} onClick={suspend} sx={{ minHeight: 42 }}>تعلیق اشتراک</Button>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ border: "1px solid #E2E8F0", borderRadius: 3, boxShadow: "0 2px 10px rgba(15,23,42,.025)" }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#F5F3FF", color: "#7C3AED" }}><Clock3 size={19} /></Box>
            <Box><Typography fontWeight={800}>تاریخچه اشتراک</Typography><Typography variant="caption" color="text.secondary">سوابق تغییرات اشتراک کاربر</Typography></Box>
          </Stack>
          {user.subscriptions.length ? <TableContainer sx={{ overflowX: { xs: "visible", sm: "auto" }, minWidth: 0 }}><Table sx={responsiveAdminTableSx}><TableHead><TableRow><TableCell>پلن</TableCell><TableCell>وضعیت</TableCell><TableCell>منبع</TableCell><TableCell>شروع</TableCell><TableCell>انقضا</TableCell><TableCell>یادداشت</TableCell></TableRow></TableHead><TableBody>
            {user.subscriptions.map((sub) => <TableRow key={sub.id}><TableCell data-label="پلن">{sub.planKey === "yearly" ? "سالانه" : sub.planKey === "monthly" ? "ماهانه" : sub.planKey}</TableCell><TableCell data-label="وضعیت"><Chip size="small" label={sub.status === "ACTIVE" ? "فعال" : sub.status === "SUSPENDED" ? "تعلیق‌شده" : sub.status === "CANCELLED" ? "لغوشده" : "منقضی"} color={sub.status === "ACTIVE" ? "success" : sub.status === "SUSPENDED" ? "warning" : "default"} variant="outlined" /></TableCell><TableCell data-label="منبع">{sub.source}</TableCell><TableCell data-label="شروع">{faDate(sub.startedAt)}</TableCell><TableCell data-label="انقضا">{faDate(sub.expiresAt)}</TableCell><TableCell data-label="یادداشت">{sub.note || "—"}</TableCell></TableRow>)}
          </TableBody></Table></TableContainer> : <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>تاریخچه‌ای برای اشتراک ثبت نشده است.</Typography>}
        </CardContent>
      </Card>

      <Card sx={{ border: "1px solid #E2E8F0", borderRadius: 3, boxShadow: "0 2px 10px rgba(15,23,42,.025)" }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#FFF7ED", color: "#C2410C" }}><Ticket size={19} /></Box>
            <Box><Typography fontWeight={800}>تیکت‌های اخیر</Typography><Typography variant="caption" color="text.secondary">آخرین درخواست‌های پشتیبانی این کاربر</Typography></Box>
          </Stack>
          {user.tickets.length ? <TableContainer sx={{ overflowX: { xs: "visible", sm: "auto" }, minWidth: 0 }}><Table sx={responsiveAdminTableSx}><TableHead><TableRow><TableCell>عنوان</TableCell><TableCell>وضعیت</TableCell><TableCell>اولویت</TableCell><TableCell>آخرین به‌روزرسانی</TableCell></TableRow></TableHead><TableBody>
            {user.tickets.map((ticket) => <TableRow key={ticket.id}><TableCell data-label="عنوان">{ticket.subject}</TableCell><TableCell data-label="وضعیت"><Chip size="small" label={ticket.status} variant="outlined" /></TableCell><TableCell data-label="اولویت">{ticket.priority}</TableCell><TableCell data-label="آخرین به‌روزرسانی">{faDate(ticket.updatedAt)}</TableCell></TableRow>)}
          </TableBody></Table></TableContainer> : <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>تیکتی برای این کاربر ثبت نشده است.</Typography>}
        </CardContent>
      </Card>

      <Box sx={{ position: { xs: "fixed", sm: "sticky" }, bottom: { xs: 0, sm: 12 }, zIndex: 10, mx: { xs: -1.25, sm: 0 }, px: { xs: 1.25, sm: 0 }, py: { xs: 1.25, sm: 0 }, bgcolor: { xs: "rgba(248,250,252,.96)", sm: "transparent" }, backdropFilter: { xs: "blur(12px)", sm: "none" } }}>
        <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between" sx={{ p: 1.25, border: "1px solid #E2E8F0", borderRadius: 3, bgcolor: "#FFFFFF", boxShadow: "0 8px 28px rgba(15,23,42,.08)" }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={800}>{dirty ? "تغییرات ذخیره‌نشده" : "همه تغییرات ذخیره شده"}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{dirty ? "برای اعمال تغییرات، ذخیره را بزنید." : "برای ویرایش پلن یا مدت اشتراک اقدام کنید."}</Typography>
          </Box>
          <Button variant="contained" endIcon={busy ? <RefreshCw size={17} /> : <Save size={17} />} disabled={!dirty || busy} onClick={save} sx={{ minWidth: { xs: 112, sm: 140 }, minHeight: 44, fontWeight: 800 }}>{busy ? "در حال ذخیره" : "ذخیره تغییرات"}</Button>
        </Stack>
      </Box>

      <Snackbar open={!!notice} autoHideDuration={4000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}><Alert onClose={() => setNotice(null)} severity={notice?.severity ?? "success"} variant="filled">{notice?.text}</Alert></Snackbar>
    </Stack>
  );
}
