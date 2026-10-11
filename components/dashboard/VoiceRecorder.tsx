"use client";

import { Mic, Pause, Play, RotateCcw, Square, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  onRecorded: (file: File) => boolean | void | Promise<boolean | void>;
  disabled?: boolean;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export default function VoiceRecorder({ onRecorded, disabled = false }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearPreviewUrl() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }

  function resetRecording() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopTracks();
    clearPreviewUrl();
    setRecording(false);
    setPaused(false);
    setDuration(0);
    setRecordedFile(null);
    setPreviewUrl("");
    setProcessing(false);
  }

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    recorderRef.current?.stop();
    stopTracks();
    clearPreviewUrl();
  }, []);

  async function startRecording() {
    if (disabled || recording || processing) return;
    setError("");

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("مرورگر دستگاه شما امکان ضبط وویس را پشتیبانی نمی‌کند.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setDuration(0);
      setRecordedFile(null);
      setPreviewUrl("");
      clearPreviewUrl();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError("ضبط وویس ناموفق بود. دوباره تلاش کنید.");
        resetRecording();
      };

      recorder.onstop = () => {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const actualMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        const extension = extensionForMimeType(actualMimeType);
        const file = new File([blob], `voice-${Date.now()}.${extension}`, {
          type: actualMimeType,
          lastModified: Date.now(),
        });

        const nextPreviewUrl = URL.createObjectURL(blob);
        previewUrlRef.current = nextPreviewUrl;
        setRecordedFile(file);
        setPreviewUrl(nextPreviewUrl);
        setRecording(false);
        setPaused(false);
        stopTracks();
        recorderRef.current = null;
      };

      recorder.start(250);
      setRecording(true);
      setPaused(false);

      timerRef.current = window.setInterval(() => {
        setDuration(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
      }, 250);
    } catch (recordingError) {
      stopTracks();
      setError(
        recordingError instanceof DOMException && recordingError.name === "NotAllowedError"
          ? "دسترسی میکروفون داده نشد. اجازه استفاده از میکروفون را فعال کنید."
          : "دسترسی به میکروفون یا شروع ضبط وویس ناموفق بود.",
      );
    }
  }

  function togglePause() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    if (recorder.state === "recording") {
      recorder.pause();
      setPaused(true);
    } else if (recorder.state === "paused") {
      recorder.resume();
      setPaused(false);
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }

  async function uploadRecording() {
    if (!recordedFile || processing) return;
    setError("");
    setProcessing(true);
    try {
      const result = await onRecorded(recordedFile);
      if (result === false) {
        setProcessing(false);
        return;
      }
      resetRecording();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود وویس ناموفق بود.");
      setProcessing(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4">
      {recording ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#D97706]">
                <Mic size={19} />
              </span>
              <div>
                <p className="text-xs font-bold text-[#0F172A]">{paused ? "ضبط متوقف است" : "در حال ضبط وویس"}</p>
                <p className="mt-0.5 font-mono text-xs text-[#64748B]" dir="ltr">{formatDuration(duration)}</p>
              </div>
            </div>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#DC2626]" />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={togglePause}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-xs font-bold text-[#334155]"
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
              {paused ? "ادامه ضبط" : "مکث"}
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-3 py-2.5 text-xs font-bold text-white"
            >
              <Square size={14} />
              پایان ضبط
            </button>
          </div>
        </div>
      ) : recordedFile ? (
        <div className="space-y-3">
          <audio src={previewUrl} controls className="w-full" />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={processing}
              onClick={resetRecording}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-xs font-bold text-[#64748B] disabled:opacity-50"
            >
              <RotateCcw size={14} />
              ضبط دوباره
            </button>
            <button
              type="button"
              disabled={processing}
              onClick={() => void uploadRecording()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              <Upload size={14} />
              {processing ? "در حال آپلود..." : "آپلود وویس"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void startRecording()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs font-bold text-[#334155] transition hover:border-[#BFDBFE] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Mic size={16} />
          ضبط وویس با میکروفون
        </button>
      )}

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-[10px] leading-5 text-[#B91C1C]">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="بستن خطا">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
