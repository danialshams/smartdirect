"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Checkbox, CircularProgress,
  FormControl, InputLabel, MenuItem, Pagination, Select, Stack, TextField, Typography,
} from "@mui/material";
import { ArrowRight, Search, Send, Users } from "lucide-react";

type UserRow = { id: string; name: string | null; email: string; pagesCount: number; subscription?: { planKey: string; effectiveStatus: string | null; expiresAt: string } | null };
type Filters = { q: string; planKey: string; status: string; expiryWithin: string; connection: string };
type Result = { processed: number; succeeded: number; failed: number; results: { userId: string; success: boolean; message?: string }[] };
const statusLabels: Record<string,string> = { ACTIVE:"فعال", EXPIRED:"منقضی", SUSPENDED:"تعلیق‌شده", CANCELLED:"لغوشده", NONE:"بدون اشتراک" };

export default function BulkTicketPage() {
  const router = useRouter();
  const [rows,setRows] = useState<UserRow[]>([]);
  const [total,setTotal] = useState(0);
  const [page,setPage] = useState(1);
  const [loading,setLoading] = useState(true);
  const [filters,setFilters] = useState<Filters>({q:"",planKey:"",status:"",expiryWithin:"",connection:""});
  const [selectedIds,setSelectedIds] = useState<string[]>([]);
  const [excludedIds,setExcludedIds] = useState<string[]>([]);
  const [allFiltered,setAllFiltered] = useState(false);
  const [subject,setSubject] = useState("");
  const [message,setMessage] = useState("");
  const [submitting,setSubmitting] = useState(false);
  const [error,setError] = useState("");
  const [result,setResult] = useState<Result|null>(null);
  const selectedCount = allFiltered ? Math.max(0,total-excludedIds.length) : selectedIds.length;
  const pageSelected = rows.length > 0 && rows.every((r) => allFiltered ? !excludedIds.includes(r.id) : selectedIds.includes(r.id));
  const query = useMemo(() => {
    const p = new URLSearchParams({ page:String(page), pageSize:"20", q:filters.q });
    if(filters.planKey) p.set("planKey",filters.planKey);
    if(filters.status) p.set("status",filters.status);
    if(filters.expiryWithin) p.set("expiryWithin",filters.expiryWithin);
    if(filters.connection) p.set("connection",filters.connection);
    return p.toString();
  },[page,filters]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/admin/users?"+query,{cache:"no-store"}).then(async r => {
      const j=await r.json(); if(!r.ok) throw new Error(j.message||"دریافت کاربران ناموفق بود");
      if(alive){setRows(j.data);setTotal(j.total);}
    }).catch(e=>{if(alive)setError(e instanceof Error?e.message:"خطا در دریافت کاربران");}).finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[query]);
  const updateFilter = (key:keyof Filters,value:string) => {
    setFilters(f=>({...f,[key]:value})); setPage(1); setSelectedIds([]); setExcludedIds([]); setAllFiltered(false); setResult(null);
  };
  const togglePage = (checked:boolean) => {
    setResult(null);
    if(allFiltered) setExcludedIds(current=>checked?current.filter(id=>!rows.some(r=>r.id===id)):[...new Set([...current,...rows.map(r=>r.id)])]);
    else setSelectedIds(current=>checked?[...new Set([...current,...rows.map(r=>r.id)])]:current.filter(id=>!rows.some(r=>r.id===id)));
  };
  const send = async () => {
    setSubmitting(true);setError("");setResult(null);
    try {
      const selection = allFiltered
        ? {mode:"filtered",filters,excludeUserIds:excludedIds}
        : {mode:"ids",userIds:selectedIds};
      const r=await fetch("/api/admin/tickets/bulk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({selection,subject,message})});
      const j=await r.json();if(!r.ok)throw new Error(j.message||"ارسال گروهی ناموفق بود");
      setResult(j as Result);setSelectedIds([]);setExcludedIds([]);setAllFiltered(false);
    } catch(e){setError(e instanceof Error?e.message:"ارسال گروهی ناموفق بود");}
    finally{setSubmitting(false);}
  };
  return <Stack dir="rtl" spacing={2.5} sx={{direction:"rtl",textAlign:"right",alignItems:"stretch",minWidth:0,width:"100%"}}>
    <Box dir="rtl" sx={{direction:"rtl",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:1,width:"100%",minWidth:0}}>
      <Button variant="contained" color="primary" onClick={()=>router.push("/rickandmorty/tickets")} sx={{alignSelf:"flex-start",flexShrink:0,minHeight:40,px:2,direction:"rtl",borderRadius:2,fontWeight:700,boxShadow:"none"}}><Box component="span" sx={{display:"inline-flex",alignItems:"center",gap:1,direction:"ltr",flexDirection:"row-reverse"}}><ArrowRight size={18}/>بازگشت</Box></Button>
      <Box dir="rtl" sx={{width:"100%",minWidth:0,textAlign:"right",direction:"rtl"}}>
        <Typography variant="h5" fontWeight={800} sx={{fontSize:{xs:20,sm:24},textAlign:"right",direction:"rtl",overflowWrap:"anywhere"}}>ارسال گروهی تیکت</Typography>
        <Typography variant="body2" color="text.secondary" sx={{textAlign:"right",direction:"rtl",overflowWrap:"anywhere"}}>برای هر کاربر، یک تیکت مستقل با همین عنوان و متن ساخته می‌شود.</Typography>
      </Box>
    </Box>
    {error && <Alert severity="error" onClose={()=>setError("")}>{error}</Alert>}
    {result && <Alert severity={result.failed?"warning":"success"} onClose={()=>setResult(null)}>نتیجه ارسال: {result.succeeded} موفق، {result.failed} ناموفق از {result.processed} کاربر.</Alert>}
    <Card dir="rtl" sx={{direction:"rtl",textAlign:"right",width:"100%",minWidth:0}}><CardContent sx={{p:{xs:1.5,sm:2.5},direction:"rtl",textAlign:"right"}}><Stack dir="rtl" spacing={1.5} sx={{direction:"rtl",alignItems:"stretch",textAlign:"right",width:"100%",minWidth:0}}>
      <Typography dir="rtl" fontWeight={700} sx={{direction:"rtl",textAlign:"right",width:"100%",alignSelf:"stretch"}}>۱. انتخاب مخاطبان</Typography>
      <TextField dir="rtl" fullWidth size="small" value={filters.q} onChange={e=>updateFilter("q",e.target.value)} placeholder="جستجو بر اساس نام یا ایمیل" inputProps={{dir:"rtl"}} sx={{"& .MuiInputBase-root":{direction:"rtl",position:"relative",paddingRight:"44px !important"},"& .MuiInputBase-input":{textAlign:"right",direction:"rtl",paddingRight:"0 !important",paddingLeft:"12px"},"& .MuiInputAdornment-root":{position:"absolute",right:12,left:"auto",margin:0,pointerEvents:"none"}}} InputProps={{startAdornment:<Box sx={{display:"flex",alignItems:"center"}}><Search size={18}/></Box>}}/>
      <Box dir="rtl" sx={{direction:"rtl",textAlign:"right",display:"grid",gridTemplateColumns:{xs:"1fr",sm:"1fr 1fr"},gap:1.5,"& .MuiFormControl-root":{direction:"rtl",textAlign:"right"},"& .MuiInputLabel-root":{right:14,left:"auto",transformOrigin:"top right"},"& .MuiSelect-select":{direction:"rtl",textAlign:"right",paddingRight:"14px !important",paddingLeft:"32px !important"},"& .MuiSelect-icon":{right:"auto",left:7}}}>
        <FormControl size="small" fullWidth><InputLabel>نوع اشتراک</InputLabel><Select value={filters.planKey} label="نوع اشتراک" onChange={e=>updateFilter("planKey",String(e.target.value))}><MenuItem value="">همه پلن‌ها</MenuItem><MenuItem value="free">رایگان</MenuItem><MenuItem value="monthly">ماهانه</MenuItem><MenuItem value="yearly">سالانه</MenuItem></Select></FormControl>
        <FormControl size="small" fullWidth><InputLabel>وضعیت اشتراک</InputLabel><Select value={filters.status} label="وضعیت اشتراک" onChange={e=>updateFilter("status",String(e.target.value))}><MenuItem value="">همه وضعیت‌ها</MenuItem>{Object.entries(statusLabels).map(([v,l])=><MenuItem key={v} value={v}>{l}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" fullWidth><InputLabel>زمان تا انقضا</InputLabel><Select value={filters.expiryWithin} label="زمان تا انقضا" onChange={e=>updateFilter("expiryWithin",String(e.target.value))}><MenuItem value="">همه زمان‌ها</MenuItem><MenuItem value="3">کمتر از ۳ روز</MenuItem><MenuItem value="7">کمتر از ۷ روز</MenuItem></Select></FormControl>
        <FormControl size="small" fullWidth><InputLabel>اتصال اینستاگرام</InputLabel><Select value={filters.connection} label="اتصال اینستاگرام" onChange={e=>updateFilter("connection",String(e.target.value))}><MenuItem value="">همه وضعیت‌ها</MenuItem><MenuItem value="connected">پیج متصل دارد</MenuItem><MenuItem value="disconnected">پیج متصل ندارد</MenuItem></Select></FormControl>
      </Box>
      <Stack dir="rtl" direction={{xs:"column",sm:"row"}} spacing={1} alignItems={{xs:"stretch",sm:"center"}} sx={{direction:"rtl",width:"100%",textAlign:"right"}}>
        <Button fullWidth={false} size="small" variant="outlined" onClick={()=>togglePage(!pageSelected)} disabled={loading||!rows.length}>{pageSelected?"لغو انتخاب این صفحه":"انتخاب این صفحه"}</Button>
        <Button size="small" variant={allFiltered?"contained":"outlined"} onClick={()=>{setAllFiltered(v=>!v);setSelectedIds([]);setExcludedIds([]);}} disabled={loading||total===0}>{allFiltered?"لغو انتخاب نتایج فیلترشده":`انتخاب همه ${total} نتیجه فیلترشده`}</Button>
        <Typography variant="body2" color="text.secondary">انتخاب‌شده: {selectedCount}</Typography>
      </Stack>
      <Stack dir="rtl" spacing={0.75} sx={{direction:"rtl",width:"100%",textAlign:"right"}}>
        {loading ? <Box role="status" aria-label="در حال دریافت کاربران" sx={{minHeight:220,width:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}><CircularProgress size={36} thickness={4}/></Box> : rows.length ? rows.map(r=><Box key={r.id} dir="rtl" sx={{direction:"ltr",display:"flex",flexDirection:"row-reverse",alignItems:"center",gap:1,border:"1px solid",borderColor:"divider",borderRadius:2,p:1,minWidth:0}}>
          <Checkbox sx={{flexShrink:0,m:0}} checked={allFiltered?!excludedIds.includes(r.id):selectedIds.includes(r.id)} onChange={e=>{if(allFiltered)setExcludedIds(cur=>e.target.checked?cur.filter(id=>id!==r.id):[...new Set([...cur,r.id])]);else setSelectedIds(cur=>e.target.checked?[...new Set([...cur,r.id])]:cur.filter(id=>id!==r.id));}}/>
          <Avatar sx={{width:36,height:36,fontSize:14}}>{r.name?.[0]||"ک"}</Avatar>
          <Box sx={{minWidth:0,flex:1}}><Typography variant="body2" fontWeight={700} sx={{overflowWrap:"anywhere"}}>{r.name||"بدون نام"}</Typography><Typography variant="caption" color="text.secondary" sx={{overflowWrap:"anywhere"}}>{r.email}</Typography></Box>
        </Box>) : <Box sx={{py:3,textAlign:"center"}}><Users size={28}/><Typography variant="body2" color="text.secondary">کاربری با این فیلتر پیدا نشد</Typography></Box>}
      </Stack>
      {!loading&&total>20&&<Box sx={{display:"flex",justifyContent:"center"}}><Pagination page={page} count={Math.ceil(total/20)} onChange={(_,v)=>setPage(v)} color="primary"/></Box>}
    </Stack></CardContent></Card>
    <Card><CardContent sx={{p:{xs:1.5,sm:2.5}}}><Stack spacing={1.5}>
      <Typography dir="rtl" fontWeight={700} sx={{textAlign:"right",direction:"rtl",width:"100%"}}>۲. متن تیکت</Typography>
      <TextField dir="rtl" fullWidth required label="عنوان تیکت" value={subject} onChange={e=>setSubject(e.target.value)} inputProps={{maxLength:160,dir:"rtl",style:{textAlign:"right"}}} sx={{"& .MuiInputLabel-root":{right:14,left:"auto",transformOrigin:"top right"},"& .MuiOutlinedInput-notchedOutline legend":{textAlign:"right"},"& .MuiFormHelperText-root":{textAlign:"right",direction:"rtl"}}} helperText={`${subject.length}/160`}/>
      <TextField dir="rtl" fullWidth required multiline minRows={4} maxRows={10} label="متن پیام" value={message} onChange={e=>setMessage(e.target.value)} inputProps={{maxLength:5000,dir:"rtl",style:{textAlign:"right"}}} sx={{"& .MuiInputLabel-root":{right:14,left:"auto",transformOrigin:"top right"},"& .MuiOutlinedInput-notchedOutline legend":{textAlign:"right"},"& .MuiFormHelperText-root":{textAlign:"right",direction:"rtl"}}} helperText={`هر مخاطب یک تیکت مستقل دریافت می‌کند. ${message.length}/5000`}/>
      <Button fullWidth variant="contained" size="large" disabled={submitting||selectedCount===0||!subject.trim()||!message.trim()} onClick={send} sx={{minHeight:48,whiteSpace:"normal",lineHeight:1.7}}><Box component="span" sx={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:1,direction:"ltr",flexDirection:"row-reverse",width:"100%"}}>{submitting?<CircularProgress size={18} color="inherit"/>:<Send size={18}/>}<Box component="span" sx={{direction:"rtl",textAlign:"right"}}>{submitting?"در حال ایجاد تیکت‌ها…":`ایجاد تیکت برای ${selectedCount.toLocaleString("fa-IR")} کاربر`}</Box></Box></Button>
      <Typography variant="caption" color="text.secondary">برای جلوگیری از ارسال ناخواسته، در هر بار حداکثر ۵۰۰ کاربر پذیرفته می‌شود.</Typography>
    </Stack></CardContent></Card>
  </Stack>;
}
