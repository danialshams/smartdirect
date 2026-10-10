"use client";

import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, InputLabel, MenuItem,
  Select, Stack, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, Snackbar,
} from "@mui/material";
import { DateTimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/fa";
import { BadgePercent, Plus } from "lucide-react";
import { responsiveAdminTableSx } from "@/components/admin/responsiveTableStyles";

type Coupon={id:string;code:string;discountType:string;value:string;currency?:string|null;validFrom:string;expiresAt?:string|null;maxUses?:number|null;maxUsesPerUser:number;usageCount:number;isActive:boolean;createdAt:string};
type FormState={code:string;discountType:string;value:string;currency:string;validFrom:Dayjs|null;expiresAt:Dayjs|null;maxUses:string;maxUsesPerUser:string};
const initialForm=():FormState=>({code:"",discountType:"PERCENTAGE",value:"",currency:"IRR",validFrom:dayjs(),expiresAt:null,maxUses:"",maxUsesPerUser:"1"});

export default function CouponsPage(){
 const [rows,setRows]=useState<Coupon[]>([]);const [loading,setLoading]=useState(true);const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState<{text:string;severity:"success"|"error"}|null>(null);const [form,setForm]=useState<FormState>(initialForm());
 const load=async()=>{setLoading(true);try{const r=await fetch("/api/admin/coupons",{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message);setRows(j.data);}catch(e){setNotice({text:e instanceof Error?e.message:"خطا",severity:"error"});}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 if(loading&&rows.length===0)return <Box role="status" aria-label="در حال بارگذاری کدهای تخفیف" sx={{minHeight:"calc(100dvh - 150px)",width:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}><CircularProgress size={40} thickness={4}/></Box>;
 const create=async()=>{if(!form.code.trim()||!form.value||!form.validFrom)return;setBusy(true);try{const payload={code:form.code.trim().toUpperCase(),discountType:form.discountType,value:Number(form.value),currency:form.discountType==="FIXED"?form.currency||"IRR":undefined,validFrom:form.validFrom.toISOString(),expiresAt:form.expiresAt?.toISOString(),maxUses:form.maxUses?Number(form.maxUses):undefined,maxUsesPerUser:Number(form.maxUsesPerUser)||1};const r=await fetch("/api/admin/coupons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw new Error(j.message);setNotice({text:"کد تخفیف ایجاد شد",severity:"success"});setOpen(false);setForm(initialForm());await load();}catch(e){setNotice({text:e instanceof Error?e.message:"خطا",severity:"error"});}finally{setBusy(false);}};
 const toggle=async(c:Coupon)=>{try{const r=await fetch("/api/admin/coupons/"+c.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({isActive:!c.isActive})});const j=await r.json();if(!r.ok)throw new Error(j.message);setRows(x=>x.map(i=>i.id===c.id?j:i));}catch(e){setNotice({text:e instanceof Error?e.message:"خطا",severity:"error"});}};
 return <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fa">
  <Stack spacing={{ xs: 1.5, sm: 2.5 }}>
   <Box sx={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:2,flexWrap:"wrap"}}><Box><Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: 20, sm: 24 } }}>کدهای تخفیف</Typography><Typography variant="body2" color="text.secondary">ساخت و مدیریت کدهای تخفیف با بازه اعتبار</Typography></Box><Button variant="contained" startIcon={<Plus size={17}/>} onClick={()=>setOpen(true)}>کد جدید</Button></Box>
   <Card><CardContent sx={{ p: { xs: 1.25, sm: 2.5 }, "&:last-child": { pb: { xs: 1.25, sm: 2.5 } } }}><TableContainer sx={{ overflowX: { xs: "visible", sm: "auto" }, mx: { xs: -1.25, sm: 0 }, width: { xs: "calc(100% + 20px)", sm: "100%" }, minWidth: 0 }}><Table sx={responsiveAdminTableSx}><TableHead><TableRow><TableCell>کد</TableCell><TableCell>تخفیف</TableCell><TableCell>اعتبار</TableCell><TableCell>استفاده</TableCell><TableCell>وضعیت</TableCell><TableCell>عملیات</TableCell></TableRow></TableHead><TableBody>
    {loading?<TableRow><TableCell colSpan={6} align="center" sx={{py:6}}><Box role="status" aria-label="در حال بارگذاری کدهای تخفیف" sx={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:100}}><CircularProgress size={36} thickness={4}/></Box></TableCell></TableRow>:rows.length?rows.map(r=><TableRow key={r.id}><TableCell data-label="کد"><Typography fontFamily="monospace" fontWeight={700}>{r.code}</Typography></TableCell><TableCell data-label="تخفیف">{r.discountType==="PERCENTAGE"?r.value+"%":r.value+" "+(r.currency||"")}</TableCell><TableCell data-label="اعتبار">{r.expiresAt?new Date(r.validFrom).toLocaleDateString("fa-IR")+" تا "+new Date(r.expiresAt).toLocaleDateString("fa-IR"):"از "+new Date(r.validFrom).toLocaleDateString("fa-IR")+" به بعد"}</TableCell><TableCell data-label="استفاده">{r.usageCount}{r.maxUses?" / "+r.maxUses:""}</TableCell><TableCell data-label="وضعیت"><Chip size="small" label={r.isActive?"فعال":"غیرفعال"} color={r.isActive?"success":"default"} variant="outlined"/></TableCell><TableCell data-label="عملیات"><Switch size="small" checked={r.isActive} onChange={()=>toggle(r)} inputProps={{"aria-label":`تغییر وضعیت کد ${r.code}`}}/></TableCell></TableRow>):<TableRow><TableCell colSpan={6}><Stack alignItems="center" spacing={1} sx={{py:5}}><BadgePercent size={30} color="#94A3B8"/><Typography variant="body2" color="text.secondary">کد تخفیفی ثبت نشده است</Typography></Stack></TableCell></TableRow>}
   </TableBody></Table></TableContainer></CardContent></Card>
  </Stack>
  <Dialog open={open} onClose={()=>!busy&&setOpen(false)} fullWidth maxWidth="sm">
   <DialogTitle fontWeight={700}>ایجاد کد تخفیف</DialogTitle>
   <DialogContent dividers>
    <Stack spacing={2} sx={{pt:1}}>
      <TextField fullWidth label="کد تخفیف" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="مثلاً SMART30"/>
      <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"1fr 1fr"},gap:1.5}}><FormControl fullWidth><InputLabel>نوع تخفیف</InputLabel><Select value={form.discountType} label="نوع تخفیف" onChange={e=>setForm({...form,discountType:e.target.value})}><MenuItem value="PERCENTAGE">درصدی</MenuItem><MenuItem value="FIXED">مبلغ ثابت</MenuItem></Select></FormControl><TextField fullWidth type="number" label="مقدار" value={form.value} onChange={e=>setForm({...form,value:e.target.value})}/></Box>
      <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"1fr 1fr"},gap:1.5}}><DateTimePicker label="شروع اعتبار" value={form.validFrom} onChange={v=>setForm({...form,validFrom:v})} slotProps={{textField:{fullWidth:true,size:"small"}}}/><DateTimePicker label="پایان اعتبار" value={form.expiresAt} onChange={v=>setForm({...form,expiresAt:v})} slotProps={{textField:{fullWidth:true,size:"small"}}}/></Box>
      <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"1fr 1fr"},gap:1.5}}><TextField fullWidth type="number" label="حداکثر استفاده" value={form.maxUses} onChange={e=>setForm({...form,maxUses:e.target.value})}/><TextField fullWidth type="number" label="حداکثر استفاده هر کاربر" value={form.maxUsesPerUser} onChange={e=>setForm({...form,maxUsesPerUser:e.target.value})}/></Box>
      {form.discountType==="FIXED"&&<TextField fullWidth label="واحد پول" value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})} placeholder="IRR"/>}
    </Stack>
   </DialogContent>
   <DialogActions sx={{px:3,py:2}}><Button onClick={()=>setOpen(false)} disabled={busy}>انصراف</Button><Button variant="contained" onClick={create} disabled={busy||!form.code.trim()||!form.value||!form.validFrom}>{busy?"در حال ایجاد...":"ایجاد کد تخفیف"}</Button></DialogActions>
  </Dialog>
  <Snackbar open={!!notice} autoHideDuration={3500} onClose={()=>setNotice(null)} anchorOrigin={{vertical:"bottom",horizontal:"left"}}><Alert onClose={()=>setNotice(null)} severity={notice?.severity||"success"} variant="filled">{notice?.text}</Alert></Snackbar>
 </LocalizationProvider>;
}