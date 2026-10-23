"use client";

import { upload as uploadToBlob } from "@vercel/blob/client";

type UploadProgressCallback = (progress: number) => void;
export type UploadMediaResult = { type: "IMAGE" | "VIDEO" | "AUDIO"; storageKey: string; publicUrl: string; fileName: string; mimeType: string; fileSize: number; sortOrder: number };
type UploadedMedia = UploadMediaResult;
type UploadApiResult = { success?: boolean; message?: string; data?: unknown };
type UploadOptions = { purpose?: "PUBLISHING" | "AUTOMATION"; onController?: (controller: AbortController | null) => void };

export type PublishingUploadResult = Omit<UploadMediaResult, "type"> & { type: "IMAGE" | "VIDEO" };

async function normalizeAutomationImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || ["image/jpeg", "image/png"].includes(file.type)) return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("امکان تبدیل تصویر وجود ندارد.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("تبدیل تصویر انجام نشد.")), "image/jpeg", 0.85));
    return new File([blob], file.name.replace(/\\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    throw new Error("این فرمت تصویر در مرورگر قابل تبدیل نیست. لطفاً JPG یا PNG انتخاب کن.");
  } finally { URL.revokeObjectURL(objectUrl); }
}


export async function prepareAutomationFile(file: File): Promise<File> {
  // MediaRecorder and mobile browsers often append codec parameters to the MIME type.
  // Blob Storage accepts normalized media types, while the bytes are unchanged.
  const rawType = file.type.toLowerCase();
  const baseType = rawType.split(";")[0].trim();
  if (baseType && baseType !== rawType) {
    file = new File([file], file.name, { type: baseType, lastModified: file.lastModified });
  }
  if ((!baseType || baseType === "application/octet-stream") && /\\.(heic|heif)$/i.test(file.name)) {
    file = new File([file], file.name, { type: "image/heic", lastModified: file.lastModified });
  }
  file = await normalizeAutomationImage(file);
  const limit = file.type.startsWith("image/") ? 8_000_000 - 1 : 25_000_000 - 1;
  if (file.size === 0 || file.size > limit) throw new Error("حجم فایل پاسخ خودکار بیش از حد مجاز Meta است.");
  return file;
}

function uploadFormDataWithProgress(url: string, formData: FormData, signal: AbortSignal, onProgress: UploadProgressCallback, timeoutMs: number): Promise<{ ok: boolean; result: UploadApiResult | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;
    const abort = () => xhr.abort();
    const cleanup = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress(Math.max(1, Math.min(85, Math.round((event.loaded / event.total) * 85))));
    };
    xhr.onload = () => {
      cleanup();
      let result: UploadApiResult | null = null;
      try { result = JSON.parse(xhr.responseText); } catch { /* invalid response */ }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, result });
    };
    xhr.onerror = () => { cleanup(); reject(new Error("ارتباط هنگام آپلود فایل قطع شد.")); };
    xhr.ontimeout = () => { cleanup(); reject(new Error("زمان مجاز آپلود به پایان رسید.")); };
    xhr.onabort = () => { cleanup(); reject(new Error("آپلود فایل لغو شد.")); };
    xhr.send(formData);
  });
}

