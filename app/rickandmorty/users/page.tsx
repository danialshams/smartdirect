"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar, Box, Card, CardContent, Chip, CircularProgress, InputAdornment,
  Pagination, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from "@mui/material";
import { Search, Users } from "lucide-react";
import { responsiveAdminTableSx } from "@/components/admin/responsiveTableStyles";

type UserRow = { id:string; name:string; email:string; role:string; pagesCount:number; createdAt:string; subscription?: { planKey:string; effectiveStatus:string; expiresAt:string } | null };

export default function AdminUsersPage() {
  const router = useRouter();
  const [rows,setRows]=useState<UserRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [q,setQ]=useState("");
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);

  const load=async()=>{setLoading(true);try{const r=await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}&pageSize=20`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message);setRows(j.data);setTotal(j.total);}finally{setLoading(false);}};
  useEffect(()=>{load().catch(()=>{});},[q,page]);

  return <Stack spacing={{ xs: 1.5, sm: 2.5 }}>
    <Box><Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: 20, sm: 24 } }}>کاربران</Typography><Typography variant="body2" color="text.secondary">اطلاعات کاربران، پیج‌های متصل و اشتراک</Typography></Box>
    <Card><CardContent sx={{ p: { xs: 1.25, sm: 2.5 }, "&:last-child": { pb: { xs: 1.25, sm: 2.5 } } }}>
      <TextField fullWidth size="small" value={q} placeholder="جستجو بر اساس نام یا ایمیل..." onChange={e=>{setPage(1);setQ(e.target.value)}} sx={{maxWidth:520,mb:2}} InputProps={{startAdornment:<InputAdornment position="start"><Search size={18}/></InputAdornment>}}/>
      <TableContainer sx={{ overflowX: { xs: "visible", sm: "auto" }, mx: { xs: -1.25, sm: 0 }, width: { xs: "calc(100% + 20px)", sm: "100%" }, minWidth: 0 }}>
        <Table sx={responsiveAdminTableSx}>
          <TableHead><TableRow><TableCell>کاربر</TableCell><TableCell>پیج‌های متصل</TableCell><TableCell>اشتراک</TableCell><TableCell>انقضا</TableCell><TableCell>نقش</TableCell></TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} align="center" sx={{py:6}}><CircularProgress size={28}/></TableCell></TableRow> :
            rows.length ? rows.map(r=><TableRow key={r.id} hover onClick={()=>router.push(`/rickandmorty/users/${r.id}`)} sx={{cursor:"pointer"}}>
              <TableCell data-label="کاربر"><Stack direction="row" spacing={1.5} alignItems="center"><Avatar sx={{bgcolor:"#EFF6FF",color:"#2563EB",width:38,height:38}}>{r.name?.[0]||"U"}</Avatar><Box sx={{minWidth:0}}><Typography variant="body2" fontWeight={600} noWrap>{r.name}</Typography><Typography variant="caption" color="text.secondary" noWrap>{r.email}</Typography></Box></Stack></TableCell>
              <TableCell data-label="پیج‌های متصل">{r.pagesCount}</TableCell>
              <TableCell data-label="اشتراک">{r.subscription?<Chip size="small" label={r.subscription.effectiveStatus==="ACTIVE"?"فعال":"منقضی"} color={r.subscription.effectiveStatus==="ACTIVE"?"success":"error"} variant="outlined"/>:<Chip size="small" label="بدون اشتراک"/>}</TableCell>
              <TableCell data-label="انقضا">{r.subscription?new Date(r.subscription.expiresAt).toLocaleDateString("fa-IR"):"—"}</TableCell>
              <TableCell data-label="نقش"><Chip size="small" label={r.role==="ADMIN"?"مدیر":"کاربر"} color={r.role==="ADMIN"?"primary":"default"} variant="outlined"/></TableCell>
            </TableRow>) :
            <TableRow><TableCell colSpan={5} align="center"><Stack alignItems="center" spacing={1} sx={{py:5}}><Users size={30} color="#94A3B8"/><Typography variant="body2" color="text.secondary">کاربری پیدا نشد</Typography></Stack></TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      {!loading && total>20 && <Box sx={{display:"flex",justifyContent:"center",mt:2}}><Pagination page={page} count={Math.ceil(total/20)} onChange={(_,v)=>setPage(v)} color="primary"/></Box>}
    </CardContent></Card>
  </Stack>;
}
