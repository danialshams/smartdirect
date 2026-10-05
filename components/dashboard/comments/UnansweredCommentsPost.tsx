"use client";

import { ArrowRight, Image as ImageIcon, Loader2, MessageCircle, Send, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from "@mui/material";

type Account = { id: string; igUsername: string; profilePictureUrl: string | null };
type Media = { id: string; caption: string | null; mediaType: string | null; mediaProductType: string | null; mediaUrl: string | null; thumbnailUrl: string | null; permalink: string | null; timestamp: string | null };
type Comment = { id: string; igCommentId: string; text: string; username: string; profilePictureUrl: string | null; createdAt: string };
type PostGroup = { media: Media; comments: Comment[] };
type ApiResponse = { success: boolean; posts?: PostGroup[]; message?: string };

const COLORS = { primary: "#2563EB", primaryDark: "#1D4ED8", text: "#0F172A", secondary: "#64748B", border: "#E2E8F0", background: "#F8FAFC", surface: "#FFFFFF" };

export default function UnansweredCommentsPost({ account, mediaId }: { account: Account; mediaId: string }) {
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
      if (!response.ok || !data.success) throw new Error(data.message ?? "دریافت کامنت‌ها ناموفق بود.");
      setPost(data.posts?.[0] ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "دریافت کامنت‌ها ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPost(); }, [account.id, mediaId]);

  async function reply(commentId: string) {
    const message = drafts[commentId]?.trim();
    if (!message) return;
    setReplyingId(commentId);
    setError("");
    try {
      const response = await fetch("/api/instagram/comments/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramAccountId: account.id, commentId, message }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message ?? "ارسال پاسخ ناموفق بود.");
      setPost((current) => {
        if (!current) return current;
        const comments = current.comments.filter((comment) => comment.id !== commentId);
        return comments.length ? { ...current, comments } : null;
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[commentId];
        return next;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "ارسال پاسخ ناموفق بود.");
    } finally {
      setReplyingId(null);
    }
  }

  const mediaSrc = post?.media.mediaType === "VIDEO"
    ? post.media.thumbnailUrl ?? post.media.mediaUrl
    : post?.media.mediaUrl ?? post?.media.thumbnailUrl;

  if (loading) {
    return (
      <Box dir="rtl" sx={{ width: "100%", minHeight: "60vh", display: "grid", placeItems: "center", bgcolor: COLORS.background }}>
        <Stack alignItems="center" spacing={1.25}>
          <CircularProgress size={30} thickness={3} />
          <Typography sx={{ fontSize: 11, color: COLORS.secondary }}>در حال دریافت کامنت‌ها...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box dir="rtl" sx={{ width: "100%", minHeight: "50vh", display: "grid", placeItems: "center", px: 2 }}>
        <Paper sx={{ width: "100%", maxWidth: 520, p: 2, borderRadius: 2.5, border: "1px solid #FECACA", bgcolor: "#FEF2F2", color: "#B91C1C", boxShadow: "none" }}>
          {error}
        </Paper>
      </Box>
    );
  }

  if (!post) {
    return (
      <Box dir="rtl" sx={{ width: "100%", minHeight: "50vh", display: "grid", placeItems: "center", px: 2 }}>
        <Paper sx={{ width: "100%", maxWidth: 460, p: 5, textAlign: "center", border: `1px solid ${COLORS.border}`, borderRadius: 3, boxShadow: "none" }}>
          <MessageCircle size={24} color={COLORS.secondary} strokeWidth={1.5} />
          <Typography sx={{ mt: 1.5, fontSize: 13, fontWeight: 700, color: COLORS.text }}>کامنت بی‌پاسخی باقی نمانده</Typography>
          <Button onClick={() => router.back()} sx={{ mt: 2, fontSize: 10.5 }}>بازگشت</Button>
        </Paper>
      </Box>
    );
  }

  const isReel = post.media.mediaProductType === "REELS";
  const publishedDate = post.media.timestamp
    ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(post.media.timestamp))
    : null;

  return (
    <Box dir="rtl" sx={{ width: "100%", pb: { xs: 4, lg: 6 } }}>
      <Box component="section" sx={{ p: { xs: 2, sm: 2.5, lg: 3 }, border: `1px solid ${COLORS.border}`, borderRadius: { xs: 2.5, lg: 3 }, bgcolor: COLORS.surface, boxShadow: "0 1px 2px rgba(15,23,42,.03)" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 38, height: 38, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 1.75, bgcolor: "#EFF6FF", color: COLORS.primary }}>
              <MessageCircle size={19} strokeWidth={1.9} />
            </Box>
            <Box>
              <Typography component="h1" sx={{ fontSize: { xs: 18, sm: 20 }, fontWeight: 800, color: COLORS.text }}>کامنت‌های بی‌پاسخ</Typography>
              <Typography sx={{ mt: .25, fontSize: 11.5, color: COLORS.secondary }}>پاسخ به کامنت‌های این محتوا</Typography>
            </Box>
          </Stack>
          <Button onClick={() => router.back()} startIcon={<ArrowRight size={15} />} sx={{ alignSelf: { xs: "stretch", sm: "center" }, minHeight: 36, borderRadius: 1.75, px: 1.75, fontSize: 10.5, fontWeight: 700, color: COLORS.secondary, bgcolor: "#F8FAFC", border: `1px solid ${COLORS.border}`, "&:hover": { bgcolor: "#F1F5F9" } }}>بازگشت</Button>
        </Stack>
      </Box>

      <Box component="section" sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3,1fr)" }, gap: 1.25 }}>
        {[
          { label: "کامنت‌های بی‌پاسخ", value: post.comments.length, Icon: MessageCircle },
          { label: "نوع محتوا", value: isReel ? "ریلز" : "پست", Icon: isReel ? Video : ImageIcon },
          { label: "تاریخ انتشار", value: publishedDate ?? "—", Icon: ImageIcon },
        ].map(({ label, value, Icon }) => (
          <Paper key={label} sx={{ p: { xs: 1.5, sm: 1.75 }, minWidth: 0, border: `1px solid ${COLORS.border}`, borderRadius: { xs: 2, lg: 2.5 }, boxShadow: "none" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 32, height: 32, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 1.5, bgcolor: "#F8FAFC", color: COLORS.secondary }}><Icon size={16} strokeWidth={1.8} /></Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: { xs: 14, sm: 16 }, fontWeight: 800, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</Typography>
                <Typography sx={{ mt: .35, fontSize: 10, color: COLORS.secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Typography>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>

      <Box component="section" sx={{ mt: 2, p: { xs: 1.5, sm: 2 }, border: `1px solid ${COLORS.border}`, borderRadius: { xs: 2.5, lg: 3 }, bgcolor: COLORS.surface }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
          <Box sx={{ position: "relative", width: { xs: "100%", sm: 220, md: 270 }, aspectRatio: "1 / 1", flexShrink: 0, overflow: "hidden", borderRadius: 2, bgcolor: "#F1F5F9" }}>
            {mediaSrc ? <Box component="img" src={mediaSrc} alt={post.media.caption ?? ""} sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <Box sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: COLORS.secondary }}><ImageIcon size={28} /></Box>}
            <Box sx={{ position: "absolute", top: 10, right: 10, px: 1, height: 27, display: "flex", alignItems: "center", gap: .5, borderRadius: 99, bgcolor: "rgba(255,255,255,.94)", color: COLORS.text, fontSize: 10, fontWeight: 700 }}>
              {isReel ? <Video size={12} /> : <ImageIcon size={12} />} {isReel ? "ریلز" : "پست"}
            </Box>
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 750, color: COLORS.text }}>محتوای انتخاب‌شده</Typography>
            <Typography sx={{ mt: .75, fontSize: 12, lineHeight: 1.9, color: COLORS.text, whiteSpace: "pre-wrap" }}>{post.media.caption?.trim() || "بدون کپشن"}</Typography>
          </Box>
        </Stack>
      </Box>

      <Box component="section" sx={{ mt: 2, p: { xs: 1.5, sm: 2 }, border: `1px solid ${COLORS.border}`, borderRadius: { xs: 2.5, lg: 3 }, bgcolor: COLORS.surface }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 750, color: COLORS.text }}>کامنت‌های بی‌پاسخ</Typography>
            <Typography sx={{ mt: .35, fontSize: 10.5, color: COLORS.secondary }}>برای هر کامنت، پاسخ را مستقیم ارسال کنید.</Typography>
          </Box>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: COLORS.secondary }}>{post.comments.length.toLocaleString("fa-IR")}</Typography>
        </Stack>

        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {post.comments.map((comment) => (
            <Paper key={comment.id} sx={{ p: { xs: 1.25, sm: 1.5 }, border: `1px solid ${COLORS.border}`, borderRadius: 2, bgcolor: COLORS.surface, boxShadow: "none" }}>
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                {comment.profilePictureUrl ? <Box component="img" src={comment.profilePictureUrl} alt={comment.username} sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: "50%", objectFit: "cover" }} /> : <Box sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: "#E2E8F0", color: COLORS.secondary, fontSize: 9, fontWeight: 700 }}>IG</Box>}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" spacing={{ xs: .3, sm: 2 }}>
                    <Typography dir="ltr" noWrap sx={{ maxWidth: "100%", fontSize: 11, fontWeight: 700, color: COLORS.text }}>@{comment.username}</Typography>
                    <Typography sx={{ fontSize: 9.5, color: COLORS.secondary, flexShrink: 0 }}>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(new Date(comment.createdAt))}</Typography>
                  </Stack>
                  <Typography sx={{ mt: .65, fontSize: 12.5, lineHeight: 1.8, color: COLORS.text, whiteSpace: "pre-wrap" }}>{comment.text}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1, p: .75, border: `1px solid ${COLORS.border}`, borderRadius: 1.75, bgcolor: "#F8FAFC" }}>
                    <TextField fullWidth size="small" value={drafts[comment.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [comment.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void reply(comment.id); } }} slotProps={{ htmlInput: { maxLength: 1000 } }} placeholder="پاسخ به کامنت..." sx={{ "& .MuiOutlinedInput-root": { border: 0, bgcolor: "transparent", "& fieldset": { border: 0 } }, "& input": { fontSize: 11.5 } }} />
                    <Button type="button" onClick={() => void reply(comment.id)} disabled={replyingId === comment.id || !(drafts[comment.id] ?? "").trim()} sx={{ minWidth: { xs: 42, sm: 70 }, height: 36, alignSelf: "center", borderRadius: 1.5, bgcolor: COLORS.primary, color: "#FFF", fontSize: 10.5, fontWeight: 600, "&:hover": { bgcolor: COLORS.primaryDark } }}>
                      {replyingId === comment.id ? <CircularProgress size={14} sx={{ color: "#FFF" }} /> : <><Send size={13} /><Box component="span" sx={{ mr: .5, display: { xs: "none", sm: "inline" } }}>ارسال</Box></>}
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
