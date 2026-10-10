"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Card, CardContent, Chip, CircularProgress, FormControl, InputAdornment,
  InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { Search, Ticket } from "lucide-react";
import { responsiveAdminTableSx } from "@/components/admin/responsiveTableStyles";

type Row={id:string;subject:string;status:string;priority:string;createdAt:string;updatedAt:string;user:{name:string;email:string};_count:{messages:number}};
const statusLabels:Record<string,string>={OPEN:"باز",IN_PROGRESS:"در حال بررسی",WAITING_USER:"منتظر کاربر",RESOLVED:"حل‌شده",CLOSED:"بسته"};
const priorityLabels:Record<string,string>={LOW:"کم",NORMAL:"عادی",HIGH:"زیاد",URGENT:"فوری"};

export default function TicketsPage(){
 const router=useRouter();const [rows,setRows]=useState<Row[]>([]);const [loading,setLoading]=useState(true);const [q,setQ]=useState("");const [status,setStatus]=useState("");
 const load=async()=>{setLoading(true);try{const r=await fetch(`/api/admin/tickets?q=${encodeURIComponent(q)}&status=${status}`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message);setRows(j.data);}finally{setLoading(false);}};
 useEffect(()=>{load().catch(()=>{});},[q,status]);
 return <Stack spacing={{ xs: 1.5, sm: 2.5 }}>
  <Box><Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: 20, sm: 24 } }}>تیکت‌ها</Typography><Typography variant="body2" color="text.secondary">مدیریت و پاسخ‌گویی به درخواست‌های کاربران</Typography></Box>
  <Card><CardContent sx={{ p: { xs: 1.25, sm: 2.5 }, "&:last-child": { pb: { xs: 1.25, sm: 2.5 } } }}>
   <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"minmax(0,1fr) 210px"},gap:1.5,mb:2}}>
    <TextField size="small" value={q} onChange={e=>setQ(e.target.value)} placeholder="جستجو در عنوان یا کاربر..." InputProps={{startAdornment:<InputAdornment position="start"><Search size={18}/></InputAdornment>}}/>
    <FormControl size="small"><InputLabel>وضعیت</InputLabel><Select value={status} label="وضعیت" onChange={e=>setStatus(e.target.value)}><MenuItem value="">همه وضعیت‌ها</MenuItem>{Object.entries(statusLabels).map(([v,l])=><MenuItem key={v} value={v}>{l}</MenuItem>)}</Select></FormControl>
   </Box>
   <TableContainer sx={{ overflowX: { xs: "visible", sm: "auto" }, mx: { xs: -1.25, sm: 0 }, width: { xs: "calc(100% + 20px)", sm: "100%" }, minWidth: 0 }}><Table sx={responsiveAdminTableSx}><TableHead><TableRow><TableCell>تیکت</TableCell><TableCell>وضعیت</TableCell><TableCell>اولویت</TableCell><TableCell>پیام</TableCell><TableCell>آخرین تغییر</TableCell></TableRow></TableHead><TableBody>
    {loading?<TableRow><TableCell colSpan={5} align="center" sx={{py:6}}><CircularProgress size={28}/></TableCell></TableRow>:rows.length?rows.map(r=><TableRow key={r.id} hover onClick={()=>router.push(`/rickandmorty/tickets/${r.id}`)} sx={{cursor:"pointer"}}>
      <TableCell data-label="تیکت"><Typography variant="body2" fontWeight={600} sx={{ whiteSpace: { xs: "normal", sm: "nowrap" }, overflowWrap: "anywhere" }}>{r.subject}</Typography><Typography variant="caption" color="text.secondary" noWrap>{r.user.name} · {r.user.email}</Typography></TableCell>
      <TableCell data-label="وضعیت"><Chip size="small" label={statusLabels[r.status]||r.status} color={r.status==="OPEN"?"primary":r.status==="WAITING_USER"?"warning":r.status==="CLOSED"?"default":"success"} variant="outlined"/></TableCell>
      <TableCell data-label="اولویت"><Chip size="small" label={priorityLabels[r.priority]||r.priority} color={r.priority==="URGENT"||r.priority==="HIGH"?"error":"default"} variant="outlined"/></TableCell>
      <TableCell data-label="پیام‌ها">{r._count.messages}</TableCell><TableCell data-label="آخرین تغییر">{new Date(r.updatedAt).toLocaleDateString("fa-IR")}</TableCell>
    </TableRow>):<TableRow><TableCell colSpan={5} align="center"><Stack alignItems="center" spacing={1} sx={{py:5}}><Ticket size={30} color="#94A3B8"/><Typography variant="body2" color="text.secondary">تیکتی پیدا نشد</Typography></Stack></TableCell></TableRow>}
   </TableBody></Table></TableContainer>
  </CardContent></Card>
 </Stack>;
}
