"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Avatar, Box, Button, Card, Chip, InputAdornment, MenuItem, Skeleton, Stack, TextField, Typography } from "@mui/material";
import { ArrowLeft, Clock3, MessageSquareText, Search, Send, Ticket as TicketIcon, UserRound, X } from "lucide-react";

type TicketRow = { id:string; subject:string; status:string; priority:string; createdAt:string; updatedAt:string; user:{name:string|null;email:string}; _count:{messages:number} };
const statuses = [{value:"",label:"همه تیکت‌ها"},{value:"OPEN",label:"باز"},{value:"IN_PROGRESS",label:"در حال بررسی"},{value:"WAITING_USER",label:"منتظر پاسخ کاربر"},{value:"RESOLVED",label:"حل‌شده"},{value:"CLOSED",label:"بسته‌شده"}];
const statusMeta:Record<string,{label:string;color:"primary"|"info"|"warning"|"success"|"default"}> = {OPEN:{label:"باز",color:"primary"},IN_PROGRESS:{label:"در حال بررسی",color:"info"},WAITING_USER:{label:"منتظر پاسخ کاربر",color:"warning"},RESOLVED:{label:"حل‌شده",color:"success"},CLOSED:{label:"بسته‌شده",color:"default"}};
const priorityMeta:Record<string,{label:string;color:"error"|"warning"|"default"}> = {LOW:{label:"کم",color:"default"},NORMAL:{label:"عادی",color:"default"},HIGH:{label:"زیاد",color:"warning"},URGENT:{label:"فوری",color:"error"}};
const date = (value:string) => new Intl.DateTimeFormat("fa-IR",{month:"short",day:"numeric"}).format(new Date(value));

