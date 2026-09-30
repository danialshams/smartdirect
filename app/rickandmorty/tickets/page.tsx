"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Card, CardContent, Chip, CircularProgress, FormControl, InputAdornment,
  InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { Search, Ticket } from "lucide-react";

type Row={id:string;subject:string;status:string;priority:string;createdAt:string;updatedAt:string;user:{name:string;email:string};_count:{messages:number}};
const statusLabels:Record<string,string>={OPEN:"باز",IN_PROGRESS:"در حال بررسی",WAITING_USER:"منتظر کاربر",RESOLVED:"حل‌شده",CLOSED:"بسته"};
const priorityLabels:Record<string,string>={LOW:"کم",NORMAL:"عادی",HIGH:"زیاد",URGENT:"فوری"};

export default function TicketsPage(){
 const router=useRouter();const [rows,setRows]=useState<Row[]>([]);const [loading,setLoading]=useState(true);const [q,setQ]=useState("");const [status,setStatus]=useState("");
 const load=async()=>{setLoading(true);try{const r=await fetch(`/api/admin/tickets?q=${encodeURIComponent(q)}&status=${status}`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message);setRows(j.data);}finally{setLoading(false);}};
 useEffect(()=>{load().catch(()=>{});},[q,status]);
 return <Stack spacing={2.5}>
  <Box><Typography variant="h5" fontWeight={700}>تیکت‌ها</Typography><Typography variant="body2" color="text.secondary">مدیریت و پاسخ‌گویی به درخواست‌های کاربران</Typography></Box>
  <Card><CardContent>
   <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"minmax(0,1fr) 210px"},gap:1.5,mb:2}}>
    <TextField size="small" value={q} onChange={e=>setQ(e.target.value)} placeholder="جستجو در عنوان یا کاربر..." InputProps={{startAdornment:<InputAdornment position="start"><Search size={18}/></InputAdornment>}}/>
    <FormControl size="small"><InputLabel>وضعیت</InputLabel><Select value={status} label="وضعیت" onChange={e=>setStatus(e.target.value)}><MenuItem value="">همه وضعیت‌ها</MenuItem>{Object.entries(statusLabels).map(([v,l])=><MenuItem key={v} value={v}>{l}</MenuItem>)}</Select></FormControl>
   </Box>
   <TableContainer sx={{overflowX:"auto"}}><Table sx={{minWidth:700}}><TableHead><TableRow><TableCell>تیکت</TableCell><TableCell>وضعیت</TableCell><TableCell>اولویت</TableCell><TableCell>پیام</TableCell><TableCell>آخرین تغییر</TableCell></TableRow></TableHead><TableBody>
    {loading?<TableRow><TableCell colSpan={5} align="center" sx={{py:6}}><CircularProgress size={28}/></TableCell></TableRow>:rows.length?rows.map(r=><TableRow key={r.id} hover onClick={()=>router.push(`/rickandmorty/tickets/${r.id}`)} sx={{cursor:"pointer"}}>
      <TableCell><Typography variant="body2" fontWeight={600} noWrap>{r.subject}</Typography><Typography variant="caption" color="text.secondary" noWrap>{r.user.name} · {r.user.email}</Typography></TableCell>
      <TableCell><Chip size="small" label={statusLabels[r.status]||r.status} color={r.status==="OPEN"?"primary":r.status==="WAITING_USER"?"warning":r.status==="CLOSED"?"default":"success"} variant="outlined"/></TableCell>
      <TableCell><Chip size="small" label={priorityLabels[r.priority]||r.priority} color={r.priority==="URGENT"||r.priority==="HIGH"?"error":"default"} variant="outlined"/></TableCell>
      <TableCell>{r._count.messages}</TableCell><TableCell>{new Date(r.updatedAt).toLocaleDateString("fa-IR")}</TableCell>
    </TableRow>):<TableRow><TableCell colSpan={5} align="center"><Stack alignItems="center" spacing={1} sx={{py:5}}><Ticket size={30} color="#94A3B8"/><Typography variant="body2" color="text.secondary">تیکتی پیدا نشد</Typography></Stack></TableCell></TableRow>}
   </TableBody></Table></TableContainer>
  </CardContent></Card>
 </Stack>;
}
