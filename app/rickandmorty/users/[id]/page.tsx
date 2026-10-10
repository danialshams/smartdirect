"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, Divider, Grid,
  InputAdornment, MenuItem, Skeleton, Snackbar, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { ArrowRight, Check, Minus, Pause, Plus, RefreshCw } from "lucide-react";
import { responsiveAdminTableSx } from "@/components/admin/responsiveTableStyles";

type UserDetail={id:string;name:string;email:string;role:string;createdAt:string;instagramAccounts:{id:string;igUsername:string;igUserId:string;isConnected:boolean;createdAt:string}[];subscriptions:{id:string;planKey:string;status:string;source:string;startedAt:string;expiresAt:string;note?:string|null;autoRenew:boolean;createdAt:string}[]};

export default function UserDetailPage(){
 const params=useParams<{id:string}>(); const router=useRouter(); const [user,setUser]=useState<UserDetail|null>(null); const [loading,setLoading]=useState(true); const [days,setDays]=useState(30); const [planKey,setPlanKey]=useState("monthly"); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState<{text:string;severity:"success"|"error"}|null>(null);
 const load=async()=>{setLoading(true);try{const r=await fetch(`/api/admin/users/${params.id}`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message);setUser(j);const s=j.subscriptions?.[0];if(s)setPlanKey(s.planKey);}catch(e){setNotice({text:e instanceof Error?e.message:"خطا",severity:"error"});}finally{setLoading(false);}};
 useEffect(()=>{if(params.id)load();},[params.id]);
 const action=async(actionName:string,customDays?:number)=>{setBusy(true);try{const r=await fetch(`/api/admin/users/${params.id}/subscription`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:actionName,days:customDays??days,planKey})});const j=await r.json();if(!r.ok)throw new Error(j.message);setNotice({text:"اشتراک به‌روزرسانی شد",severity:"success"});await load();}catch(e){setNotice({text:e instanceof Error?e.message:"خطا",severity:"error"});}finally{setBusy(false);}};
 if(loading)return <Stack spacing={2}><Skeleton variant="rounded" height={100}/><Skeleton variant="rounded" height={260}/><Skeleton variant="rounded" height={240}/></Stack>;
 if(!user)return <Alert severity="error">کاربر پیدا نشد</Alert>;
 const current=user.subscriptions[0]; const active=current?.status==="ACTIVE"&&new Date(current.expiresAt)>new Date();
 const statusLabel=active?"فعال":current?.status==="SUSPENDED"?"معلق":current?"منقضی":"بدون اشتراک";
 return <Stack spacing={2.5}>
  <Box sx={{display:"flex",alignItems:"center",gap:1}}>
    <Button variant="text" startIcon={<ArrowRight size={18}/>} onClick={()=>router.push("/rickandmorty/users")}>بازگشت</Button>
    <Box sx={{mr:1}}><Typography variant="h5" fontWeight={700}>{user.name}</Typography><Typography variant="body2" color="text.secondary">{user.email}</Typography></Box>
  </Box>

  <Grid container spacing={2}>
    <Grid size={{xs:12,lg:4}}><Card><CardContent>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>اطلاعات کاربر</Typography>
      <Stack direction="row" spacing={1.5} alignItems="center"><Avatar sx={{width:48,height:48,bgcolor:"#EFF6FF",color:"#2563EB"}}>{user.name[0]}</Avatar><Box><Typography fontWeight={600}>{user.name}</Typography><Typography variant="caption" color="text.secondary">{user.email}</Typography></Box></Stack>
      <Divider sx={{my:2}}/>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">نقش</Typography><Chip size="small" label={user.role==="ADMIN"?"مدیر":"کاربر"} color={user.role==="ADMIN"?"primary":"default"} variant="outlined"/></Stack>
        <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">عضویت</Typography><Typography variant="body2">{new Date(user.createdAt).toLocaleDateString("fa-IR")}</Typography></Stack>
        <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">پیج متصل</Typography><Typography variant="body2">{user.instagramAccounts.length}</Typography></Stack>
      </Stack>
    </CardContent></Card></Grid>

    <Grid size={{xs:12,lg:8}}><Card><CardContent>
      <Typography variant="subtitle1" fontWeight={700} mb={2}>پیج‌های متصل</Typography>
      {user.instagramAccounts.length?<Grid container spacing={1.5}>{user.instagramAccounts.map(a=><Grid key={a.id} size={{xs:12,sm:6}}><Box sx={{border:"1px solid #E2E8F0",borderRadius:2.5,p:2}}><Stack direction="row" justifyContent="space-between" gap={1}><Typography fontWeight={600}>@{a.igUsername}</Typography><Chip size="small" label={a.isConnected?"متصل":"قطع"} color={a.isConnected?"success":"default"} variant="outlined"/></Stack><Typography variant="caption" color="text.secondary" sx={{display:"block",mt:1,overflow:"hidden",textOverflow:"ellipsis"}}>{a.igUserId}</Typography></Box></Grid>)}</Grid>:<Typography align="center" color="text.secondary" variant="body2" sx={{py:5}}>پیجی متصل نشده است</Typography>}
    </CardContent></Card></Grid>
  </Grid>

  <Card><CardContent>
    <Typography variant="subtitle1" fontWeight={700} mb={2}>مدیریت اشتراک</Typography>
    {current?<Box sx={{mb:2.5,p:2,border:"1px solid #E2E8F0",borderRadius:2.5,bgcolor:"#F8FAFC"}}><Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between" gap={1}><Box><Typography fontWeight={600}>{current.planKey}</Typography><Typography variant="caption" color="text.secondary">انقضا: {new Date(current.expiresAt).toLocaleString("fa-IR")}</Typography></Box><Chip label={statusLabel} color={active?"success":current.status==="SUSPENDED"?"warning":"error"} variant="outlined"/></Stack></Box>:<Alert severity="warning" sx={{mb:2.5}}>این کاربر اشتراک ندارد</Alert>}
    <Grid container spacing={1.5}>
      <Grid size={{xs:12,sm:6}}><TextField fullWidth size="small" label="پلن" value={planKey} onChange={e=>setPlanKey(e.target.value)}/></Grid>
      <Grid size={{xs:12,sm:6}}><TextField fullWidth size="small" type="number" label="تعداد روز" value={days} onChange={e=>setDays(Math.max(1,Number(e.target.value)||1))}/></Grid>
    </Grid>
    <Stack direction="row" flexWrap="wrap" gap={1.2} sx={{mt:2}}>
      <Button variant="contained" disabled={busy} startIcon={<Check size={16}/>} onClick={()=>action(current?"activate":"create",days)}>{current?"فعال‌سازی":"ایجاد اشتراک"}</Button>
      <Button variant="outlined" disabled={busy} startIcon={<Plus size={16}/>} onClick={()=>action("extend",7)}>+۷ روز</Button>
      <Button variant="outlined" disabled={busy} startIcon={<Plus size={16}/>} onClick={()=>action("extend",30)}>+۳۰ روز</Button>
      <Button variant="outlined" disabled={busy} startIcon={<Plus size={16}/>} onClick={()=>action("extend",90)}>+۹۰ روز</Button>
      <Button variant="outlined" color="error" disabled={busy} startIcon={<Minus size={16}/>} onClick={()=>action("adjust",-7)}>−۷ روز</Button>
      {current&&<Button variant="outlined" color="warning" disabled={busy} startIcon={<Pause size={16}/>} onClick={()=>action("suspend")}>تعلیق</Button>}
      <Button variant="text" startIcon={<RefreshCw size={16}/>} onClick={load}>به‌روزرسانی</Button>
    </Stack>
  </CardContent></Card>

  <Card><CardContent>
    <Typography variant="subtitle1" fontWeight={700} mb={2}>تاریخچه اشتراک</Typography>
    <TableContainer sx={{overflowX:{xs:"visible",sm:"auto"},minWidth:0}}><Table sx={responsiveAdminTableSx}><TableHead><TableRow><TableCell>پلن</TableCell><TableCell>وضعیت</TableCell><TableCell>منبع</TableCell><TableCell>شروع</TableCell><TableCell>انقضا</TableCell><TableCell>یادداشت</TableCell></TableRow></TableHead><TableBody>
      {user.subscriptions.map(s=><TableRow key={s.id}><TableCell data-label="پلن">{s.planKey}</TableCell><TableCell data-label="وضعیت"><Chip size="small" label={s.status} color={s.status==="ACTIVE"?"success":s.status==="SUSPENDED"?"warning":"error"} variant="outlined"/></TableCell><TableCell data-label="منبع">{s.source}</TableCell><TableCell data-label="شروع">{new Date(s.startedAt).toLocaleDateString("fa-IR")}</TableCell><TableCell data-label="انقضا">{new Date(s.expiresAt).toLocaleDateString("fa-IR")}</TableCell><TableCell data-label="یادداشت">{s.note||"—"}</TableCell></TableRow>)}
    </TableBody></Table></TableContainer>
  </CardContent></Card>
  <Snackbar open={!!notice} autoHideDuration={3500} onClose={()=>setNotice(null)} anchorOrigin={{vertical:"bottom",horizontal:"left"}}><Alert onClose={()=>setNotice(null)} severity={notice?.severity||"success"} variant="filled">{notice?.text}</Alert></Snackbar>
 </Stack>;
}
