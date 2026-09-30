"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert, Box, Button, Card, CardContent, FormControl, InputLabel, MenuItem,
  Select, Skeleton, Snackbar, Stack, TextField, Typography,
} from "@mui/material";
import { ArrowRight, Send } from "lucide-react";

type TicketData={id:string;subject:string;status:string;priority:string;createdAt:string;user:{name:string;email:string};messages:{id:string;body:string;createdAt:string;senderUserId:string;sender:{name:string;role:string}}[]};
const statuses=[{value:"OPEN",label:"باز"},{value:"IN_PROGRESS",label:"در حال بررسی"},{value:"WAITING_USER",label:"منتظر کاربر"},{value:"RESOLVED",label:"حل‌شده"},{value:"CLOSED",label:"بسته"}];
const priorities=[{value:"LOW",label:"کم"},{value:"NORMAL",label:"عادی"},{value:"HIGH",label:"زیاد"},{value:"URGENT",label:"فوری"}];

export default function TicketDetailPage(){
 const {id}=useParams<{id:string}>();const router=useRouter();const [ticket,setTicket]=useState<TicketData|null>(null);const [loading,setLoading]=useState(true);const [body,setBody]=useState("");const [busy,setBusy]=useState(false);const [notice,setNotice]=useState<{text:string;severity:"success"|"error"}|null>(null);
 const load=async()=>{setLoading(true);try{const r=await fetch(`/api/admin/tickets/${id}`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message);setTicket(j);}catch(e){setNotice({text:e instanceof Error?e.message:"خطا",severity:"error"});}finally{setLoading(false);}};
 useEffect(()=>{if(id)load();},[id]);
 const patch=async(data:Record<string,unknown>)=>{try{const r=await fetch(`/api/admin/tickets/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.message);setTicket(t=>t?{...t,...j}:t);setNotice({text:"ذخیره شد",severity:"success"});}catch(e){setNotice({text:e instanceof Error?e.message:"خطا",severity:"error"});}};
 const send=async()=>{if(!body.trim())return;setBusy(true);try{const r=await fetch(`/api/admin/tickets/${id}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body})});const j=await r.json();if(!r.ok)throw new Error(j.message);setBody("");await load();setNotice({text:"پاسخ ارسال شد",severity:"success"});}catch(e){setNotice({text:e instanceof Error?e.message:"خطا",severity:"error"});}finally{setBusy(false);}};
 if(loading)return <Stack spacing={2}><Skeleton variant="rounded" height={100}/><Skeleton variant="rounded" height={420}/></Stack>;
 if(!ticket)return <Alert severity="error">تیکت پیدا نشد</Alert>;
 return <Stack spacing={2.5}>
   <Box sx={{display:"flex",alignItems:"center",gap:1}}><Button variant="text" startIcon={<ArrowRight size={18}/>} onClick={()=>router.push("/rickandmorty/tickets")}>بازگشت</Button><Box><Typography variant="h5" fontWeight={700}>{ticket.subject}</Typography><Typography variant="body2" color="text.secondary">{ticket.user.name} · {ticket.user.email}</Typography></Box></Box>
   <Card><CardContent><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"1fr 1fr"},gap:1.5}}>
     <FormControl size="small"><InputLabel>وضعیت</InputLabel><Select value={ticket.status} label="وضعیت" onChange={e=>patch({status:e.target.value})}>{statuses.map(x=><MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}</Select></FormControl>
     <FormControl size="small"><InputLabel>اولویت</InputLabel><Select value={ticket.priority} label="اولویت" onChange={e=>patch({priority:e.target.value})}>{priorities.map(x=><MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}</Select></FormControl>
   </Box></CardContent></Card>
   <Card><CardContent>
    <Typography variant="subtitle1" fontWeight={700} mb={2}>گفتگو</Typography>
    <Box sx={{maxHeight:"55vh",overflowY:"auto",display:"grid",gap:1.5,pb:2}}>
      {ticket.messages.map(m=><Box key={m.id} sx={{border:"1px solid",borderColor:m.sender.role==="ADMIN"?"#BFDBFE":"#E2E8F0",bgcolor:m.sender.role==="ADMIN"?"#EFF6FF":"#F8FAFC",borderRadius:3,p:2}}>
        <Stack direction="row" justifyContent="space-between" gap={2} mb={.5}><Typography variant="caption" fontWeight={700}>{m.sender.name}</Typography><Typography variant="caption" color="text.secondary">{new Date(m.createdAt).toLocaleString("fa-IR")}</Typography></Stack>
        <Typography variant="body2" sx={{whiteSpace:"pre-wrap",lineHeight:1.9}}>{m.body}</Typography>
      </Box>)}
    </Box>
    <Box sx={{borderTop:"1px solid #E2E8F0",pt:2}}><TextField fullWidth multiline minRows={3} maxRows={7} value={body} onChange={e=>setBody(e.target.value)} placeholder="پاسخ خود را بنویسید..."/><Box sx={{display:"flex",justifyContent:"flex-end",mt:1.5}}><Button variant="contained" startIcon={<Send size={16}/>} disabled={busy||!body.trim()} onClick={send}>ارسال پاسخ</Button></Box></Box>
   </CardContent></Card>
   <Snackbar open={!!notice} autoHideDuration={3500} onClose={()=>setNotice(null)} anchorOrigin={{vertical:"bottom",horizontal:"left"}}><Alert onClose={()=>setNotice(null)} severity={notice?.severity||"success"} variant="filled">{notice?.text}</Alert></Snackbar>
 </Stack>;
}
