"use client";

import {
  ArrowRight,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Send,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Box, Button, CircularProgress, Paper, Skeleton, Stack, TextField, Typography } from "@mui/material";

type Account = { id: string; igUsername: string; profilePictureUrl: string | null };
type Media = {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaProductType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
};
type Comment = {
  id: string;
  igCommentId: string;
  text: string;
  username: string;
  profilePictureUrl: string | null;
  createdAt: string;
};
type PostGroup = { media: Media; comments: Comment[] };
type ApiResponse = { success: boolean; posts?: PostGroup[]; message?: string };

export default function UnansweredCommentsPost({
  account,
  mediaId,
}: {
  account: Account;
  mediaId: string;
}) {
  const router = useRouter();
  const [post, setPost] = useState<PostGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function loadPost() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/instagram/unanswered-comments?instagramAccountId=${encodeURIComponent(account.id)}&mediaId=${encodeURIComponent(mediaId)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "دریافت کامنت‌ها ناموفق بود.");
      }

      setPost(data.posts?.[0] ?? null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "دریافت کامنت‌ها ناموفق بود.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPost();
  }, [account.id, mediaId]);

  async function reply(commentId: string) {
    const message = drafts[commentId]?.trim();
    if (!message) return;

    setReplyingId(commentId);
    setError("");

    try {
      const response = await fetch("/api/instagram/comments/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: account.id,
          commentId,
          message,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "ارسال پاسخ ناموفق بود.");
      }

      setPost((current) => {
        if (!current) return current;

        const comments = current.comments.filter(
          (comment) => comment.id !== commentId,
        );

        return comments.length ? { ...current, comments } : null;
      });

      setDrafts((current) => {
        const next = { ...current };
        delete next[commentId];
        return next;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ارسال پاسخ ناموفق بود.",
      );
    } finally {
      setReplyingId(null);
    }
  }

  const mediaSrc =
    post?.media.mediaType === "VIDEO"
      ? post.media.thumbnailUrl ?? post.media.mediaUrl
      : post?.media.mediaUrl ?? post?.media.thumbnailUrl;

  return (
    <Box dir="rtl" sx={{ position:"fixed", inset:0, overflow:"hidden", bgcolor:"#000", lg:undefined }}>
      {loading ? <PostDetailSkeleton /> : error ? (
        <Box sx={{ width:"100%",height:"100%",display:"grid",placeItems:"center",px:2 }}>
          <Box sx={{ width:"100%",maxWidth:460,p:2,borderRadius:2,border:"1px solid #FECACA",bgcolor:"#FEF2F2",color:"#B91C1C",fontSize:12 }}>{error}</Box>
        </Box>
      ) : !post ? (
        <Box sx={{ width:"100%",height:"100%",display:"grid",placeItems:"center",px:2 }}>
          <Paper sx={{ width:"100%",maxWidth:460,p:6,textAlign:"center",border:"1px solid #E2E8F0",borderRadius:3 }}>
            <MessageCircle size={24} color="#64748B" strokeWidth={1.5}/>
            <Typography sx={{mt:1.5,fontSize:13,fontWeight:600}}>کامنت بی‌پاسخی باقی نمانده</Typography>
          </Paper>
        </Box>
      ) : (
        <Box sx={{ position:"relative",display:"flex",flexDirection:"column",height:"100%",width:"100%",overflow:"hidden",bgcolor:"#000" }}>
          <Box sx={{ position:"relative",flex:"0 0 40dvh",minHeight:0,bgcolor:"#000" }}>
            <Box sx={{ position:"absolute",inset:0 }}>
              {mediaSrc ? post.media.mediaType === "VIDEO" ? (
                <Box sx={{position:"relative",width:"100%",height:"100%"}}>
                  <Box component="img" src={mediaSrc} alt={post.media.caption ?? ""} sx={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                  <Box sx={{position:"absolute",inset:0,display:"grid",placeItems:"center"}}><Box sx={{width:48,height:48,borderRadius:"50%",display:"grid",placeItems:"center",bgcolor:"rgba(255,255,255,.9)",color:"#0F172A",boxShadow:"0 8px 24px rgba(0,0,0,.25)"}}><Video size={19}/></Box></Box>
                </Box>
              ) : <Box component="img" src={mediaSrc} alt={post.media.caption ?? ""} sx={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
              : <Box sx={{width:"100%",height:"100%",display:"grid",placeItems:"center",color:"#94A3B8"}}><ImageIcon size={32}/></Box>}
              <Box sx={{position:"absolute",inset:"auto 0 0",height:208,background:"linear-gradient(to top,rgba(0,0,0,.85),rgba(0,0,0,.35),transparent)"}}/>
              <Button type="button" onClick={() => router.back()} startIcon={<ArrowRight size={15}/>} sx={{position:"absolute",right:16,top:16,zIndex:2,minHeight:36,borderRadius:99,px:1.75,bgcolor:"rgba(0,0,0,.45)",color:"#FFF",fontSize:10,fontWeight:600,backdropFilter:"blur(10px)","&:hover":{bgcolor:"rgba(0,0,0,.62)"}}}>بازگشت</Button>
              <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2} sx={{position:"absolute",left:{xs:16,sm:24},right:{xs:16,sm:24},bottom:{xs:28,sm:36},zIndex:2,color:"#FFF"}}>
                <Typography sx={{minWidth:0,flex:1,fontSize:13,fontWeight:500,lineHeight:1.9,display:"-webkit-box",WebkitBoxOrient:"vertical",WebkitLineClamp:2,overflow:"hidden",whiteSpace:"pre-wrap"}}>{post.media.caption || ""}</Typography>
                <Stack alignItems="flex-end" spacing={.8} sx={{width:120,flexShrink:0}}>
                  <Stack direction="row" spacing={.6} alignItems="center"><MessageCircle size={13}/><Typography sx={{fontSize:10,fontWeight:500}}>{post.comments.length.toLocaleString("fa-IR")} بی‌پاسخ</Typography></Stack>
                  {post.media.timestamp ? <Typography sx={{fontSize:10,color:"rgba(255,255,255,.75)"}}>{new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(post.media.timestamp))}</Typography> : null}
                </Stack>
              </Stack>
            </Box>
          </Box>

          <Box sx={{position:"relative",zIndex:2,mt:-2.5,minHeight:0,flex:1,overflowY:"auto",borderRadius:"24px 24px 0 0",bgcolor:"#F8FAFC",px:{xs:2,sm:3},pt:2.5,pb:4,boxShadow:"0 -12px 30px rgba(0,0,0,.08)"}}>
            <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2}>
              <Box><Typography sx={{fontSize:15,fontWeight:700,color:"#0F172A"}}>کامنت‌های بی‌پاسخ</Typography><Typography sx={{mt:.5,fontSize:11,color:"#64748B"}}>برای هر کامنت، پاسخ را مستقیم ارسال کنید.</Typography></Box>
              <Typography sx={{fontSize:11,fontWeight:700,color:"#64748B"}}>{post.comments.length.toLocaleString("fa-IR")}</Typography>
            </Stack>

            <Stack spacing={1.25} sx={{mt:2}}>
              {post.comments.map((comment) => (
                <Paper key={comment.id} sx={{p:1.5,border:"1px solid #E2E8F0",borderRadius:2,bgcolor:"#FFF",boxShadow:"none"}}>
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    {comment.profilePictureUrl ? <Box component="img" src={comment.profilePictureUrl} alt={comment.username} sx={{width:34,height:34,flexShrink:0,borderRadius:"50%",objectFit:"cover"}}/> : <Box sx={{width:34,height:34,flexShrink:0,borderRadius:"50%",display:"grid",placeItems:"center",bgcolor:"#E2E8F0",color:"#64748B",fontSize:9,fontWeight:700}}>IG</Box>}
                    <Box sx={{minWidth:0,flex:1}}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                        <Typography dir="ltr" noWrap sx={{fontSize:11,fontWeight:700,color:"#0F172A"}}>@{comment.username}</Typography>
                        <Typography sx={{fontSize:9.5,color:"#64748B",flexShrink:0}}>{new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium"}).format(new Date(comment.createdAt))}</Typography>
                      </Stack>
                      <Typography sx={{mt:.6,fontSize:12.5,lineHeight:1.8,color:"#0F172A",whiteSpace:"pre-wrap"}}>{comment.text}</Typography>
                      <Stack direction="row" spacing={1} sx={{mt:1,p:.75,border:"1px solid #E2E8F0",borderRadius:1.75,bgcolor:"#F8FAFC"}}>
                        <TextField fullWidth size="small" value={drafts[comment.id] ?? ""} onChange={(event) => setDrafts(current => ({...current,[comment.id]:event.target.value}))}
                          onKeyDown={(event) => { if(event.key==="Enter" && !event.shiftKey && !event.nativeEvent.isComposing){event.preventDefault();void reply(comment.id);}}}
                          slotProps={{ htmlInput: { maxLength: 1000 } }} placeholder="پاسخ به کامنت..." sx={{"& .MuiOutlinedInput-root":{border:0,bgcolor:"transparent","& fieldset":{border:0}},"& input":{fontSize:11.5}}}/>
                        <Button type="button" onClick={() => void reply(comment.id)} disabled={replyingId===comment.id || !(drafts[comment.id] ?? "").trim()} sx={{minWidth:70,height:36,alignSelf:"center",borderRadius:1.5,bgcolor:"#2563EB",color:"#FFF",fontSize:10.5,fontWeight:600,"&:hover":{bgcolor:"#1D4ED8"}}}>
                          {replyingId===comment.id ? <CircularProgress size={14} sx={{color:"#FFF"}}/> : <><Send size={13}/><Box component="span" sx={{mr:.5}}>ارسال</Box></>}
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        </Box>
      )}
    </Box>
  );
}
function PostDetailSkeleton() {
  return (
    <Box sx={{width:"100%",height:"100%",overflow:"hidden",bgcolor:"#000"}}>
      <Box sx={{height:"40dvh",position:"relative",bgcolor:"#0F172A"}}>
        <Skeleton variant="rectangular" animation="wave" sx={{position:"absolute",inset:0,bgcolor:"rgba(255,255,255,.06)",transform:"none"}}/>
        <Skeleton variant="rounded" width={80} height={34} sx={{position:"absolute",right:16,top:16,bgcolor:"rgba(255,255,255,.1)"}}/>
        <Stack spacing={1} sx={{position:"absolute",left:16,right:16,bottom:28}}><Skeleton width="35%" height={18} sx={{bgcolor:"rgba(255,255,255,.1)"}}/><Skeleton width="70%" height={12} sx={{bgcolor:"rgba(255,255,255,.1)"}}/><Skeleton width="45%" height={12} sx={{bgcolor:"rgba(255,255,255,.1)"}}/></Stack>
      </Box>
      <Box sx={{mt:-2.5,position:"relative",height:"calc(60dvh + 2.5rem)",borderRadius:"24px 24px 0 0",bgcolor:"#F8FAFC",px:2,pt:2.5}}>
        <Stack direction="row" justifyContent="space-between"><Box><Skeleton width={150} height={20}/><Skeleton width={230} height={14} sx={{mt:.5}}/></Box><Skeleton width={28} height={14}/></Stack>
        <Stack spacing={1.25} sx={{mt:2}}>{Array.from({length:5}).map((_,i)=><Paper key={i} sx={{p:1.5,border:"1px solid #E2E8F0",borderRadius:2,boxShadow:"none"}}><Stack direction="row" spacing={1.25}><Skeleton variant="circular" width={34} height={34}/><Box sx={{flex:1}}><Stack direction="row" justifyContent="space-between"><Skeleton width={80} height={12}/><Skeleton width={55} height={10}/></Stack><Skeleton width="100%" height={12} sx={{mt:1}}/><Skeleton width="65%" height={12}/><Skeleton width="100%" height={38} sx={{mt:1,borderRadius:1.5}}/></Box></Stack></Paper>)}</Stack>
      </Box>
    </Box>
  );
}