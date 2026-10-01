"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, MessageCircle, Plus, Send, UserRoundCheck, X } from "lucide-react";
import { Box, Button, Card, CardContent, Checkbox, CircularProgress, Divider, IconButton, Paper, Stack, TextField, Typography } from "@mui/material";

type AutomationMessage = { id:string; messageType:string; text:string|null; order:number };
type Automation = { id:string; instagramAccountId:string; triggerType:string; mediaId:string|null; keyword:string|null; commentReplyText:string|null; replyText:string|null; sendDm:boolean; requireFollow:boolean; followGateText:string|null; isActive:boolean; messages?: AutomationMessage[]; instagramAccount?: { id:string; igUserId:string; igUsername:string; isConnected:boolean } };
type MediaPreview = { mediaUrl:string|null; thumbnailUrl:string|null; mediaType:"IMAGE"|"VIDEO"|"UNKNOWN" };

function getExistingDmText(item:Automation){ if(item.replyText?.trim()) return item.replyText; return [...(item.messages??[])].sort((a,b)=>a.order-b.order).find(m=>m.messageType==="TEXT"&&m.text?.trim())?.text??""; }

export default function CommentAutomationEditor({ id }: { id: string }) {
  const router = useRouter();
  const [automation,setAutomation]=useState<Automation|null>(null); const [preview,setPreview]=useState<MediaPreview|null>(null);
  const [keywords,setKeywords]=useState<string[]>([]); const [keywordInput,setKeywordInput]=useState(""); const [commentReply,setCommentReply]=useState(""); const [dmReply,setDmReply]=useState("");
  const [sendDm,setSendDm]=useState(false); const [requireFollow,setRequireFollow]=useState(false); const [followGateText,setFollowGateText]=useState("");
  const [loading,setLoading]=useState(true); const [mediaLoading,setMediaLoading]=useState(true); const [saving,setSaving]=useState(false); const [saved,setSaved]=useState(false); const [error,setError]=useState("");

  useEffect(()=>{ let cancelled=false; async function load(){ try{
    setLoading(true);setError("");
    const response=await fetch(`/api/automations/${encodeURIComponent(id)}`,{cache:"no-store",credentials:"include"}); const result=await response.json();
    if(!response.ok||!result.success)throw new Error(result.error||result.message||"دریافت اتوماسیون ناموفق بود.");
    const item=result.data as Automation; if(item.triggerType!=="COMMENT_KEYWORD")throw new Error("این صفحه فقط برای پاسخ خودکار کامنت است.");
    const existingDmText=getExistingDmText(item);
    if(!cancelled){ setAutomation(item); setKeywords((item.keyword||"").split(/[,،;؛\n]+/).map(v=>v.trim()).filter(Boolean).filter((value,index,list)=>list.findIndex(item=>item.toLowerCase()===value.toLowerCase())===index)); setCommentReply(item.commentReplyText||""); setDmReply(existingDmText); setSendDm(Boolean(item.sendDm||existingDmText.trim())); setRequireFollow(Boolean(item.requireFollow)); setFollowGateText(item.followGateText?.trim()||"برای دریافت این محتوا ابتدا پیج ما را فالو کنید."); }
    if(!item.mediaId){if(!cancelled)setMediaLoading(false);return;}
    const mediaResponse=await fetch(`/api/automations/media-preview?instagramAccountId=${encodeURIComponent(item.instagramAccountId)}&mediaId=${encodeURIComponent(item.mediaId)}`,{cache:"no-store",credentials:"include"}); const mediaResult=await mediaResponse.json();
    if(!cancelled&&mediaResponse.ok&&mediaResult.success)setPreview(mediaResult.data as MediaPreview);
  }catch(requestError){if(!cancelled)setError(requestError instanceof Error?requestError.message:"دریافت اتوماسیون ناموفق بود.");}finally{if(!cancelled){setLoading(false);setMediaLoading(false);}} }
  void load(); return()=>{cancelled=true}; },[id]);

  const previewImage=useMemo(()=>preview?.thumbnailUrl||preview?.mediaUrl||null,[preview]);
  async function save(){ if(!automation||saving)return; setError("");setSaved(false); const normalizedKeywords=keywords.join(", ");
    if(!normalizedKeywords)return setError("حداقل یک کلمه کلیدی وارد کنید.");
    if(!commentReply.trim()&&!dmReply.trim()&&!requireFollow)return setError("حداقل یک پاسخ کامنت، پاسخ دایرکت یا شرط فالو را فعال کنید.");
    if(sendDm&&!dmReply.trim())return setError("متن پاسخ دایرکت را وارد کنید."); if(requireFollow&&!followGateText.trim())return setError("متن درخواست فالو را وارد کنید.");
    try{ setSaving(true); const response=await fetch(`/api/automations/${encodeURIComponent(automation.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({keyword:normalizedKeywords,commentReplyText:commentReply.trim()||null,replyText:sendDm?dmReply.trim()||null:null,sendDm:sendDm&&Boolean(dmReply.trim()),requireFollow,followGateText:requireFollow?followGateText.trim():null})}); const result=await response.json();
      if(!response.ok||!result.success)throw new Error(result.error||result.message||"ذخیره تغییرات ناموفق بود."); const savedAutomation=result.data as Automation; setAutomation(savedAutomation); setDmReply(getExistingDmText(savedAutomation)); setSendDm(Boolean(savedAutomation.sendDm||getExistingDmText(savedAutomation).trim())); setRequireFollow(Boolean(savedAutomation.requireFollow)); setFollowGateText(savedAutomation.followGateText?.trim()||"برای دریافت این محتوا ابتدا پیج ما را فالو کنید."); setSaved(true); window.setTimeout(()=>router.push("/dashboard/comment-automation"),650);
    }catch(saveError){setError(saveError instanceof Error?saveError.message:"ذخیره تغییرات ناموفق بود.");}finally{setSaving(false)} }

  if(loading)return <Box dir="rtl" sx={{width:"100%",maxWidth:1200,mx:"auto"}}><Stack spacing={1} sx={{mb:2.5}}><Box sx={{width:220,height:30,borderRadius:1.5,bgcolor:"#E2E8F0"}}/><Box sx={{width:340,height:16,borderRadius:1.5,bgcolor:"#E2E8F0"}}/></Stack><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",lg:"minmax(0,.9fr) minmax(0,1.1fr)"},gap:2.5}}><Paper sx={{height:520,borderRadius:3,bgcolor:"#E2E8F0",boxShadow:"none"}}/><Stack spacing={1.5}><Paper sx={{height:120,borderRadius:2.5,bgcolor:"#E2E8F0",boxShadow:"none"}}/><Paper sx={{height:170,borderRadius:2.5,bgcolor:"#E2E8F0",boxShadow:"none"}}/><Paper sx={{height:170,borderRadius:2.5,bgcolor:"#E2E8F0",boxShadow:"none"}}/></Stack></Box></Box>;
  if(!automation)return <Box dir="rtl" sx={{maxWidth:560,mx:"auto",p:2.5,border:"1px solid #FECACA",bgcolor:"#FEF2F2",color:"#B91C1C",borderRadius:3,fontSize:13}}>{error||"اتوماسیون پیدا نشد."}</Box>;
  const accountName=automation.instagramAccount?.igUsername||"Instagram";
  return <Box dir="rtl" sx={{width:"100%",maxWidth:1200,mx:"auto",pb:5}}>
    <Stack direction="row" justifyContent="flex-start" sx={{mb:2}}><Button variant="text" startIcon={<ArrowRight size={17}/>} onClick={()=>router.back()} sx={{color:"#64748B",fontSize:12,fontWeight:600,minHeight:36,"&:hover":{bgcolor:"#F8FAFC"}}}>بازگشت</Button></Stack>
    <Box sx={{mb:2.5}}><Typography component="h1" sx={{fontSize:{xs:22,sm:28},fontWeight:800,color:"#0F172A"}}>ویرایش پاسخ خودکار کامنت</Typography><Typography sx={{mt:.75,fontSize:12.5,color:"#64748B"}}>تنظیمات این پاسخ خودکار را از همین صفحه مدیریت کنید.</Typography></Box>
    {error&&<Paper sx={{mb:2.5,p:1.5,border:"1px solid #FECACA",bgcolor:"#FEF2F2",color:"#B91C1C",borderRadius:2,boxShadow:"none",fontSize:12}}>{error}</Paper>}
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",lg:"minmax(0,.9fr) minmax(0,1.1fr)"},gap:2.5,alignItems:"start"}}>
      <Card sx={{overflow:"hidden",border:"1px solid #E2E8F0",borderRadius:3,boxShadow:"0 1px 3px rgba(15,23,42,.04)",position:{lg:"sticky"},top:{lg:20}}}><CardContent sx={{p:{xs:2,sm:2.5}}}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{mb:2}}><Box sx={{width:40,height:40,borderRadius:2,display:"grid",placeItems:"center",bgcolor:"#EFF6FF",color:"#2563EB"}}><MessageCircle size={19}/></Box><Box sx={{minWidth:0}}><Typography sx={{fontSize:10.5,color:"#64748B"}}>پست</Typography><Typography dir="ltr" noWrap sx={{fontSize:12,fontWeight:700,color:"#0F172A"}}>@{accountName}</Typography></Box></Stack>
        <Box sx={{overflow:"hidden",borderRadius:2.5,bgcolor:"#F1F5F9",aspectRatio:"1/1"}}>{mediaLoading?<Box sx={{width:"100%",height:"100%",bgcolor:"#E2E8F0",animation:"sdPulse 1.5s infinite"}}/>:previewImage?<Box component="img" src={previewImage} alt="پست اینستاگرام" sx={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>:<Stack sx={{height:"100%"}} alignItems="center" justifyContent="center"><Typography sx={{fontSize:12,color:"#64748B"}}>پیش‌نمایش این پست در دسترس نیست</Typography></Stack>}</Box>
        <Paper variant="outlined" sx={{mt:2,p:1.5,borderColor:"#E2E8F0",bgcolor:"#F8FAFC",borderRadius:2,boxShadow:"none"}}><Typography sx={{fontSize:10.5,color:"#64748B"}}>کلمات کلیدی فعال</Typography><Typography sx={{mt:.5,fontSize:12.5,fontWeight:600,lineHeight:1.9,color:"#0F172A",wordBreak:"break-word"}}>{keywords.length?keywords.join("، "):"بدون کلمه کلیدی"}</Typography></Paper>
      </CardContent></Card>
      <Stack spacing={1.5}>
        <Card sx={cardSx}><CardContent sx={contentSx}><SectionTitle icon={<MessageCircle size={17}/>} title="کلمات کلیدی" description="هر کلمه را جداگانه اضافه کنید."/><Stack direction="row" spacing={1} sx={{mt:1.5}}><TextField fullWidth size="small" value={keywordInput} onChange={e=>setKeywordInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();const v=keywordInput.trim();if(v&&!keywords.some(x=>x.toLowerCase()===v.toLowerCase()))setKeywords(x=>[...x,v]);setKeywordInput("")}}} placeholder="مثلاً قیمت" sx={fieldSx}/><Button variant="outlined" onClick={()=>{const v=keywordInput.trim();if(v&&!keywords.some(x=>x.toLowerCase()===v.toLowerCase()))setKeywords(x=>[...x,v]);setKeywordInput("")}} startIcon={<Plus size={16}/>} sx={outlineButtonSx}>افزودن</Button></Stack>
          {keywords.length>0&&<Stack direction="row" flexWrap="wrap" gap={1} sx={{mt:1.5}}>{keywords.map(keyword=><Paper key={keyword} sx={{display:"flex",alignItems:"center",gap:.75,pl:.75,pr:1.25,py:.5,border:"1px solid #E2E8F0",borderRadius:99,bgcolor:"#FFF",boxShadow:"none"}}><Typography sx={{fontSize:11.5,color:"#0F172A"}}>{keyword}</Typography><IconButton size="small" onClick={()=>setKeywords(current=>current.filter(item=>item!==keyword))} sx={{width:24,height:24,p:0,border:"1px solid #DC2626",color:"#DC2626",bgcolor:"#FFFFFF","&:hover":{bgcolor:"#FFFFFF",borderColor:"#B91C1C",color:"#B91C1C"}}}><X size={13}/></IconButton></Paper>)}</Stack>}
        </CardContent></Card>
        <Card sx={cardSx}><CardContent sx={contentSx}><SectionTitle icon={<MessageCircle size={17}/>} title="پاسخ کامنت" description="پاسخ عمومی که زیر کامنت کاربر ارسال می‌شود."/><TextField fullWidth multiline minRows={4} value={commentReply} onChange={e=>setCommentReply(e.target.value)} placeholder="متن پاسخ کامنت..." sx={{...fieldSx,mt:1.5}}/></CardContent></Card>
        <Card sx={cardSx}><CardContent sx={contentSx}><Stack direction="row" spacing={1.25} alignItems="flex-start"><Box sx={{width:36,height:36,borderRadius:1.75,display:"grid",placeItems:"center",bgcolor:"#EFF6FF",color:"#2563EB",flexShrink:0}}><Send size={17}/></Box><Box sx={{minWidth:0,flex:1}}><Typography sx={{fontSize:14,fontWeight:700,color:"#0F172A"}}>پاسخ دایرکت</Typography><Typography sx={{mt:.5,fontSize:11.5,lineHeight:1.8,color:"#64748B"}}>بعد از کامنت، یک پیام خصوصی متنی برای کاربر ارسال شود.</Typography></Box><Checkbox checked={sendDm} onChange={e=>setSendDm(e.target.checked)} sx={{p:.25,color:"#94A3B8","&.Mui-checked":{color:"#2563EB"}}}/></Stack><TextField fullWidth multiline minRows={4} value={dmReply} onChange={e=>setDmReply(e.target.value)} disabled={!sendDm} placeholder="متن پاسخ دایرکت..." sx={{...fieldSx,mt:1.5}}/></CardContent></Card>
        <Card sx={cardSx}><CardContent sx={contentSx}><Stack direction="row" spacing={1.25} alignItems="flex-start"><Box sx={{width:36,height:36,borderRadius:1.75,display:"grid",placeItems:"center",bgcolor:"#F0FDF4",color:"#16A34A",flexShrink:0}}><UserRoundCheck size={17}/></Box><Box sx={{minWidth:0,flex:1}}><Typography sx={{fontSize:14,fontWeight:700,color:"#0F172A"}}>اجبار به فالو</Typography><Typography sx={{mt:.5,fontSize:11.5,lineHeight:1.8,color:"#64748B"}}>قبل از ارسال محتوای اصلی، ابتدا پیام درخواست فالو برای کاربر ارسال شود.</Typography></Box><Checkbox checked={requireFollow} onChange={e=>setRequireFollow(e.target.checked)} sx={{p:.25,color:"#94A3B8","&.Mui-checked":{color:"#2563EB"}}}/></Stack>{requireFollow&&<><Divider sx={{my:1.75}}/><TextField fullWidth multiline minRows={3} label="متن درخواست فالو" value={followGateText} onChange={e=>setFollowGateText(e.target.value)} placeholder="برای دریافت این محتوا ابتدا پیج ما را فالو کنید." sx={fieldSx}/></>}</CardContent></Card>
        <Button variant="contained" onClick={save} disabled={saving} startIcon={saving?<CircularProgress size={16} sx={{color:"#FFF"}}/>:saved?<Check size={17}/>:null} sx={{minHeight:46,borderRadius:2,fontSize:12.5,fontWeight:700,bgcolor:"#2563EB","&:hover":{bgcolor:"#1D4ED8"}}}>{saving?"در حال ذخیره...":saved?"ذخیره شد":"ذخیره تغییرات"}</Button>
      </Stack>
    </Box>
    <style jsx global>{`@keyframes sdPulse{0%,100%{opacity:.55}50%{opacity:1}}`}</style>
  </Box>;
}

const cardSx={border:"1px solid #E2E8F0",borderRadius:2.5,boxShadow:"0 1px 3px rgba(15,23,42,.035)",bgcolor:"#FFF"};
const contentSx={p:{xs:2,sm:2.25},"&:last-child":{pb:{xs:2,sm:2.25}}};
const fieldSx={"& .MuiOutlinedInput-root":{borderRadius:1.75,bgcolor:"#FFF",fontSize:12.5},"& .MuiInputBase-input":{fontFamily:'"Vazirmatn",Arial,sans-serif',lineHeight:1.8},"& .MuiInputLabel-root":{fontFamily:'"Vazirmatn",Arial,sans-serif',fontSize:12}};
const outlineButtonSx={minWidth:86,height:40,borderColor:"#E2E8F0",color:"#0F172A",fontSize:11.5,fontWeight:600,borderRadius:1.75,whiteSpace:"nowrap","&:hover":{borderColor:"#94A3B8",bgcolor:"#F8FAFC"}};
function SectionTitle({icon,title,description}:{icon:ReactNode;title:string;description:string}){return <Stack direction="row" spacing={1.25} alignItems="flex-start"><Box sx={{width:36,height:36,borderRadius:1.75,display:"grid",placeItems:"center",bgcolor:"#EFF6FF",color:"#2563EB",flexShrink:0}}>{icon}</Box><Box><Typography sx={{fontSize:14,fontWeight:700,color:"#0F172A"}}>{title}</Typography><Typography sx={{mt:.5,fontSize:11.5,lineHeight:1.8,color:"#64748B"}}>{description}</Typography></Box></Stack>}
