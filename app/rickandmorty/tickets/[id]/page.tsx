"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowRight, CheckCheck, Clock3, MessageSquare, Send, ShieldCheck, UserRound } from "lucide-react";

type TicketMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderUserId: string;
  sender: { name: string | null; role: string };
  attachments: { id: string; fileName: string; mimeType: string }[];
};

type TicketData = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null; email: string };
  messages: TicketMessage[];
};

const statuses = [
  { value: "OPEN", label: "باز" },
  { value: "IN_PROGRESS", label: "در حال بررسی" },
  { value: "WAITING_USER", label: "منتظر پاسخ کاربر" },
  { value: "RESOLVED", label: "حل‌شده" },
  { value: "CLOSED", label: "بسته‌شده" },
];

const priorities = [
  { value: "LOW", label: "کم" },
  { value: "NORMAL", label: "عادی" },
  { value: "HIGH", label: "زیاد" },
  { value: "URGENT", label: "فوری" },
];

const statusMeta: Record<string, { label: string; color: "primary" | "warning" | "default" | "success" }> = {
  OPEN: { label: "باز", color: "primary" },
  IN_PROGRESS: { label: "در حال بررسی", color: "primary" },
  WAITING_USER: { label: "منتظر پاسخ کاربر", color: "warning" },
  RESOLVED: { label: "حل‌شده", color: "success" },
  CLOSED: { label: "بسته‌شده", color: "default" },
};

const priorityMeta: Record<string, { label: string; color: "error" | "warning" | "default" }> = {
  LOW: { label: "کم", color: "default" },
  NORMAL: { label: "عادی", color: "default" },
  HIGH: { label: "زیاد", color: "warning" },
  URGENT: { label: "فوری", color: "error" },
};

const formatPersianDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; severity: "success" | "error" } | null>(null);
  const [loadError, setLoadError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadTicket = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      setLoadError("");
      try {
        const res = await fetch(`/api/admin/tickets/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "دریافت جزئیات تیکت ناموفق بود");
        setTicket(json);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "خطا در برقراری ارتباط با سرور");
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (id) void loadTicket(true);
  }, [id, loadTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [ticket?.messages.length, loading]);

  const patchTicket = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "ذخیره تغییرات ناموفق بود");
      setTicket((prev) => (prev ? { ...prev, ...json } : prev));
      setNotice({ text: "وضعیت تیکت با موفقیت به‌روزرسانی شد", severity: "success" });
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : "خطا در ذخیره‌سازی تغییرات",
        severity: "error",
      });
    }
  };

  const sendMessage = async () => {
    const trimmed = body.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tickets/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "ارسال پاسخ ناموفق بود");
      setBody("");
      await loadTicket(false);
      setNotice({ text: "پاسخ شما با موفقیت ثبت شد", severity: "success" });
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : "خطا در ارسال پیام",
        severity: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  if (loading) {
    return (
      <Box
        dir="rtl"
        role="status"
        aria-label="در حال بارگذاری تیکت"
        sx={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <CircularProgress size={40} thickness={4} />
        <Typography variant="body2" color="text.secondary">
          در حال دریافت جزئیات تیکت…
        </Typography>
      </Box>
    );
  }

  if (!ticket) {
    return (
      <Stack dir="rtl" spacing={2} sx={{ maxWidth: 600, mx: "auto", mt: 4, px: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowRight size={18} />}
          onClick={() => router.push("/rickandmorty/tickets")}
          sx={{ alignSelf: "flex-start", borderRadius: 2, fontWeight: 700 }}
        >
          بازگشت به فهرست تیکت‌ها
        </Button>
        <Alert severity="error">{loadError || "تیکت پیدا نشد."}</Alert>
        <Button variant="contained" onClick={() => void loadTicket(true)} sx={{ alignSelf: "flex-start", borderRadius: 2 }}>
          تلاش دوباره
        </Button>
      </Stack>
    );
  }

  const currentStatus = statusMeta[ticket.status] || { label: ticket.status, color: "default" as const };
  const currentPriority = priorityMeta[ticket.priority] || { label: ticket.priority, color: "default" as const };

  return (
    <Stack dir="rtl" spacing={{ xs: 1.5, sm: 2 }} sx={{ width: "100%", maxWidth: 1100, mx: "auto", pb: 3 }}>
      {/* هدر صفحه: دکمه بازگشت + عنوان تیکت و نام کاربر */}
      <Card
        variant="outlined"
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: 3,
          borderColor: "#E2E8F0",
          bgcolor: "#FFFFFF",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, minWidth: 0, flex: 1 }}>
            <IconButton
              onClick={() => router.push("/rickandmorty/tickets")}
              aria-label="بازگشت به فهرست تیکت‌ها"
              sx={{
                width: 38,
                height: 38,
                flexShrink: 0,
                border: "1px solid #E2E8F0",
                borderRadius: 2,
                color: "#334155",
                bgcolor: "#F8FAFC",
                "&:hover": { bgcolor: "#F1F5F9" },
              }}
            >
              <ArrowRight size={19} />
            </IconButton>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontSize: { xs: 16, sm: 19 },
                  fontWeight: 800,
                  color: "#0F172A",
                  lineHeight: 1.5,
                  overflowWrap: "anywhere",
                }}
              >
                {ticket.subject}
              </Typography>
              <Typography sx={{ fontSize: 13, color: "#64748B", mt: 0.25, fontWeight: 600 }}>
                کاربر: {ticket.user.name || "کاربر ناشناس"}
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: "flex-start", sm: "center" }, flexShrink: 0 }}>
            <Chip
              size="small"
              label={currentStatus.label}
              color={currentStatus.color}
              variant="filled"
              sx={{ fontWeight: 700, borderRadius: 1.5, height: 26 }}
            />
            <Chip
              size="small"
              label={`اولویت ${currentPriority.label}`}
              color={currentPriority.color}
              variant="outlined"
              sx={{ fontWeight: 700, borderRadius: 1.5, height: 26 }}
            />
          </Stack>
        </Box>
      </Card>

      {/* تغییر وضعیت و اولویت */}
      <Card
        variant="outlined"
        sx={{
          p: { xs: 1.25, sm: 1.5 },
          borderRadius: 2.5,
          borderColor: "#E2E8F0",
          bgcolor: "#FFFFFF",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 1.5,
        }}
      >
        <FormControl size="small" fullWidth>
          <InputLabel id="ticket-status-label">وضعیت تیکت</InputLabel>
          <Select
            labelId="ticket-status-label"
            value={ticket.status}
            label="وضعیت تیکت"
            onChange={(e) => void patchTicket({ status: e.target.value })}
          >
            {statuses.map((x) => (
              <MenuItem key={x.value} value={x.value}>
                {x.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel id="ticket-priority-label">میزان اولویت</InputLabel>
          <Select
            labelId="ticket-priority-label"
            value={ticket.priority}
            label="میزان اولویت"
            onChange={(e) => void patchTicket({ priority: e.target.value })}
          >
            {priorities.map((x) => (
              <MenuItem key={x.value} value={x.value}>
                {x.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Card>

      {/* محیط گفتگو و پیام‌ها */}
      <Card
        variant="outlined"
        sx={{
          borderRadius: 3,
          borderColor: "#E2E8F0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: { xs: "calc(100dvh - 310px)", sm: "66vh" },
          minHeight: 450,
          maxHeight: 900,
          bgcolor: "#FFFFFF",
        }}
      >
        {/* نوار سربرگ چت */}
        <Box
          sx={{
            px: { xs: 1.5, sm: 2 },
            py: 1.25,
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bgcolor: "#F8FAFC",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 32,
                height: 32,
                display: "grid",
                placeItems: "center",
                borderRadius: 2,
                bgcolor: "#EFF6FF",
                color: "#2563EB",
              }}
            >
              <UserRound size={17} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>گفتگو با کاربر</Typography>
              <Typography sx={{ fontSize: 11, color: "#64748B" }}>
                {ticket.messages.length.toLocaleString("fa-IR")} پیام ثبت‌شده
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: "#16A34A" }}>
            <ShieldCheck size={16} />
            <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>پشتیبانی مدیریت</Typography>
          </Stack>
        </Box>

        {/* بخش اسکرول پیام‌ها */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            p: { xs: 1.5, sm: 2 },
            bgcolor: "#F8FAFC",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            overscrollBehavior: "contain",
          }}
        >
          {ticket.messages.length === 0 ? (
            <Box sx={{ m: "auto", textAlign: "center", color: "#64748B", py: 5 }}>
              <Box
                sx={{
                  mx: "auto",
                  mb: 1.25,
                  width: 48,
                  height: 48,
                  borderRadius: 2.5,
                  bgcolor: "#E2E8F0",
                  display: "grid",
                  placeItems: "center",
                  color: "#475569",
                }}
              >
                <MessageSquare size={22} />
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#1E293B" }}>هنوز پیامی رد و بدل نشده است</Typography>
              <Typography sx={{ fontSize: 12, mt: 0.5 }}>اولین پیام خود را ارسال کنید.</Typography>
            </Box>
          ) : (
            ticket.messages.map((m) => {
              const isAdmin = m.sender.role === "ADMIN";
              return (
                <Box
                  key={m.id}
                  sx={{
                    display: "flex",
                    justifyContent: isAdmin ? "flex-start" : "flex-end",
                    width: "100%",
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: { xs: "90%", sm: "75%" },
                      minWidth: 150,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isAdmin ? "flex-start" : "flex-end",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.35, px: 0.5 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: isAdmin ? "#2563EB" : "#334155" }}>
                        {isAdmin ? "پاسخ پشتیبانی" : m.sender.name || ticket.user.name || "کاربر"}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 10,
                          color: "#94A3B8",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.35,
                        }}
                      >
                        <Clock3 size={11} />
                        {formatPersianDate(m.createdAt)}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2.5,
                        borderTopRightRadius: isAdmin ? 0.5 : 2.5,
                        borderTopLeftRadius: !isAdmin ? 0.5 : 2.5,
                        bgcolor: isAdmin ? "#EFF6FF" : "#FFFFFF",
                        border: "1px solid",
                        borderColor: isAdmin ? "#BFDBFE" : "#E2E8F0",
                        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 13,
                          lineHeight: 1.9,
                          color: "#0F172A",
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          textAlign: "right",
                        }}
                      >
                        {m.body}
                      </Typography>
                      {m.attachments?.map(file => (
                        <Box key={file.id} component="a" href={"/api/dashboard/tickets/attachments/" + encodeURIComponent(file.id)}
                          target="_blank" rel="noopener noreferrer"
                          sx={{ display: "block", mt: 1, maxWidth: 240, borderRadius: 2, overflow: "hidden" }}>
                          <Box component="img" src={"/api/dashboard/tickets/attachments/" + encodeURIComponent(file.id)}
                            alt={file.fileName} sx={{ display: "block", width: "100%", maxHeight: 250, objectFit: "contain", bgcolor: "#EEF2F8" }} />
                        </Box>
                      ))}
                    </Box>

                    {isAdmin && (
                      <Box sx={{ display: "flex", alignItems: "center", mt: 0.25, px: 0.5, color: "#2563EB" }}>
                        <CheckCheck size={14} />
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </Box>

        {loadError && (
          <Alert severity="error" sx={{ m: 1.5, borderRadius: 2 }}>
            {loadError}
          </Alert>
        )}

        {/* فیلد ارسال پاسخ */}
        <Box sx={{ p: { xs: 1.25, sm: 1.5 }, borderTop: "1px solid #E2E8F0", bgcolor: "#FFFFFF" }}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="پاسخ خود را بنویسید… (Enter برای ارسال سریع)"
            inputProps={{ "aria-label": "متن پاسخ تیکت", dir: "rtl" }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2.5,
                bgcolor: "#FAFBFD",
                fontSize: 13.5,
                lineHeight: 1.8,
              },
            }}
          />
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column-reverse", sm: "row" },
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "space-between",
              gap: 1,
              mt: 1.25,
            }}
          >
            <Typography sx={{ fontSize: 11, color: "#94A3B8", textAlign: { xs: "center", sm: "right" } }}>
              Shift + Enter برای سطر جدید
            </Typography>
            <Button
              variant="contained"
              onClick={() => void sendMessage()}
              disabled={busy || !body.trim()}
              endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
              sx={{
                minWidth: 130,
                minHeight: 40,
                borderRadius: 2,
                fontWeight: 700,
                boxShadow: "none",
                bgcolor: "#2563EB",
                "&:hover": { bgcolor: "#1D4ED8", boxShadow: "none" },
              }}
            >
              {busy ? "در حال ارسال…" : "ارسال پاسخ"}
            </Button>
          </Box>
        </Box>
      </Card>

      <Snackbar
        open={!!notice}
        autoHideDuration={3500}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setNotice(null)} severity={notice?.severity || "success"} variant="filled">
          {notice?.text}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
