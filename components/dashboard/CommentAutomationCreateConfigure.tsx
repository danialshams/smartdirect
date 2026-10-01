"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check , MessageCircle, Plus, Send, UserRoundCheck, X } from "lucide-react";
import { Box, Button, Card, CardContent, Checkbox, CircularProgress, Divider, IconButton, Paper, Stack, TextField, Typography } from "@mui/material";

type Account = { id:string; igUsername:string; igUserId:string; isConnected:boolean };
type MediaItem = { id:string; caption?:string; media_product_type?:string; media_url?:string|null; thumbnail_url?:string|null };
type Automation = { id:string; mediaId:string|null; triggerType:string };

const cardSx={border:"1px solid #E2E8F0",borderRadius:2.5,boxShadow:"0 1px 3px rgba(15,23,42,.035)",bgcolor:"#FFF"};
const contentSx={p:{xs:2,sm:2.25},"&:last-child":{pb:{xs:2,sm:2.25}}};
const fieldSx={"& .MuiOutlinedInput-root":{borderRadius:1.75,bgcolor:"#FFF",fontSize:12.5},"& .MuiInputBase-input":{fontFamily:'"Vazirmatn",Arial,sans-serif',lineHeight:1.8},"& .MuiInputLabel-root":{fontFamily:'"Vazirmatn",Arial,sans-serif',fontSize:12}};
const outlineButtonSx={minWidth:86,height:40,borderColor:"#E2E8F0",color:"#0F172A",fontSize:11.5,fontWeight:600,borderRadius:1.75,whiteSpace:"nowrap","&:hover":{borderColor:"#94A3B8",bgcolor:"#F8FAFC"}};

function mediaLabel(item:MediaItem){return item.media_product_type==="REELS"?"ریلز":"پست"}
function SectionTitle({icon,title,description}:{icon:ReactNode;title:string;description:string}){return <Stack direction="row" spacing={1.25} alignItems="flex-start"><Box sx={{width:36,height:36,borderRadius:1.75,display:"grid",placeItems:"center",bgcolor:"#EFF6FF",color:"#2563EB",flexShrink:0}}>{icon}</Box><Box><Typography sx={{fontSize:14,fontWeight:700,color:"#0F172A"}}>{title}</Typography><Typography sx={{mt:.5,fontSize:11.5,lineHeight:1.8,color:"#64748B"}}>{description}</Typography></Box></Stack>}

