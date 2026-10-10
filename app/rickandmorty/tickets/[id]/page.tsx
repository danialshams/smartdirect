"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert, Avatar, Box, Button, Card, Chip, CircularProgress, FormControl, IconButton,
  InputLabel, MenuItem, Select, Skeleton, Snackbar, Stack, TextField, Typography,
} from "@mui/material";
import { ArrowRight, CheckCheck, Clock3, Send, ShieldCheck, UserRound } from "lucide-react";

type TicketMessage = { id:string; body:string; createdAt:string; senderUserId:string; sender:{name:string|null;role:string} };
type TicketData = { id:string; subject:string; status:string; priority:string; createdAt:string; updatedAt:string; user:{id:string;name:string|null;email:string}; messages:TicketMessage[] };
const statuses = [{value:"OPEN",label:"باز"},{value:"IN_PROGRESS",label:"در حال بررسی"},{value:"WAITING_USER",label:"منتظر پاسخ کاربر"},{value:"RESOLVED",label:"حل‌شده"},{value:"CLOSED",label:"بسته‌شده"}];
const priorities = [{value:"LOW",label:"کم"},{value:"NORMAL",label:"عادی"},{value:"HIGH",label:"زیاد"},{value:"URGENT",label:"فوری"}];
const statusLabel:Record<string,string> = {OPEN:"باز",IN_PROGRESS:"در حال بررسی",WAITING_USER:"منتظر پاسخ کاربر",RESOLVED:"حل‌شده",CLOSED:"بسته‌شده"};
const priorityLabel:Record<string,string> = {LOW:"کم",NORMAL:"عادی",HIGH:"زیاد",URGENT:"فوری"};
const stamp = (value:string) => new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"}).format(new Date(value));

