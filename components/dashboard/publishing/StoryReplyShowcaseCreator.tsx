"use client";

import { CircleCheck } from "lucide-react";
import { useRef, useState } from "react";
import StoryShowcaseSlidesEditor, { type StoryShowcaseSlide } from "./StoryShowcaseSlidesEditor";
import { requestStorageCleanupByPublicUrl, useStorageUploadLease } from "./useStorageUploadLease";

type Props = {
  instagramAccountId: string;
  onUploadMedia: (file?: File, onProgress?: (progress: number) => void) => Promise<string>;
  onCreated: (id: string, title: string) => void;
};

const MAX_SLIDES = 10;

function newSlide(): StoryShowcaseSlide {
  return {
    id: `slide_${crypto.randomUUID()}`,
    title: "", description: "", imageUrl: "", previewUrl: "",
    price: "", originalPrice: "", linkUrl: "", buttonText: "", isActive: true,
  };
}

/** Saves a standalone showcase for the selected quick-reply destination. */
export default function StoryReplyShowcaseCreator({ instagramAccountId, onUploadMedia, onCreated }: Props) {
  const [slides, setSlides] = useState<StoryShowcaseSlide[]>([newSlide()]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [retryFiles, setRetryFiles] = useState<Record<string, File | null>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);
  const saveLockRef = useRef(false);

  useStorageUploadLease(slides.map((slide) => slide.imageUrl));

  const uploadBusy = Object.values(uploading).some(Boolean);
  const completed = slides.filter((slide) => slide.imageUrl.trim() && slide.title.trim() && slide.description.trim()).length;
  const ready = Boolean(instagramAccountId) && slides.length > 0 && completed === slides.length && !uploadBusy && !saving && Boolean(name.trim());

  function patchSlide(id: string, patch: Partial<StoryShowcaseSlide>) {
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, ...patch } : slide));
  }

  async function uploadSlide(id: string, file?: File) {
    if (!file || uploading[id] || saving || created) return;
    setError("");
    setRetryFiles((current) => ({ ...current, [id]: file }));
    setUploadProgress((current) => ({ ...current, [id]: 0 }));
    setUploading((current) => ({ ...current, [id]: true }));
    // The parent uploader tracks in-flight form uploads and temporarily
    // disables final automation save.
    const previousUrl = slides.find((slide) => slide.id === id)?.imageUrl;
    try {
      const nextUrl = await onUploadMedia(file, (progress) => setUploadProgress((current) => ({ ...current, [id]: progress })));
      if (!nextUrl) throw new Error("آپلود تصویر ناموفق بود.");
      patchSlide(id, { imageUrl: nextUrl, previewUrl: nextUrl });
      setRetryFiles((current) => ({ ...current, [id]: null }));
      setUploadProgress((current) => ({ ...current, [id]: 100 }));
      if (previousUrl && previousUrl !== nextUrl) {
        void requestStorageCleanupByPublicUrl(previousUrl).catch(() => undefined);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود تصویر ناموفق بود.");
    } finally {
      setUploading((current) => ({ ...current, [id]: false }));
    }
  }

  async function createShowcase() {
    if (!ready || created || saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    setError("");
    let createdId: string | null = null;
    try {
      const title = name.trim();
      const response = await fetch("/api/showcases", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramAccountId, title, isActive: true }),
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok || raw?.error || typeof (raw?.data ?? raw)?.id !== "string") {
        throw new Error(raw?.error || "ساخت ویترین ناموفق بود.");
      }
      createdId = (raw.data ?? raw).id as string;

      for (const [index, slide] of slides.entries()) {
        const itemResponse = await fetch(`/api/showcases/${createdId}/items`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: slide.title.trim(), description: slide.description.trim() || null,
            imageUrl: slide.imageUrl.trim(), order: index, isActive: slide.isActive,
            price: slide.price || null, originalPrice: slide.originalPrice || null,
            linkUrl: slide.linkUrl.trim() || null, buttonText: slide.buttonText.trim() || null,
          }),
        });
        const result = await itemResponse.json().catch(() => null);
        if (!itemResponse.ok || result?.error) {
          throw new Error(result?.error || `ثبت اسلاید ${index + 1} ناموفق بود.`);
        }
      }
      setCreated({ id: createdId, title });
      onCreated(createdId, title);
    } catch (saveError) {
      if (createdId) {
        try {
          const cleanup = await fetch(`/api/showcases/${createdId}`, { method: "DELETE", credentials: "include" });
          if (!cleanup.ok) console.warn("Incomplete inline showcase cleanup failed:", cleanup.status);
        } catch (cleanupError) {
          console.warn("Incomplete inline showcase cleanup failed:", cleanupError);
        }
      }
      setError(saveError instanceof Error ? saveError.message : "ساخت ویترین ناموفق بود.");
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div role="status" className="flex items-start gap-2 rounded-xl bg-[var(--daira-success-bg)] p-3 text-xs leading-6 text-[var(--daira-success-text)]">
        <CircleCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div>
          <strong className="block">ویترین ساخته و انتخاب شد.</strong>
          <span>{created.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-3 pt-1">
      <div className="space-y-2">
        <label htmlFor="nested-showcase-name" className="block text-xs font-bold text-[var(--daira-heading)]">نام ویترین</label>
        <input id="nested-showcase-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="مثلاً کفش" className="w-full rounded-xl border border-[var(--daira-input-border)] bg-[var(--daira-surface)] px-3 py-3 text-base text-[var(--daira-heading)] outline-none focus:border-[var(--daira-input-focus)]" style={{fontSize:"16px"}}/>
        <p className="text-xs text-[var(--daira-text-secondary)]">نامی برای این ویترین انتخاب کن تا بعداً دوباره از آن استفاده کنی.</p>
      </div>
      <StoryShowcaseSlidesEditor
        slides={slides}
        completed={completed}
        maxSlides={MAX_SLIDES}
        uploading={uploading}
        uploadProgress={uploadProgress}
        retryFiles={retryFiles}
        disabled={saving}
        onPatch={patchSlide}
        onRemove={(id) => {
          const url = slides.find((slide) => slide.id === id)?.imageUrl;
          if (url) void requestStorageCleanupByPublicUrl(url).catch(() => undefined);
          setSlides((current) => current.filter((slide) => slide.id !== id));
        }}
        onAdd={() => setSlides((current) => current.length >= MAX_SLIDES ? current : [...current, newSlide()])}
        onUpload={(id, file) => { void uploadSlide(id, file); }}
      />
      {error && <p role="alert" className="text-xs leading-6 text-[var(--daira-error-text)]">{error}</p>}
      <button type="button" onClick={() => void createShowcase()} disabled={!ready}
        className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--daira-primary)] px-3 text-sm font-bold text-white transition hover:bg-[var(--daira-primary-hover)] disabled:cursor-not-allowed disabled:opacity-45">
        {saving ? "در حال ذخیره..." : "ساخت و انتخاب ویترین"}
      </button>
    </div>
  );
}