export default function CommentAutomationCreateConfigure(){
  const router=useRouter(); const params=useSearchParams(); const mediaId=params.get("mediaId");
  const [account,setAccount]=useState<Account|null>(null); const [media,setMedia]=useState<MediaItem|null>(null);
  const [keywords,setKeywords]=useState<string[]>([]); const [keywordInput,setKeywordInput]=useState("");
  const [commentReply,setCommentReply]=useState(""); const [sendDm,setSendDm]=useState(false); const [dmReply,setDmReply]=useState("");
  const [requireFollow,setRequireFollow]=useState(false); const [followGateText,setFollowGateText]=useState("برای دریافت این محتوا ابتدا پیج ما را فالو کنید.");
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState("");

  useEffect(()=>{
    let cancelled=false;
    async function load(){
      if(!mediaId){setError("محتوا انتخاب نشده است.");setLoading(false);return;}
      try{
        setLoading(true);setError("");
        const accountsResponse=await fetch("/api/instagram/accounts",{cache:"no-store",credentials:"include"});
        const accountsResult=await accountsResponse.json();
        if(!accountsResponse.ok||!accountsResult.success)throw new Error(accountsResult.error||"دریافت پیج اینستاگرام ناموفق بود.");
        const active=(Array.isArray(accountsResult.accounts)?accountsResult.accounts:[]).find((item:Account)=>item.isConnected)??null;
        if(!active)throw new Error("پیج اینستاگرام متصل نیست.");
        const [mediaResponse,automationsResponse]=await Promise.all([
          fetch("/api/instagram/media?instagramAccountId="+encodeURIComponent(active.id),{cache:"no-store",credentials:"include"}),
          fetch("/api/automations?instagramAccountId="+encodeURIComponent(active.id),{cache:"no-store",credentials:"include"})
        ]);
        const mediaResult=await mediaResponse.json();const automationsResult=await automationsResponse.json();
        if(!mediaResponse.ok||!mediaResult.success)throw new Error(mediaResult.error||"دریافت محتوا ناموفق بود.");
        if(!automationsResponse.ok||!automationsResult.success)throw new Error(automationsResult.error||"دریافت اتوماسیون‌ها ناموفق بود.");
        const selected=(Array.isArray(mediaResult.data)?mediaResult.data:[]).find((item:MediaItem)=>item.id===mediaId);
        if(!selected)throw new Error("این محتوا دیگر در پیج پیدا نشد.");
        const existing=(Array.isArray(automationsResult.data)?automationsResult.data:[]).find((item:Automation)=>item.triggerType==="COMMENT_KEYWORD"&&item.mediaId===mediaId);
        if(existing){router.replace("/dashboard/comment-automation/"+existing.id);return;}
        if(!cancelled){setAccount(active);setMedia(selected);}
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"دریافت اطلاعات ناموفق بود.");}
      finally{if(!cancelled)setLoading(false);}
    }
    void load();return()=>{cancelled=true};
  },[mediaId,router]);

  function addKeyword(){const value=keywordInput.trim();if(!value)return;if(!keywords.some(x=>x.toLowerCase()===value.toLowerCase()))setKeywords(x=>[...x,value]);setKeywordInput("");}

  async function save(){
    if(!account||!media||saving)return;
    setError("");
    if(!keywords.length)return setError("حداقل یک کلمه کلیدی وارد کنید.");
    if(!commentReply.trim()&&!sendDm&&!requireFollow)return setError("حداقل یکی از پاسخ کامنت، پاسخ دایرکت یا اجبار به فالو را فعال کنید.");
    if(sendDm&&!dmReply.trim())return setError("متن پاسخ دایرکت را وارد کنید.");
    if(requireFollow&&!followGateText.trim())return setError("متن درخواست فالو را وارد کنید.");
    try{
      setSaving(true);
      const response=await fetch("/api/automations",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({instagramAccountId:account.id,triggerType:"COMMENT_KEYWORD",mediaId:media.id,keyword:keywords.join(", "),commentReplyText:commentReply.trim()||null,sendDm:sendDm&&Boolean(dmReply.trim()),replyText:sendDm?dmReply.trim()||null:null,requireFollow,followGateText:requireFollow?followGateText.trim():null,isActive:true})});
      const result=await response.json();
      if(response.status===409&&result.data?.id){router.replace("/dashboard/comment-automation/"+result.data.id);return;}
      if(!response.ok||!result.success)throw new Error(result.error||result.message||"ساخت پاسخ خودکار ناموفق بود.");
      router.push("/dashboard/comment-automation");
    }catch(e){setError(e instanceof Error?e.message:"ساخت پاسخ خودکار ناموفق بود.");}
    finally{setSaving(false);}
  }

  if(loading)return <Box dir="rtl" sx={{width:"100%",maxWidth:1200,mx:"auto"}}><Stack spacing={1} sx={{mb:2.5}}><Box sx={{width:160,height:30,borderRadius:1.5,bgcolor:"#E2E8F0"}}/><Box sx={{width:320,height:16,borderRadius:1.5,bgcolor:"#E2E8F0"}}/></Stack><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",lg:"minmax(0,.9fr) minmax(0,1.1fr)"},gap:2.5}}><Paper sx={{height:520,borderRadius:3,bgcolor:"#E2E8F0",boxShadow:"none"}}/><Stack spacing={1.5}><Paper sx={{height:120,borderRadius:2.5,bgcolor:"#E2E8F0",boxShadow:"none"}}/><Paper sx={{height:170,borderRadius:2.5,bgcolor:"#E2E8F0",boxShadow:"none"}}/><Paper sx={{height:170,borderRadius:2.5,bgcolor:"#E2E8F0",boxShadow:"none"}}/></Stack></Box></Box>;
  if(!media||!account)return <Box dir="rtl" sx={{maxWidth:560,mx:"auto",p:2.5,border:"1px solid #FECACA",bgcolor:"#FEF2F2",color:"#B91C1C",borderRadius:3,fontSize:13}}>{error||"محتوا پیدا نشد."}</Box>;

  const image=media.thumbnail_url||media.media_url;
  return <Box dir="rtl" sx={{width:"100%",maxWidth:1200,mx:"auto",pb:5}}>
    <Stack direction="row" justifyContent="flex-start" sx={{mb:2}}><Button variant="text" startIcon={<ArrowRight size={17}/>} onClick={()=>router.back()} sx={{color:"#64748B",fontSize:12,fontWeight:600,minHeight:36,"&:hover":{bgcolor:"#F8FAFC"}}}>بازگشت</Button></Stack>
    <Box sx={{mb:2.5}}><Typography component="h1" sx={{fontSize:{xs:22,sm:28},fontWeight:800,color:"#0F172A"}}>پاسخ جدید</Typography><Typography sx={{mt:.75,fontSize:12.5,color:"#64748B"}}>برای این پست، پاسخ خودکار کامنت را تنظیم کنید.</Typography></Box>
    {error&&<Paper sx={{mb:2.5,p:1.5,border:"1px solid #FECACA",bgcolor:"#FEF2F2",color:"#B91C1C",borderRadius:2,boxShadow:"none",fontSize:12}}>{error}</Paper>}
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",lg:"minmax(0,.9fr) minmax(0,1.1fr)"},gap:2.5,alignItems:"start"}}>
      <Card sx={{overflow:"hidden",border:"1px solid #E2E8F0",borderRadius:3,boxShadow:"0 1px 3px rgba(15,23,42,.04)",position:{lg:"sticky"},top:{lg:20}}}><CardContent sx={{p:{xs:2,sm:2.5}}}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{mb:2}}><Box sx={{width:40,height:40,borderRadius:2,display:"grid",placeItems:"center",bgcolor:"#EFF6FF",color:"#2563EB"}}><MessageCircle size={19}/></Box><Box><Typography sx={{fontSize:10.5,color:"#64748B"}}>{mediaLabel(media)}</Typography><Typography dir="ltr" noWrap sx={{fontSize:12,fontWeight:700,color:"#0F172A"}}>@{account.igUsername}</Typography></Box></Stack>
        <Box sx={{overflow:"hidden",borderRadius:2.5,bgcolor:"#F1F5F9",aspectRatio:"1/1"}}>{image?<Box component="img" src={image} alt={media.caption||mediaLabel(media)} sx={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>:<Stack sx={{height:"100%"}} alignItems="center" justifyContent="center"><Typography sx={{fontSize:12,color:"#64748B"}}>پیش‌نمایش در دسترس نیست</Typography></Stack>}</Box>
        <Paper variant="outlined" sx={{mt:2,p:1.5,borderColor:"#E2E8F0",bgcolor:"#F8FAFC",borderRadius:2,boxShadow:"none"}}><Typography sx={{fontSize:10.5,color:"#64748B"}}>محتوای انتخاب‌شده</Typography><Typography sx={{mt:.5,fontSize:12.5,fontWeight:600}}>{mediaLabel(media)}</Typography></Paper>
      </CardContent></Card>
      <Stack spacing={1.5}>
        <Card sx={cardSx}><CardContent sx={contentSx}><SectionTitle icon={<MessageCircle size={17}/>} title="کلمات کلیدی" description="هر کلمه را جداگانه اضافه کنید."/><Stack direction="row" spacing={1} sx={{mt:1.5}}><TextField fullWidth size="small" value={keywordInput} onChange={e=>setKeywordInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addKeyword()}}} placeholder="مثلاً قیمت" sx={fieldSx}/><Button variant="outlined" onClick={addKeyword} startIcon={<Plus size={16}/>} sx={outlineButtonSx}>افزودن</Button></Stack>{keywords.length>0&&<Stack direction="row" flexWrap="wrap" gap={1} sx={{mt:1.5}}>{keywords.map(keyword=><Paper key={keyword} sx={{display:"flex",alignItems:"center",gap:.75,pl:.75,pr:1.25,py:.5,border:"1px solid #E2E8F0",borderRadius:99,bgcolor:"#FFF",boxShadow:"none"}}><Typography sx={{fontSize:11.5}}>{keyword}</Typography><IconButton size="small" onClick={()=>setKeywords(x=>x.filter(i=>i!==keyword))} sx={{width:24,height:24,p:0,border:"1px solid #DC2626",color:"#DC2626",bgcolor:"transparent","&:hover":{bgcolor:"transparent",borderColor:"#B91C1C"}}}><X size={13}/></IconButton></Paper>)}</Stack>}</CardContent></Card>
        <Card sx={cardSx}><CardContent sx={contentSx}><SectionTitle icon={<MessageCircle size={17}/>} title="پاسخ کامنت" description="پاسخ عمومی که زیر کامنت کاربر ارسال می‌شود."/><TextField fullWidth multiline minRows={4} value={commentReply} onChange={e=>setCommentReply(e.target.value)} placeholder="متن پاسخ کامنت..." sx={{...fieldSx,mt:1.5}}/></CardContent></Card>
        <Card sx={cardSx}><CardContent sx={contentSx}><Stack direction="row" spacing={1.25} alignItems="flex-start"><Box sx={{width:36,height:36,borderRadius:1.75,display:"grid",placeItems:"center",bgcolor:"#EFF6FF",color:"#2563EB",flexShrink:0}}><Send size={17}/></Box><Box sx={{minWidth:0,flex:1}}><Typography sx={{fontSize:14,fontWeight:700}}>پاسخ دایرکت</Typography><Typography sx={{mt:.5,fontSize:11.5,lineHeight:1.8,color:"#64748B"}}>بعد از کامنت، یک پیام خصوصی متنی برای کاربر ارسال شود.</Typography></Box><Checkbox checked={sendDm} onChange={e=>setSendDm(e.target.checked)} sx={{p:.25,color:"#94A3B8","&.Mui-checked":{color:"#2563EB"}}}/></Stack><TextField fullWidth multiline minRows={4} value={dmReply} onChange={e=>setDmReply(e.target.value)} disabled={!sendDm} placeholder="متن پاسخ دایرکت..." sx={{...fieldSx,mt:1.5}}/></CardContent></Card>
        <Card sx={cardSx}><CardContent sx={contentSx}><Stack direction="row" spacing={1.25} alignItems="flex-start"><Box sx={{width:36,height:36,borderRadius:1.75,display:"grid",placeItems:"center",bgcolor:"#F0FDF4",color:"#16A34A",flexShrink:0}}><UserRoundCheck size={17}/></Box><Box sx={{minWidth:0,flex:1}}><Typography sx={{fontSize:14,fontWeight:700}}>اجبار به فالو</Typography><Typography sx={{mt:.5,fontSize:11.5,lineHeight:1.8,color:"#64748B"}}>قبل از ارسال محتوای اصلی، ابتدا پیام درخواست فالو برای کاربر ارسال شود.</Typography></Box><Checkbox checked={requireFollow} onChange={e=>setRequireFollow(e.target.checked)} sx={{p:.25,color:"#94A3B8","&.Mui-checked":{color:"#2563EB"}}}/></Stack>{requireFollow&&<><Divider sx={{my:1.75}}/><TextField fullWidth multiline minRows={3} label="متن درخواست فالو" value={followGateText} onChange={e=>setFollowGateText(e.target.value)} placeholder="برای دریافت این محتوا ابتدا پیج ما را فالو کنید." sx={fieldSx}/></>}</CardContent></Card>
        <Button variant="contained" onClick={save} disabled={saving} startIcon={saving?<CircularProgress size={16} sx={{color:"#FFF"}}/>:<Check size={17}/>} sx={{minHeight:46,borderRadius:2,fontSize:12.5,fontWeight:700,bgcolor:"#2563EB","&:hover":{bgcolor:"#1D4ED8"}}}>{saving?"در حال ساخت...":"ساخت پاسخ خودکار"}</Button>
      </Stack>
    </Box>
  </Box>;
}
