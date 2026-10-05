"use client";

import { Image as ImageIcon, Loader2, MessageCircle, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

type Account = { id: string; igUsername: string; profilePictureUrl: string | null };
type Media = { id: string; caption: string | null; mediaType: string | null; mediaProductType: string | null; mediaUrl: string | null; thumbnailUrl: string | null; permalink: string | null; timestamp: string | null };
type Comment = { id: string; igCommentId: string; text: string; username: string; profilePictureUrl: string | null; createdAt: string };
type PostGroup = { media: Media; comments: Comment[] };
type ApiResponse = { success: boolean; posts?: PostGroup[]; message?: string };
type MediaFilter = "ALL" | "POST" | "REEL";

const COLORS = { primary: "#2563EB", primaryDark: "#1D4ED8", text: "#0F172A", secondary: "#64748B", border: "#E2E8F0", background: "#F8FAFC", surface: "#FFFFFF" };

export default function UnansweredComments({ account }: { account: Account }) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<MediaFilter>("ALL");

  useEffect(() => {
    const controller = new AbortController();

    async function loadPosts() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/instagram/unanswered-comments?instagramAccountId=${encodeURIComponent(account.id)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.message ?? "دریافت کامنت‌ها ناموفق بود.");
        }

        setPosts(data.posts ?? []);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "دریافت کامنت‌ها ناموفق بود.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPosts();
    return () => controller.abort();
  }, [account.id]);

  const filteredPosts = useMemo(
    () =>
      filter === "ALL"
        ? posts
        : posts.filter((post) =>
            filter === "REEL"
              ? post.media.mediaProductType === "REELS"
              : post.media.mediaProductType !== "REELS",
          ),
    [filter, posts],
  );

  const totalComments = useMemo(
    () => filteredPosts.reduce((sum, post) => sum + post.comments.length, 0),
    [filteredPosts],
  );

  const totalPosts = filteredPosts.length;
  const reelPosts = posts.filter((post) => post.media.mediaProductType === "REELS").length;
  const regularPosts = posts.filter((post) => post.media.mediaProductType !== "REELS").length;

  return (
    <Box dir="rtl" sx={{ width: "100%", pb: { xs: 4, lg: 6 } }}>
      {error ? (
        <Box
          sx={{
            mb: 2.5,
            p: 1.75,
            borderRadius: 2,
            border: "1px solid #FECACA",
            bgcolor: "#FEF2F2",
            color: "#B91C1C",
            fontSize: 12,
          }}
        >
          {error}
        </Box>
      ) : null}

      <Box
        component="section"
        sx={{
          p: { xs: 2, sm: 2.5, lg: 3 },
          border: `1px solid ${COLORS.border}`,
          borderRadius: { xs: 2.5, lg: 3 },
          bgcolor: COLORS.surface,
          boxShadow: "0 1px 2px rgba(15,23,42,.03)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
          spacing={{ xs: 2, md: 3 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 1.75,
                  bgcolor: "#EFF6FF",
                  color: COLORS.primary,
                }}
              >
                <MessageCircle size={19} strokeWidth={1.9} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="h1"
                  sx={{
                    fontSize: { xs: 18, sm: 20 },
                    fontWeight: 800,
                    color: COLORS.text,
                    lineHeight: 1.5,
                  }}
                >
                  کامنت‌های بی‌پاسخ
                </Typography>
                <Typography
                  sx={{
                    mt: 0.25,
                    fontSize: 11.5,
                    color: COLORS.secondary,
                    lineHeight: 1.7,
                  }}
                >
                  کامنت‌هایی که هنوز پاسخی از طرف شما دریافت نکرده‌اند.
                </Typography>
              </Box>
            </Stack>
          </Box>

        </Stack>
      </Box>

      <Box
        component="section"
        sx={{
          mt: 2,
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
          gap: 1.25,
        }}
      >
        {([
          { label: "کامنت‌های بی‌پاسخ", value: totalComments, Icon: MessageCircle },
          { label: "پست‌ها", value: regularPosts, Icon: ImageIcon },
          { label: "ریلزها", value: reelPosts, Icon: Video },
        ] as const).map(({ label, value, Icon }) => (
          <Box
            key={String(label)}
            sx={{
              minWidth: 0,
              p: { xs: 1.5, sm: 1.75 },
              border: `1px solid ${COLORS.border}`,
              borderRadius: { xs: 2, lg: 2.5 },
              bgcolor: COLORS.surface,
              boxShadow: "0 1px 2px rgba(15,23,42,.025)",
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 1.5,
                  bgcolor: "#F8FAFC",
                  color: COLORS.secondary,
                }}
              >
                <Icon size={16} strokeWidth={1.8} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: { xs: 18, sm: 20 },
                    fontWeight: 800,
                    color: COLORS.text,
                    lineHeight: 1.2,
                  }}
                >
                  {loading ? "—" : Number(value).toLocaleString("fa-IR")}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.35,
                    fontSize: 10,
                    color: COLORS.secondary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {label}
                </Typography>
              </Box>
            </Stack>
          </Box>
        ))}
      </Box>

      <Box
        component="section"
        sx={{
          mt: 2,
          p: { xs: 1.5, sm: 2 },
          border: `1px solid ${COLORS.border}`,
          borderRadius: { xs: 2.5, lg: 3 },
          bgcolor: COLORS.surface,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 750, color: COLORS.text }}>
              محتواهای دارای کامنت بی‌پاسخ
            </Typography>
            <Typography sx={{ mt: 0.35, fontSize: 10.5, color: COLORS.secondary }}>
              یک محتوا را انتخاب کن تا کامنت‌ها را ببینی و پاسخ بدهی.
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={0.75}
            role="tablist"
            aria-label="فیلتر نوع محتوا"
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            {([
              ["ALL", "همه"],
              ["POST", "پست"],
              ["REEL", "ریلز"],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                variant="contained"
                sx={{
                  flex: { xs: 1, sm: "initial" },
                  minWidth: { sm: 76 },
                  height: 34,
                  borderRadius: 1.75,
                  px: 1.75,
                  fontSize: 10.5,
                  fontWeight: 700,
                  boxShadow: "none",
                  bgcolor: filter === value ? COLORS.primary : "#F8FAFC",
                  color: filter === value ? "#FFF" : COLORS.secondary,
                  border: `1px solid ${filter === value ? COLORS.primary : COLORS.border}`,
                  "&:hover": {
                    boxShadow: "none",
                    bgcolor: filter === value ? COLORS.primaryDark : "#F1F5F9",
                  },
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Box>

      <Box component="section" sx={{ mt: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.25, px: 0.25 }}
        >
          {!loading ? (
            <Typography sx={{ fontSize: 12, fontWeight: 750, color: COLORS.text }}>
              {totalPosts.toLocaleString("fa-IR")} محتوا
            </Typography>
          ) : <Box />}
          {!loading ? (
            <Typography sx={{ fontSize: 10, color: COLORS.secondary }}>
              {totalComments.toLocaleString("fa-IR")} کامنت بی‌پاسخ
            </Typography>
          ) : null}
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2,minmax(0,1fr))",
              sm: "repeat(3,minmax(0,1fr))",
              lg: "repeat(4,minmax(0,1fr))",
              "@media (min-width:1536px)": "repeat(5,minmax(0,1fr))",
            },
            gap: { xs: 1.25, sm: 1.5 },
          }}
        >
          {loading
            ? (
                <Box sx={{ gridColumn: "1 / -1", minHeight: 260, display: "grid", placeItems: "center" }}>
                  <Stack alignItems="center" spacing={1}>
                    <Loader2 size={28} strokeWidth={2.2} className="animate-spin" color={COLORS.primary} />
                    <Typography sx={{ fontSize: 11, color: COLORS.secondary }}>در حال دریافت محتوا...</Typography>
                  </Stack>
                </Box>
              )
            : filteredPosts.length === 0
              ? (
                  <Box sx={{ gridColumn: "1 / -1" }}>
                    <EmptyState
                      title={
                        filter === "ALL"
                          ? "کامنت بی‌پاسخی وجود ندارد"
                          : filter === "POST"
                            ? "پستی با کامنت بی‌پاسخ وجود ندارد"
                            : "ریلی با کامنت بی‌پاسخ وجود ندارد"
                      }
                    />
                  </Box>
                )
              : filteredPosts.map((post, index) => (
                  <PostTile
                    key={post.media.id}
                    post={post}
                    index={index}
                    onClick={() =>
                      router.push(
                        "/dashboard/comments/" +
                          encodeURIComponent(post.media.id),
                      )
                    }
                  />
                ))}
        </Box>
      </Box>
    </Box>
  );
}
function PostTile({post,index,onClick}:{post:PostGroup;index:number;onClick:()=>void}){const router=useRouter();const mediaSrc=post.media.mediaType==="VIDEO"?post.media.thumbnailUrl??post.media.mediaUrl:post.media.mediaUrl??post.media.thumbnailUrl;const isReel=post.media.mediaProductType==="REELS";const latestCommenters=post.comments.slice().sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,3);const publishedDate=post.media.timestamp?new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(post.media.timestamp)):null;const span=index%5===1?{gridColumn:{xs:"span 1",sm:"span 2",lg:"span 1"}}:index%5===2?{gridColumn:{xs:"span 2",sm:"span 1",lg:"span 1"}}:{};return <Card component="button" type="button" onClick={onClick} onMouseEnter={()=>router.prefetch("/dashboard/comments/"+encodeURIComponent(post.media.id))} onPointerDown={()=>router.prefetch("/dashboard/comments/"+encodeURIComponent(post.media.id))} sx={{...span,width:"100%",display:"block",p:0,overflow:"hidden",textAlign:"right",cursor:"pointer",border:`1px solid ${COLORS.border}`,borderRadius:{xs:2.5,lg:1.5},bgcolor:COLORS.surface,boxShadow:{xs:"0 1px 2px rgba(15,23,42,.04)",lg:"none"},transition:"transform .2s ease, box-shadow .2s ease","&:hover":{transform:{xs:"translateY(-2px)",lg:"none"},boxShadow:{xs:"0 12px 30px rgba(15,23,42,.08)",lg:"none"}}}}><Box sx={{position:"relative",aspectRatio:"1 / 1",overflow:"hidden",bgcolor:"#F1F5F9",borderRadius:{lg:"12px"}}}>{mediaSrc?<Box component="img" src={mediaSrc} alt={post.media.caption??""} sx={{width:"100%",height:"100%",objectFit:"cover",display:"block",transition:"transform .5s ease","&:hover":{transform:"scale(1.025)"}}}/>:<Box sx={{width:"100%",height:"100%",display:"grid",placeItems:"center",color:COLORS.secondary}}><ImageIcon size={26} strokeWidth={1.5}/></Box>}<Box sx={{position:"absolute",inset:"auto 0 0",height:96,background:"linear-gradient(to top, rgba(0,0,0,.55), transparent)"}}/><Chip label={isReel?"ریل":"پست"} icon={post.media.mediaType==="VIDEO"?<Video size={11}/>:undefined} size="small" sx={{position:"absolute",top:10,right:10,height:27,bgcolor:"rgba(255,255,255,.95)",fontSize:10,fontWeight:700}}/><Box sx={{position:"absolute",left:10,bottom:10,display:"flex",alignItems:"center",gap:.6,px:1,height:30,borderRadius:99,bgcolor:COLORS.surface,color:COLORS.text,boxShadow:"0 4px 12px rgba(0,0,0,.16)"}}><MessageCircle size={13}/><Typography sx={{fontSize:11,fontWeight:700}}>{post.comments.length.toLocaleString("fa-IR")}</Typography></Box></Box><CardContent sx={{p:1.5,"&:last-child":{pb:1.5}}}><Typography sx={{minHeight:40,fontSize:11,lineHeight:1.8,color:COLORS.text,display:"-webkit-box",WebkitBoxOrient:"vertical",WebkitLineClamp:2,overflow:"hidden"}}>{post.media.caption?.trim()||"بدون کپشن"}</Typography><Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{mt:1.25}}><Stack direction="row" spacing={-0.7} dir="ltr">{latestCommenters.map(commenter=>commenter.profilePictureUrl?<Box key={commenter.id} component="img" src={commenter.profilePictureUrl} alt="" sx={{width:28,height:28,borderRadius:"50%",objectFit:"cover",border:"2px solid #FFF"}}/>:<Box key={commenter.id} sx={{width:28,height:28,borderRadius:"50%",display:"grid",placeItems:"center",bgcolor:COLORS.border,color:COLORS.secondary,fontSize:9,fontWeight:600,border:"2px solid #FFF"}}>{commenter.username.slice(0,1).toUpperCase()}</Box>)}</Stack>{publishedDate?<Typography component="time" sx={{fontSize:9.5,fontWeight:500,color:COLORS.secondary}}>{publishedDate}</Typography>:null}</Stack></CardContent></Card>}
function EmptyState({title}:{title:string}){return <Stack alignItems="center" justifyContent="center" sx={{py:12,color:COLORS.secondary}}><MessageCircle size={23} strokeWidth={1.5}/><Typography sx={{mt:1.5,fontSize:13,fontWeight:600,color:COLORS.text}}>{title}</Typography></Stack>}
