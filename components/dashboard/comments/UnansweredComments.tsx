"use client";

import { Image as ImageIcon, MessageCircle, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
type MediaFilter = "ALL" | "POST" | "REEL";

export default function UnansweredComments({
  account,
}: {
  account: Account;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<MediaFilter>("ALL");

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/instagram/unanswered-comments?instagramAccountId=${encodeURIComponent(account.id)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.message ?? "دریافت کامنت‌ها ناموفق بود.");
        }

        if (!cancelled) setPosts(data.posts ?? []);
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "دریافت کامنت‌ها ناموفق بود.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, [account.id]);

  const filteredPosts = useMemo(() => {
    if (filter === "ALL") return posts;

    return posts.filter((post) =>
      filter === "REEL"
        ? post.media.mediaProductType === "REELS"
        : post.media.mediaProductType !== "REELS",
    );
  }, [filter, posts]);

  const totalComments = useMemo(
    () => filteredPosts.reduce((sum, post) => sum + post.comments.length, 0),
    [filteredPosts],
  );

  if (error) {
    return (
      <Box dir="rtl" sx={{ width: "100%" }}>
        <Box sx={{ p: 1.75, borderRadius: 2, border: "1px solid #FECACA", bgcolor: "#FEF2F2", color: "#B91C1C", fontSize: 12 }}>
          {error}
        </Box>
      </Box>
    );
  }

  return (
    <Box dir="rtl" sx={{ width: "100%" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "flex-end" }} justifyContent="space-between">
        <Box>
          <Typography component="h1" sx={{ fontSize: { xs: 20, sm: 22 }, fontWeight: 700, color: "#0F172A" }}>کامنت‌ها</Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
            <Typography dir="ltr" sx={{ fontSize: 11, color: "#64748B" }}>@{account.igUsername}</Typography>
            <Typography sx={{ color: "#CBD5E1" }}>·</Typography>
            <Typography sx={{ fontSize: 11, color: "#64748B" }}>{totalComments.toLocaleString("fa-IR")} بی‌پاسخ</Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.75} role="tablist" aria-label="فیلتر محتوا">
          {([["ALL","همه"],["POST","پست"],["REEL","ریل"]] as const).map(([value,label]) => (
            <Button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}
              variant={filter === value ? "contained" : "outlined"}
              sx={{ minWidth:72,height:36,borderRadius:99,px:2,fontSize:11,fontWeight:600,boxShadow:"none",
                ...(filter === value ? { bgcolor:"#0F172A",color:"#FFF","&:hover":{bgcolor:"#1E293B"} } : { borderColor:"#E2E8F0",color:"#64748B",bgcolor:"#FFF","&:hover":{borderColor:"#94A3B8",bgcolor:"#F8FAFC"} }) }}>
              {label}
            </Button>
          ))}
        </Stack>
      </Stack>

      <Box sx={{ mt: 3 }}>
        {loading ? (
          <Grid container spacing={1.5}>
            {Array.from({ length: 10 }).map((_, index) => (
              <Grid key={index} size={{ xs:6, sm:4, lg:3, xl:2.4 }}>
                <Card sx={{ overflow:"hidden",border:"1px solid #E2E8F0",borderRadius:2.5 }}>
                  <Skeleton variant="rectangular" animation="wave" sx={{ aspectRatio:"1 / 1",transform:"none" }} />
                  <CardContent sx={{ p:1.5 }}><Skeleton width="100%" height={14}/><Skeleton width="65%" height={14} sx={{mt:.5}}/><Stack direction="row" justifyContent="space-between" sx={{mt:1}}><Skeleton variant="circular" width={28} height={28}/><Skeleton width={55} height={12}/></Stack></CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : filteredPosts.length === 0 ? (
          <EmptyState title={filter === "ALL" ? "کامنت بی‌پاسخی وجود ندارد" : filter === "POST" ? "پست بدون کامنت بی‌پاسخ وجود ندارد" : "ریل بدون کامنت بی‌پاسخ وجود ندارد"} />
        ) : (
          <Grid container spacing={1.5}>
            {filteredPosts.map((post) => (
              <Grid key={post.media.id} size={{ xs:6, sm:4, lg:3, xl:2.4 }}>
                <PostTile post={post} onClick={() => router.push("/dashboard/comments/" + encodeURIComponent(post.media.id))} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}

function PostTile({ post, onClick }: { post: PostGroup; onClick: () => void }) {
  const router = useRouter();
  const mediaSrc = post.media.mediaType === "VIDEO" ? post.media.thumbnailUrl ?? post.media.mediaUrl : post.media.mediaUrl ?? post.media.thumbnailUrl;
  const isReel = post.media.mediaProductType === "REELS";
  const latestCommenters = post.comments.slice().sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0,3);
  const publishedDate = post.media.timestamp ? new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(post.media.timestamp)) : null;

  return (
    <Card component="button" type="button" onClick={onClick}
      onMouseEnter={() => router.prefetch("/dashboard/comments/" + encodeURIComponent(post.media.id))}
      onPointerDown={() => router.prefetch("/dashboard/comments/" + encodeURIComponent(post.media.id))}
      sx={{ width:"100%",display:"block",p:0,overflow:"hidden",textAlign:"right",cursor:"pointer",border:"1px solid #E2E8F0",borderRadius:2.5,bgcolor:"#FFF",boxShadow:"0 1px 2px rgba(15,23,42,.04)",transition:"transform .2s ease, box-shadow .2s ease","&:hover":{transform:"translateY(-2px)",boxShadow:"0 12px 30px rgba(15,23,42,.08)"} }}
    >
      <Box sx={{position:"relative",aspectRatio:"1 / 1",overflow:"hidden",bgcolor:"#F1F5F9"}}>
        {mediaSrc ? <Box component="img" src={mediaSrc} alt={post.media.caption ?? ""} sx={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/> : <Box sx={{width:"100%",height:"100%",display:"grid",placeItems:"center",color:"#64748B"}}><ImageIcon size={26} strokeWidth={1.5}/></Box>}
        <Box sx={{position:"absolute",inset:"auto 0 0",height:88,background:"linear-gradient(to top, rgba(0,0,0,.58), transparent)"}}/>
        <Chip label={isReel ? "ریل" : "پست"} icon={post.media.mediaType === "VIDEO" ? <Video size={11}/> : undefined} size="small" sx={{position:"absolute",top:10,right:10,height:27,bgcolor:"rgba(255,255,255,.95)",fontSize:10,fontWeight:700}}/>
        <Box sx={{position:"absolute",left:10,bottom:10,display:"flex",alignItems:"center",gap:.6,px:1,height:30,borderRadius:99,bgcolor:"#FFF",color:"#0F172A",boxShadow:"0 4px 12px rgba(0,0,0,.16)"}}><MessageCircle size={13}/><Typography sx={{fontSize:11,fontWeight:700}}>{post.comments.length.toLocaleString("fa-IR")}</Typography></Box>
      </Box>
      <CardContent sx={{p:1.5,"&:last-child":{pb:1.5}}}>
        <Typography sx={{minHeight:40,fontSize:11,lineHeight:1.8,color:"#0F172A",display:"-webkit-box",WebkitBoxOrient:"vertical",WebkitLineClamp:2,overflow:"hidden"}}>{post.media.caption?.trim() || "بدون کپشن"}</Typography>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{mt:1.25}}>
          <Stack direction="row" spacing={-0.7} dir="ltr">
            {latestCommenters.map((commenter) => commenter.profilePictureUrl ? <Box key={commenter.id} component="img" src={commenter.profilePictureUrl} alt="" sx={{width:28,height:28,borderRadius:"50%",objectFit:"cover",border:"2px solid #FFF"}}/> : <Box key={commenter.id} sx={{width:28,height:28,borderRadius:"50%",display:"grid",placeItems:"center",bgcolor:"#E2E8F0",color:"#64748B",fontSize:9,fontWeight:600,border:"2px solid #FFF"}}>{commenter.username.slice(0,1).toUpperCase()}</Box>)}
          </Stack>
          {publishedDate ? <Typography component="time" sx={{fontSize:9.5,fontWeight:500,color:"#64748B"}}>{publishedDate}</Typography> : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title }: { title: string }) {
  return <Stack alignItems="center" justifyContent="center" sx={{py:12,color:"#64748B"}}><MessageCircle size={23} strokeWidth={1.5}/><Typography sx={{mt:1.5,fontSize:13,fontWeight:600,color:"#0F172A"}}>{title}</Typography></Stack>;
}
