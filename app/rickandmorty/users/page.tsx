"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  InputAdornment, Pagination, Snackbar, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { Eye, Search, Trash2, Users } from "lucide-react";
import { responsiveAdminTableSx } from "@/components/admin/responsiveTableStyles";

type UserRow = {
  id: string; name: string; email: string; pagesCount: number;
  subscription?: { planKey: string; effectiveStatus: string; expiresAt: string } | null;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; severity: "success" | "error" } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}&pageSize=20`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "دریافت کاربران ناموفق بود");
      setRows(j.data);
      setTotal(j.total);
    } finally { setLoading(false); }
  };
  useEffect(() => { load().catch(() => setNotice({ text: "دریافت فهرست کاربران ناموفق بود", severity: "error" })); }, [q, page]);

  const deleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || "حذف کاربر انجام نشد");
      setDeleteTarget(null);
      setNotice({ text: "کاربر با موفقیت حذف شد", severity: "success" });
      if (rows.length === 1 && page > 1) setPage(p => p - 1);
      else await load();
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : "حذف کاربر ناموفق بود", severity: "error" });
    } finally { setDeleting(false); }
  };

  return <Stack spacing={{ xs: 1.5, sm: 2.5 }}>
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: 20, sm: 24 } }}>کاربران</Typography>
      <Typography variant="body2" color="text.secondary">مدیریت کاربران، پیج‌های متصل و اشتراک‌ها</Typography>
    </Box>
    <Card><CardContent sx={{ p: { xs: 1.25, sm: 2.5 }, "&:last-child": { pb: { xs: 1.25, sm: 2.5 } } }}>
      <TextField fullWidth size="small" value={q} placeholder="جستجو بر اساس نام یا ایمیل..." onChange={e => { setPage(1); setQ(e.target.value); }} sx={{ maxWidth: 520, mb: 2 }} InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }} />
      <TableContainer sx={{ overflowX: { xs: "visible", sm: "auto" }, mx: { xs: -1.25, sm: 0 }, width: { xs: "calc(100% + 20px)", sm: "100%" }, minWidth: 0 }}>
        <Table sx={responsiveAdminTableSx}>
          <TableHead><TableRow>
            <TableCell>کاربر</TableCell><TableCell>پیج متصل</TableCell><TableCell>اشتراک</TableCell><TableCell>انقضا</TableCell><TableCell>عملیات</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}><CircularProgress size={28} /></TableCell></TableRow> :
              rows.length ? rows.map(r => <TableRow key={r.id} hover>
                <TableCell data-label="کاربر"><Stack direction="row" spacing={1.25} alignItems="center"><Avatar sx={{ bgcolor: "#EFF6FF", color: "#2563EB", width: 38, height: 38 }}>{r.name?.[0] || "U"}</Avatar><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={600} sx={{ overflowWrap: "anywhere" }}>{r.name}</Typography><Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{r.email}</Typography></Box></Stack></TableCell>
                <TableCell data-label="پیج متصل">{r.pagesCount}</TableCell>
                <TableCell data-label="اشتراک">{r.subscription ? <Chip size="small" label={r.subscription.effectiveStatus === "ACTIVE" ? "فعال" : "منقضی"} color={r.subscription.effectiveStatus === "ACTIVE" ? "success" : "error"} variant="outlined" /> : <Chip size="small" label="بدون اشتراک" />}</TableCell>
                <TableCell data-label="انقضا">{r.subscription ? new Date(r.subscription.expiresAt).toLocaleDateString("fa-IR") : "—"}</TableCell>
                <TableCell data-label="عملیات"><Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <Button size="small" variant="outlined" startIcon={<Eye size={15} />} onClick={() => router.push(`/rickandmorty/users/${r.id}`)}>مشاهده</Button>
                  <Button size="small" variant="outlined" color="error" startIcon={<Trash2 size={15} />} onClick={() => setDeleteTarget(r)}>حذف</Button>
                </Stack></TableCell>
              </TableRow>) :
              <TableRow><TableCell colSpan={5} align="center"><Stack alignItems="center" spacing={1} sx={{ py: 5 }}><Users size={30} color="#94A3B8" /><Typography variant="body2" color="text.secondary">کاربری پیدا نشد</Typography></Stack></TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      {!loading && total > 20 && <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Pagination page={page} count={Math.ceil(total / 20)} onChange={(_, v) => setPage(v)} color="primary" /></Box>}
    </CardContent></Card>
    <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} fullWidth maxWidth="xs">
      <DialogTitle>حذف کاربر</DialogTitle>
      <DialogContent><DialogContentText>آیا از حذف کاربر «{deleteTarget?.name}» مطمئن هستید؟ اطلاعات مرتبط با حساب کاربر نیز حذف می‌شود و این عملیات قابل بازگشت نیست.</DialogContentText></DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>انصراف</Button>
        <Button color="error" variant="contained" onClick={deleteUser} disabled={deleting}>{deleting ? "در حال حذف..." : "بله، حذف شود"}</Button>
      </DialogActions>
    </Dialog>
    <Snackbar open={!!notice} autoHideDuration={4000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
      <Alert onClose={() => setNotice(null)} severity={notice?.severity || "success"} variant="filled">{notice?.text}</Alert>
    </Snackbar>
  </Stack>;
}