export default function TicketsPage() {
 const router=useRouter(); const [rows,setRows]=useState<TicketRow[]>([]); const [loading,setLoading]=useState(true); const [q,setQ]=useState(""); const [status,setStatus]=useState(""); const [error,setError]=useState(""); const [refreshKey,setRefreshKey]=useState(0);
 useEffect(()=>{let cancelled=false;const timer=window.setTimeout(async()=>{setLoading(true);setError("");try{const r=await fetch(`/api/admin/tickets?q=${encodeURIComponent(q.trim())}&status=${encodeURIComponent(status)}`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message||"دریافت تیکت‌ها ناموفق بود");if(!cancelled)setRows(Array.isArray(j.data)?j.data:[]);}catch(e){if(!cancelled)setError(e instanceof Error?e.message:"خطا در دریافت اطلاعات");}finally{if(!cancelled)setLoading(false);}},180);return()=>{cancelled=true;window.clearTimeout(timer);};},[q,status,refreshKey]);
 return <Stack dir="rtl" spacing={{xs:1.75,sm:2.5}} sx={{direction:"rtl",textAlign:"right",minWidth:0}}>
  <Box dir="rtl" sx={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:1,flexWrap:"wrap"}}>
   <Box><Typography sx={{fontSize:{xs:21,sm:25},fontWeight:800,color:"#0F172A"}}>تیکت‌ها</Typography><Typography sx={{mt:.5,fontSize:13,color:"#64748B"}}>درخواست‌های کاربران را یک‌جا ببین و پاسخ بده.</Typography></Box>
   <Button variant="contained" onClick={()=>router.push("/rickandmorty/tickets/bulk")} startIcon={<Send size={16}/>} sx={{borderRadius:2.5,minHeight:42,whiteSpace:"nowrap"}}>ارسال گروهی تیکت</Button>
  </Box>
  <Card variant="outlined" sx={{p:{xs:1.25,sm:1.75},borderRadius:3,borderColor:"#E5EAF1",boxShadow:"0 2px 10px rgba(15,23,42,.025)"}}>
   <Stack spacing={1.25}>
    <TextField fullWidth size="small" value={q} onChange={e=>setQ(e.target.value)} placeholder="جستجو در عنوان، نام یا ایمیل..." inputProps={{"aria-label":"جستجوی تیکت‌ها",dir:"rtl"}} InputProps={{startAdornment:<InputAdornment position="start"><Search size={18} color="#94A3B8"/></InputAdornment>,endAdornment:q?<InputAdornment position="end"><Button onClick={()=>setQ("")} aria-label="پاک کردن جستجو" size="small" sx={{minWidth:30,p:.5,color:"#64748B"}}><X size={16}/></Button></InputAdornment>:undefined}} sx={{"& .MuiOutlinedInput-root":{borderRadius:2.5,bgcolor:"#FAFBFD",minHeight:44}}}/>
    <TextField select fullWidth size="small" value={status} onChange={e=>setStatus(e.target.value)} inputProps={{"aria-label":"فیلتر وضعیت تیکت"}} sx={{"& .MuiOutlinedInput-root":{borderRadius:2.5,bgcolor:"#FAFBFD",minHeight:44}}}>{statuses.map(x=><MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}</TextField>
   </Stack>
   <Box sx={{display:"flex",alignItems:"center",justifyContent:"space-between",mt:1.25,px:.25}}>
    <Typography variant="caption" sx={{color:"#64748B"}}>{loading?"در حال به‌روزرسانی…":`${rows.length.toLocaleString("fa-IR")} تیکت${rows.length===100?" اخیر":""}`}</Typography>
    {status&&<Button size="small" onClick={()=>setStatus("")} sx={{minWidth:0,fontSize:12}}>حذف فیلتر</Button>}
   </Box>
  </Card>
  {error&&<Alert severity="error" action={<Button color="inherit" size="small" onClick={()=>setRefreshKey(v=>v+1)}>تلاش دوباره</Button>}>{error}</Alert>}
  <Stack spacing={1.1}>
   {loading?Array.from({length:4},(_,i)=><Card key={i} variant="outlined" sx={{p:2,borderRadius:3,borderColor:"#E8EDF4"}}><Stack spacing={1.25}><Skeleton width="62%" height={24}/><Skeleton width="42%" height={18}/><Stack direction="row" spacing={1}><Skeleton width={78} height={25}/><Skeleton width={64} height={25}/></Stack></Stack></Card>):
    rows.length?rows.map(t=>{const st=statusMeta[t.status]||{label:t.status,color:"default" as const};const pr=priorityMeta[t.priority]||{label:t.priority,color:"default" as const};return <Card key={t.id} variant="outlined" onClick={()=>router.push(`/rickandmorty/tickets/${t.id}`)} sx={{borderRadius:3,borderColor:"#E5EAF1",overflow:"hidden",cursor:"pointer",transition:"border-color .16s ease,box-shadow .16s ease","&:hover":{borderColor:"#B8CCF8",boxShadow:"0 5px 18px rgba(37,99,235,.07)"},"&:active":{transform:"scale(.995)"}}}>
     <Box sx={{p:{xs:1.5,sm:2},display:"flex",alignItems:"stretch",gap:1.5}}>
      <Avatar sx={{width:42,height:42,bgcolor:"#F1F5F9",color:"#475569",fontWeight:700,fontSize:15,flexShrink:0}}>{(t.user.name||t.user.email||"?").trim().slice(0,1).toUpperCase()}</Avatar>
      <Box sx={{minWidth:0,flex:1}}>
       <Box sx={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:1}}><Typography sx={{fontSize:14,fontWeight:750,color:"#172033",lineHeight:1.8,overflowWrap:"anywhere"}}>{t.subject}</Typography><ArrowLeft size={17} color="#94A3B8" style={{flexShrink:0,marginTop:3}}/></Box>
       <Typography sx={{fontSize:12,color:"#64748B",mt:.15,overflowWrap:"anywhere"}}>{t.user.name||"کاربر بدون نام"} <Box component="span" sx={{mx:.5,color:"#CBD5E1"}}>•</Box> {t.user.email}</Typography>
       <Box sx={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:1,mt:1.25}}>
        <Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap"><Chip size="small" label={st.label} color={st.color} variant="outlined" sx={{height:25,fontSize:11,borderRadius:1.5}}/><Chip size="small" label={`اولویت ${pr.label}`} color={pr.color} variant={pr.color==="default"?"outlined":"filled"} sx={{height:25,fontSize:11,borderRadius:1.5}}/></Stack>
        <Stack direction="row" spacing={1.25} sx={{color:"#64748B",alignItems:"center"}}><Stack direction="row" spacing={.5} alignItems="center"><MessageSquareText size={14}/><Typography variant="caption">{t._count.messages.toLocaleString("fa-IR")}</Typography></Stack><Stack direction="row" spacing={.5} alignItems="center"><Clock3 size={13}/><Typography variant="caption">{date(t.updatedAt)}</Typography></Stack></Stack>
       </Box>
      </Box>
     </Box>
    </Card>}) :
    <Card variant="outlined" sx={{borderRadius:3,borderStyle:"dashed",borderColor:"#CBD5E1",p:{xs:4,sm:6},textAlign:"center"}}>
     <Box sx={{width:52,height:52,mx:"auto",mb:1.5,display:"grid",placeItems:"center",borderRadius:3,bgcolor:"#F1F5F9",color:"#64748B"}}><UserRound size={23}/></Box><Typography fontWeight={750} sx={{color:"#334155"}}>تیکتی پیدا نشد</Typography><Typography sx={{color:"#64748B",fontSize:13,mt:.5}}>عبارت جستجو یا فیلتر وضعیت را تغییر بده.</Typography>{(q||status)&&<Button sx={{mt:1.5}} onClick={()=>{setQ("");setStatus("");}}>نمایش همه تیکت‌ها</Button>}
    </Card>}
  </Stack>
 </Stack>;
}