export default function TicketDetailPage() {
 const {id}=useParams<{id:string}>(); const router=useRouter();
 const [ticket,setTicket]=useState<TicketData|null>(null); const [loading,setLoading]=useState(true); const [body,setBody]=useState(""); const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState<{text:string;severity:"success"|"error"}|null>(null); const [loadError,setLoadError]=useState("");
 const messagesEnd=useRef<HTMLDivElement|null>(null);
 const load=useCallback(async(showLoading=false)=>{if(showLoading)setLoading(true);setLoadError("");try{const r=await fetch(`/api/admin/tickets/${id}`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message||"دریافت تیکت ناموفق بود");setTicket(j);}catch(e){setLoadError(e instanceof Error?e.message:"خطا در دریافت تیکت");}finally{setLoading(false);}},[id]);
 useEffect(()=>{if(id)void load(true);},[id,load]);
 useEffect(()=>{messagesEnd.current?.scrollIntoView({behavior:"smooth",block:"end"});},[ticket?.messages.length,loading]);
 const patch=async(data:Record<string,unknown>)=>{try{const r=await fetch(`/api/admin/tickets/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.message||"ذخیره تغییرات ناموفق بود");setTicket(t=>t?{...t,...j}:t);setNotice({text:"تغییرات ذخیره شد",severity:"success"});}catch(e){setNotice({text:e instanceof Error?e.message:"خطا در ذخیره",severity:"error"});}};
 const send=async()=>{if(!body.trim()||busy)return;setBusy(true);try{const r=await fetch(`/api/admin/tickets/${id}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:body.trim()})});const j=await r.json();if(!r.ok)throw new Error(j.message||"ارسال پاسخ ناموفق بود");setBody("");await load();setNotice({text:"پاسخ ارسال شد",severity:"success"});}catch(e){setNotice({text:e instanceof Error?e.message:"خطا در ارسال پاسخ",severity:"error"});}finally{setBusy(false);}};
 const handleKeyDown=(e:KeyboardEvent<HTMLDivElement>)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}};
 if(loading)return <Stack dir="rtl" spacing={2} sx={{direction:"rtl",textAlign:"right"}}><Skeleton variant="rounded" height={74}/><Skeleton variant="rounded" height={42}/><Skeleton variant="rounded" height={460}/></Stack>;
 if(!ticket)return <Stack dir="rtl" spacing={2} sx={{direction:"rtl",textAlign:"right"}}><Button startIcon={<ArrowRight size={18}/>} onClick={()=>router.push("/rickandmorty/tickets")} sx={{alignSelf:"flex-start"}}>بازگشت به تیکت‌ها</Button><Alert severity="error">{loadError||"تیکت پیدا نشد"}</Alert><Button onClick={()=>void load(true)}>تلاش دوباره</Button></Stack>;
 return <Stack dir="rtl" spacing={{xs:1.25,sm:1.75}} sx={{direction:"rtl",textAlign:"right",minWidth:0}}>
  <Box sx={{display:"flex",alignItems:"flex-start",gap:1,minWidth:0}}>
   <IconButton onClick={()=>router.push("/rickandmorty/tickets")} aria-label="بازگشت به فهرست تیکت‌ها" sx={{mt:.25,width:42,height:42,flexShrink:0,border:"1px solid #E2E8F0",borderRadius:2.5,color:"#334155",bgcolor:"#fff"}}><ArrowRight size={19}/></IconButton>
   <Avatar sx={{width:42,height:42,flexShrink:0,bgcolor:"#EAF2FF",color:"#2563EB",fontWeight:800}}>{(ticket.user.name||ticket.user.email||"?").trim().slice(0,1).toUpperCase()}</Avatar>
   <Box sx={{minWidth:0,flex:1}}>
    <Typography sx={{fontSize:{xs:16,sm:21},fontWeight:800,color:"#0F172A",lineHeight:1.7,overflowWrap:"anywhere"}}>{ticket.subject}</Typography>
    <Typography sx={{fontSize:12,color:"#64748B",mt:.2,overflowWrap:"anywhere"}}>{ticket.user.name||"کاربر بدون نام"} · {ticket.user.email}</Typography>
    <Stack direction="row" spacing={.75} sx={{mt:.75}} useFlexGap flexWrap="wrap">
     <Chip size="small" label={statusLabel[ticket.status]||ticket.status} color={ticket.status==="OPEN"?"primary":ticket.status==="WAITING_USER"?"warning":ticket.status==="CLOSED"?"default":"success"} variant="outlined" sx={{height:24,fontSize:11}}/>
     <Chip size="small" label={`اولویت ${priorityLabel[ticket.priority]||ticket.priority}`} color={ticket.priority==="URGENT"?"error":ticket.priority==="HIGH"?"warning":"default"} variant="outlined" sx={{height:24,fontSize:11}}/>
    </Stack>
   </Box>
  </Box>
  <Card variant="outlined" sx={{p:{xs:1,sm:1.25},borderRadius:3,borderColor:"#E5EAF1",display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:1}}>
   <FormControl size="small" fullWidth><InputLabel id="ticket-status-label">وضعیت</InputLabel><Select labelId="ticket-status-label" value={ticket.status} label="وضعیت" onChange={e=>void patch({status:e.target.value})}>{statuses.map(x=><MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}</Select></FormControl>
   <FormControl size="small" fullWidth><InputLabel id="ticket-priority-label">اولویت</InputLabel><Select labelId="ticket-priority-label" value={ticket.priority} label="اولویت" onChange={e=>void patch({priority:e.target.value})}>{priorities.map(x=><MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}</Select></FormControl>
  </Card>

  <Card variant="outlined" sx={{borderRadius:3,borderColor:"#E5EAF1",overflow:"hidden",display:"flex",flexDirection:"column",height:{xs:"calc(100dvh - 265px)",sm:"calc(100dvh - 300px)"},minHeight:390,maxHeight:900}}>
   <Box sx={{px:{xs:1.5,sm:2},py:1.25,borderBottom:"1px solid #E8EDF4",display:"flex",alignItems:"center",justifyContent:"space-between",gap:1,bgcolor:"#fff"}}>
    <Stack direction="row" spacing={1} alignItems="center"><Box sx={{width:34,height:34,display:"grid",placeItems:"center",borderRadius:2,bgcolor:"#F1F5F9",color:"#475569"}}><UserRound size={17}/></Box><Box><Typography sx={{fontSize:13,fontWeight:800,color:"#172033"}}>گفتگو</Typography><Typography sx={{fontSize:11,color:"#64748B"}}>{ticket.messages.length.toLocaleString("fa-IR")} پیام</Typography></Box></Stack>
    <Stack direction="row" spacing={.5} alignItems="center" sx={{color:"#16A34A"}}><ShieldCheck size={14}/><Typography sx={{fontSize:11}}>پشتیبانی</Typography></Stack>
   </Box>
   <Box sx={{flex:1,minHeight:0,overflowY:"auto",p:{xs:1.25,sm:2},bgcolor:"#F8FAFC",display:"flex",flexDirection:"column",gap:1.5,overscrollBehavior:"contain"}}>
    {ticket.messages.length===0&&<Box sx={{m:"auto",textAlign:"center",color:"#64748B",py:5}}><Box sx={{mx:"auto",mb:1,width:48,height:48,borderRadius:3,bgcolor:"#E2E8F0",display:"grid",placeItems:"center"}}><MessageSquareIconFallback/></Box><Typography sx={{fontSize:13,fontWeight:700}}>شروع گفتگو</Typography><Typography sx={{fontSize:12,mt:.5}}>اولین پاسخ را برای کاربر ارسال کن.</Typography></Box>}
    {ticket.messages.map(m=>{const admin=m.sender.role==="ADMIN";return <Box key={m.id} sx={{display:"flex",justifyContent:admin?"flex-start":"flex-end",width:"100%"}}>
     <Box sx={{maxWidth:{xs:"90%",sm:"78%"},minWidth:0}}>
      <Box sx={{display:"flex",alignItems:"center",gap:.75,mb:.5,justifyContent:admin?"flex-start":"flex-end"}}>
       <Typography sx={{fontSize:11,fontWeight:750,color:admin?"#2563EB":"#475569"}}>{admin?"پشتیبانی":(m.sender.name||ticket.user.name||"کاربر")}</Typography>
       <Typography sx={{fontSize:10,color:"#94A3B8",display:"flex",alignItems:"center",gap:.35}}><Clock3 size={11}/>{stamp(m.createdAt)}</Typography>
      </Box>
      <Box sx={{px:1.5,py:1.15,borderRadius:admin?"3px 14px 14px 14px":"14px 3px 14px 14px",bgcolor:admin?"#E8F1FF":"#fff",border:"1px solid",borderColor:admin?"#D5E4FF":"#E2E8F0",boxShadow:"0 1px 2px rgba(15,23,42,.025)"}}>
       <Typography sx={{fontSize:13,lineHeight:1.95,color:"#1E293B",whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{m.body}</Typography>
      </Box>
      {admin&&<Box sx={{display:"flex",justifyContent:"flex-start",mt:.35,color:"#94A3B8"}}><CheckCheck size={13}/></Box>}
     </Box>
    </Box>})}
    <div ref={messagesEnd}/>
   </Box>
   {loadError&&<Alert severity="error" sx={{m:1}}>{loadError}</Alert>}
   <Box sx={{p:{xs:1,sm:1.5},borderTop:"1px solid #E8EDF4",bgcolor:"#fff"}}>
    <TextField fullWidth multiline minRows={2} maxRows={4} value={body} onChange={e=>setBody(e.target.value)} onKeyDown={handleKeyDown} placeholder="پاسخ خود را بنویسید… (Enter برای ارسال)" inputProps={{"aria-label":"متن پاسخ تیکت",dir:"rtl"}} sx={{"& .MuiOutlinedInput-root":{borderRadius:2.5,bgcolor:"#FAFBFD",alignItems:"flex-end",fontSize:13,lineHeight:1.8,p:1.25},"& textarea":{padding:0}}}/>
    <Box sx={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:1,mt:1}}>
     <Typography sx={{fontSize:10.5,color:"#94A3B8",display:{xs:"none",sm:"block"}}}>Shift + Enter برای خط جدید</Typography>
     <Button variant="contained" onClick={()=>void send()} disabled={busy||!body.trim()} startIcon={busy?<CircularProgress size={15} color="inherit"/>:<Send size={16}/>} sx={{mr:"auto",minWidth:{xs:108,sm:140},minHeight:42,borderRadius:2.5,textTransform:"none",fontWeight:700,boxShadow:"none",bgcolor:"#2563EB","&:hover":{bgcolor:"#1D4ED8",boxShadow:"none"}}}>{busy?"در حال ارسال…":"ارسال پاسخ"}</Button>
    </Box>
   </Box>
  </Card>
  <Snackbar open={!!notice} autoHideDuration={3000} onClose={()=>setNotice(null)} anchorOrigin={{vertical:"bottom",horizontal:"left"}}><Alert onClose={()=>setNotice(null)} severity={notice?.severity||"success"} variant="filled">{notice?.text}</Alert></Snackbar>
 </Stack>;
}

function MessageSquareIconFallback() {
 return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/></svg>;
}