async function uploadOnce(file: File, type: string, onProgress: UploadProgressCallback, options: UploadOptions = {}): Promise<UploadMediaResult> {
  const purpose = options.purpose ?? "PUBLISHING";
  if (purpose === "AUTOMATION") file = await prepareAutomationFile(file);
  if (file.size === 0) throw new Error("فایل خالی است.");
  const prepareStartedAt = performance.now();
  const prepareResponse = await fetch("/api/instagram/publishing/upload/client", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      purpose,
    }),
  });

  console.info("[publishing-upload] prepare completed", {
    fileName: file.name,
    fileSize: file.size,
    durationMs: Math.round(performance.now() - prepareStartedAt),
  });

  const prepareResult = await prepareResponse.json().catch(() => null);
  if (!prepareResponse.ok || !prepareResult?.success) {
    throw new Error(prepareResult?.message || "آماده‌سازی آپلود ناموفق بود.");
  }

  if (prepareResult.mode !== "vercel-blob") {
    const abortController = new AbortController();
    options.onController?.(abortController);
    const uploadStartedAt = performance.now();
    const uploadTimeoutMs = file.type.startsWith("video/") ? 15 * 60 * 1000 : 3 * 60 * 1000;
    let uploadTimeoutId: number | null = null;

    try {
      uploadTimeoutId = window.setTimeout(() => {
        abortController.abort();
      }, uploadTimeoutMs);

      console.info("[publishing-upload] server upload started", {
        fileName: file.name,
        fileSize: file.size,
        mode: prepareResult.mode,
      });

      // Do not use XMLHttpRequest here. The same multipart request is
      // substantially faster through fetch in browsers.
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetType", type);
      formData.append("purpose", purpose);

      const response = await uploadFormDataWithProgress(
        "/api/instagram/publishing/upload",
        formData,
        abortController.signal,
        onProgress,
        uploadTimeoutMs,
      );
      const result = response.result;

      if (!response.ok || !result?.success || !result?.data) {
        throw new Error(result?.message || "آپلود فایل ناموفق بود.");
      }

      console.info("[publishing-upload] server upload completed", {
        fileName: file.name,
        fileSize: file.size,
        durationMs: Math.round(performance.now() - uploadStartedAt),
      });

      onProgress(100);
      return result.data as UploadedMedia;
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error(
          `آپلود فایل بیش از زمان مجاز طول کشید یا لغو شد. لطفاً دوباره تلاش کنید. (${Math.round(uploadTimeoutMs / 1000)}s)`,
        );
      }
      throw error;
    } finally {
      if (uploadTimeoutId !== null) {
        window.clearTimeout(uploadTimeoutId);
      }
      options.onController?.(null);
    }
  }

  const abortController = new AbortController();
  options.onController?.(abortController);

  // Vercel Blob multipart uploads split large files into parts that can upload
  // in parallel and retry independently. Keep multipart limited to very large
  // videos; medium videos use a single XHR-backed PUT for transport stability.
  // The server-side client-token handler receives the same multipart flag.
  const multipartThresholdBytes = 8 * 1024 * 1024;
  const isVideo = file.type.startsWith("video/");
  const useMultipart = isVideo && file.size >= multipartThresholdBytes;
  const uploadTimeoutMs = isVideo ? 15 * 60 * 1000 : 3 * 60 * 1000;
  const uploadStartedAt = performance.now();
  let uploadTimeoutId: number | null = null;

  try {
    uploadTimeoutId = window.setTimeout(() => {
      abortController.abort();
    }, uploadTimeoutMs);

    console.info("[publishing-upload] direct upload started", {
      fileName: file.name,
      fileSize: file.size,
      multipart: useMultipart,
    });

    // Images intentionally keep the fetch transport because it was measured
    // substantially faster in production. Videos use XHR progress below so
    // the browser actually sends the PUT reliably on the affected path.
    onProgress(1);

    const blob = await uploadToBlob(prepareResult.pathname, file, {
      access: "public",
      contentType: file.type,
      handleUploadUrl: "/api/instagram/publishing/upload/client",
      ...(useMultipart ? { multipart: true } : {}),
      abortSignal: abortController.signal,
      onUploadProgress: (progress) => {
        // Report actual transfer progress for images and videos.
        const uploadProgress = Math.max(1, Math.min(94, progress.percentage));
        onProgress(Math.round(uploadProgress));
      },
      clientPayload: JSON.stringify({
        pathname: prepareResult.pathname,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        purpose,
      }),
    });

    // Blob upload is complete at this point; finalize is the remaining stage.
    onProgress(95);

    console.info("[publishing-upload] direct upload completed", {
      fileName: file.name,
      fileSize: file.size,
      multipart: useMultipart,
      durationMs: Math.round(performance.now() - uploadStartedAt),
    });

    const finalizeResponse = await fetch("/api/instagram/publishing/upload/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "finalize",
        pathname: blob.pathname,
        url: blob.url,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        targetType: type,
        purpose,
      }),
    });
    const finalizeResult = await finalizeResponse.json().catch(() => null);

    if (!finalizeResponse.ok || !finalizeResult?.success || !finalizeResult?.data) {
      throw new Error(finalizeResult?.message || "ثبت فایل آپلودشده ناموفق بود.");
    }

    onProgress(100);
    return finalizeResult.data as UploadedMedia;
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error(
        `آپلود فایل بیش از زمان مجاز طول کشید یا لغو شد. لطفاً دوباره تلاش کنید. (${Math.round(uploadTimeoutMs / 1000)}s)`,
      );
    }
    throw error;
  } finally {
    if (uploadTimeoutId !== null) {
      window.clearTimeout(uploadTimeoutId);
    }
    options.onController?.(null);
  }
}

export function uploadFileWithProgress(file: File, type: string, onProgress: UploadProgressCallback, options?: Omit<UploadOptions, "purpose"> & { purpose?: "PUBLISHING" }): Promise<PublishingUploadResult>;
export function uploadFileWithProgress(file: File, type: string, onProgress: UploadProgressCallback, options: UploadOptions & { purpose: "AUTOMATION" }): Promise<UploadMediaResult>;
export async function uploadFileWithProgress(file: File, type: string, onProgress: UploadProgressCallback, options: UploadOptions = {}): Promise<UploadMediaResult> {
  // Retry a dropped connection once. Do not retry cancellations or validation/Meta errors.
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await uploadOnce(file, type, onProgress, options); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt > 0 || !/ارتباط|network|fetch failed|timeout|زمان مجاز/i.test(message) || /لغو شد/.test(message)) throw error;
      onProgress(0);
      await new Promise((resolve) => setTimeout(resolve, 450 + Math.random() * 300));
    }
  }
  throw new Error("آپلود ناموفق بود.");
}
