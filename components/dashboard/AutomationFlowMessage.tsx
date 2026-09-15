"use client";

import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    Image as ImageIcon,
    MessageSquare,
    Plus,
    Trash2,
    Video,
    Volume2,
    X,
} from "lucide-react";
import { useState } from "react";

import type {
    FormItem,
    MessageDraft,
    QuickReplyDraft,
    Showcase,
} from "./automation-form-utils";
import { getMessageTypeLabel } from "./automation-form-utils";

type ResourceKind = "SHOWCASE" | "FORM";
type FormFieldDraft = { label: string; name: string; type: "TEXT" | "TEXTAREA" | "PHONE" | "EMAIL" | "NUMBER" | "SELECT" | "RADIO" | "CHECKBOX"; required: boolean; placeholder: string; options: string };
type ShowcaseItemDraft = { title: string; description: string; imageUrl: string; price: string; originalPrice: string; linkUrl: string; buttonText: string };

type AutomationFlowMessageProps = {
    message: MessageDraft;
    index: number;
    total: number;
    messageOptions: { id: string; label: string }[];
    showcases: Showcase[];
    forms: FormItem[];
    loadingResources: boolean;
    instagramAccountId?: string;
    onUpdate: (patch: Partial<MessageDraft>) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onAddQuickReply: () => void;
    onUpdateQuickReply: (quickReplyId: string, patch: Partial<QuickReplyDraft>) => void;
    onRemoveQuickReply: (quickReplyId: string) => void;
    onShowcaseCreated?: (showcase: Showcase) => void;
    onFormCreated?: (form: FormItem) => void;
};

const emptyField = (): FormFieldDraft => ({ label: "", name: "", type: "TEXT", required: false, placeholder: "", options: "" });
const emptyItem = (): ShowcaseItemDraft => ({ title: "", description: "", imageUrl: "", price: "", originalPrice: "", linkUrl: "", buttonText: "مشاهده" });

function MessageIcon({ type }: { type: MessageDraft["messageType"] }) {
    const className = "text-slate-500";
    if (type === "IMAGE") return <ImageIcon size={16} className={className} />;
    if (type === "VIDEO") return <Video size={16} className={className} />;
    if (type === "AUDIO") return <Volume2 size={16} className={className} />;
    return <MessageSquare size={16} className={className} />;
}

export default function AutomationFlowMessage({
    message,
    index,
    total,
    messageOptions,
    showcases,
    forms,
    loadingResources,
    instagramAccountId,
    onUpdate,
    onRemove,
    onMoveUp,
    onMoveDown,
    onAddQuickReply,
    onUpdateQuickReply,
    onRemoveQuickReply,
    onShowcaseCreated,
    onFormCreated,
}: AutomationFlowMessageProps) {
    const [creator, setCreator] = useState<ResourceKind | null>(null);
    const [savingResource, setSavingResource] = useState(false);
    const [resourceError, setResourceError] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [fields, setFields] = useState<FormFieldDraft[]>([emptyField()]);
    const [items, setItems] = useState<ShowcaseItemDraft[]>([emptyItem()]);

    function openCreator(kind: ResourceKind) {
        setCreator(kind);
        setResourceError("");
        setTitle("");
        setDescription("");
        setFields([emptyField()]);
        setItems([emptyItem()]);
    }

    async function createResource() {
        if (!instagramAccountId) {
            setResourceError("ابتدا اکانت Instagram را انتخاب کنید.");
            return;
        }
        if (!title.trim()) {
            setResourceError(creator === "FORM" ? "عنوان فرم را وارد کنید." : "عنوان ویترین را وارد کنید.");
            return;
        }
        try {
            setSavingResource(true);
            setResourceError("");
            const endpoint = creator === "FORM" ? "/api/forms" : "/api/showcases";
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instagramAccountId, title: title.trim(), description: description.trim() || null, isActive: true }),
            });
            const result = await response.json();
            if (!response.ok || result?.error) throw new Error(result?.error || "ساخت مورد جدید ناموفق بود.");
            const created = result.data ?? result;

            if (creator === "FORM") {
                for (let i = 0; i < fields.length; i += 1) {
                    const field = fields[i];
                    if (!field.label.trim() || !field.name.trim()) throw new Error(`فیلد ${i + 1} باید عنوان و نام داشته باشد.`);
                    const needsOptions = ["SELECT", "RADIO", "CHECKBOX"].includes(field.type);
                    const options = field.options.split(/[\n,،]+/).map((item) => item.trim()).filter(Boolean);
                    if (needsOptions && !options.length) throw new Error(`برای فیلد ${i + 1} حداقل یک گزینه وارد کنید.`);
                    const fieldResponse = await fetch(`/api/forms/${created.id}/fields`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ label: field.label.trim(), name: field.name.trim(), type: field.type, required: field.required, placeholder: field.placeholder.trim() || null, options: needsOptions ? options : null, order: i }),
                    });
                    const fieldResult = await fieldResponse.json();
                    if (!fieldResponse.ok || fieldResult?.error) throw new Error(fieldResult?.error || `ساخت فیلد ${i + 1} ناموفق بود.`);
                }
                const form: FormItem = { ...created, fields };
                onFormCreated?.(form);
                onUpdate({ formId: created.id });
            } else {
                for (let i = 0; i < items.length; i += 1) {
                    const item = items[i];
                    if (!item.title.trim()) throw new Error(`عنوان آیتم ${i + 1} را وارد کنید.`);
                    const itemResponse = await fetch(`/api/showcases/${created.id}/items`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: item.title.trim(), description: item.description.trim() || null, imageUrl: item.imageUrl.trim() || null, price: item.price.trim() || null, originalPrice: item.originalPrice.trim() || null, linkUrl: item.linkUrl.trim() || null, buttonText: item.buttonText.trim() || null, order: i, isActive: true }),
                    });
                    const itemResult = await itemResponse.json();
                    if (!itemResponse.ok || itemResult?.error) throw new Error(itemResult?.error || `ساخت آیتم ${i + 1} ناموفق بود.`);
                }
                const showcase: Showcase = { ...created, items };
                onShowcaseCreated?.(showcase);
                onUpdate({ showcaseId: created.id });
            }
            setCreator(null);
        } catch (error) {
            setResourceError(error instanceof Error ? error.message : "ساخت مورد جدید ناموفق بود.");
        } finally {
            setSavingResource(false);
        }
    }

    return (
        <div className="space-y-4">
            <div>
                <label className="mb-2 block text-xs font-semibold text-slate-600">نوع پیام</label>
                <div className="relative">
                    <select value={message.messageType} onChange={(event) => onUpdate({ messageType: event.target.value as MessageDraft["messageType"], text: "", mediaUrl: "", mediaId: "", showcaseId: "", formId: "" })} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-700 outline-none focus:border-slate-400">
                        <option value="TEXT">متن</option>
                        <option value="IMAGE">تصویر</option>
                        <option value="VIDEO">ویدیو</option>
                        <option value="AUDIO">صوت</option>
                        <option value="SHOWCASE">ویترین</option>
                        <option value="FORM">فرم</option>
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
            </div>

            {message.messageType === "TEXT" && <div><label className="mb-2 block text-xs font-semibold text-slate-600">متن پیام</label><textarea value={message.text} onChange={(event) => onUpdate({ text: event.target.value })} rows={4} placeholder="متن پاسخ را وارد کنید..." className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-slate-400" /></div>}

            {(message.messageType === "IMAGE" || message.messageType === "VIDEO" || message.messageType === "AUDIO") && <div className="space-y-3"><div><label className="mb-2 block text-xs font-semibold text-slate-600">Media URL</label><input value={message.mediaUrl} onChange={(event) => onUpdate({ mediaUrl: event.target.value })} placeholder="https://..." dir="ltr" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400" /></div><div className="text-center text-[10px] text-slate-400">یا</div><div><label className="mb-2 block text-xs font-semibold text-slate-600">Media ID</label><input value={message.mediaId} onChange={(event) => onUpdate({ mediaId: event.target.value })} placeholder="Instagram Media ID" dir="ltr" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400" /></div></div>}

            {message.messageType === "SHOWCASE" && <div>
                <label className="mb-2 block text-xs font-semibold text-slate-600">ویترین</label>
                <div className="flex gap-2"><div className="relative flex-1"><select value={message.showcaseId} onChange={(event) => onUpdate({ showcaseId: event.target.value })} disabled={loadingResources} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm outline-none disabled:opacity-50"><option value="">{loadingResources ? "در حال دریافت..." : "انتخاب ویترین"}</option>{showcases.map((showcase) => <option key={showcase.id} value={showcase.id}>{showcase.title}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /></div><button type="button" onClick={() => openCreator("SHOWCASE")} disabled={!instagramAccountId} className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">+ ساخت ویترین</button></div>
                {!loadingResources && showcases.length === 0 && <p className="mt-2 text-[11px] text-slate-400">ویترین فعالی وجود ندارد؛ می‌توانید همینجا ویترین بسازید.</p>}
            </div>}

            {message.messageType === "FORM" && <div>
                <label className="mb-2 block text-xs font-semibold text-slate-600">فرم</label>
                <div className="flex gap-2"><div className="relative flex-1"><select value={message.formId} onChange={(event) => onUpdate({ formId: event.target.value })} disabled={loadingResources} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm outline-none disabled:opacity-50"><option value="">{loadingResources ? "در حال دریافت..." : "انتخاب فرم"}</option>{forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /></div><button type="button" onClick={() => openCreator("FORM")} disabled={!instagramAccountId} className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">+ ساخت فرم</button></div>
                {!loadingResources && forms.length === 0 && <p className="mt-2 text-[11px] text-slate-400">فرمی وجود ندارد؛ می‌توانید همینجا فرم بسازید.</p>}
            </div>}

            {creator && <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-bold text-slate-800">ساخت {creator === "FORM" ? "فرم" : "ویترین"}</p><p className="mt-1 text-[11px] text-slate-500">این مورد برای همین اکانت ساخته و بلافاصله در پیام انتخاب می‌شود.</p></div><button type="button" onClick={() => setCreator(null)} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-800"><X size={16} /></button></div>
                <div className="space-y-3"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={creator === "FORM" ? "عنوان فرم" : "عنوان ویترین"} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="توضیح (اختیاری)" className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
                {creator === "FORM" && <div className="space-y-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-700">فیلدهای فرم</span><button type="button" onClick={() => setFields((current) => [...current, emptyField()])} className="text-xs font-semibold text-slate-700">+ افزودن فیلد</button></div>{fields.map((field, fieldIndex) => <div key={fieldIndex} className="rounded-xl border border-slate-200 bg-white p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-500">فیلد {fieldIndex + 1}</span>{fields.length > 1 && <button type="button" onClick={() => setFields((current) => current.filter((_, i) => i !== fieldIndex))} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>}</div><div className="grid gap-2 sm:grid-cols-2"><input value={field.label} onChange={(event) => setFields((current) => current.map((item, i) => i === fieldIndex ? { ...item, label: event.target.value } : item))} placeholder="عنوان فیلد، مثلاً نام" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" /><input value={field.name} onChange={(event) => setFields((current) => current.map((item, i) => i === fieldIndex ? { ...item, name: event.target.value } : item))} placeholder="name، مثلاً name" dir="ltr" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" /><select value={field.type} onChange={(event) => setFields((current) => current.map((item, i) => i === fieldIndex ? { ...item, type: event.target.value as FormFieldDraft["type"] } : item))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none"><option value="TEXT">متن کوتاه</option><option value="TEXTAREA">متن بلند</option><option value="PHONE">شماره موبایل</option><option value="EMAIL">ایمیل</option><option value="NUMBER">عدد</option><option value="SELECT">انتخابی</option><option value="RADIO">تک‌انتخابی</option><option value="CHECKBOX">چندانتخابی</option></select><input value={field.placeholder} onChange={(event) => setFields((current) => current.map((item, i) => i === fieldIndex ? { ...item, placeholder: event.target.value } : item))} placeholder="Placeholder اختیاری" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" /></div>{["SELECT", "RADIO", "CHECKBOX"].includes(field.type) && <input value={field.options} onChange={(event) => setFields((current) => current.map((item, i) => i === fieldIndex ? { ...item, options: event.target.value } : item))} placeholder="گزینه‌ها را با ویرگول جدا کنید" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" />}<label className="mt-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={field.required} onChange={(event) => setFields((current) => current.map((item, i) => i === fieldIndex ? { ...item, required: event.target.checked } : item))} /> الزامی</label></div>)}</div>}
                {creator === "SHOWCASE" && <div className="space-y-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-700">آیتم‌های ویترین</span><button type="button" onClick={() => setItems((current) => [...current, emptyItem()])} className="text-xs font-semibold text-slate-700">+ افزودن آیتم</button></div>{items.map((item, itemIndex) => <div key={itemIndex} className="rounded-xl border border-slate-200 bg-white p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-500">آیتم {itemIndex + 1}</span>{items.length > 1 && <button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== itemIndex))} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>}</div><div className="grid gap-2 sm:grid-cols-2"><input value={item.title} onChange={(event) => setItems((current) => current.map((value, i) => i === itemIndex ? { ...value, title: event.target.value } : value))} placeholder="عنوان محصول" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" /><input value={item.imageUrl} onChange={(event) => setItems((current) => current.map((value, i) => i === itemIndex ? { ...value, imageUrl: event.target.value } : value))} placeholder="آدرس تصویر" dir="ltr" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" /><input value={item.price} onChange={(event) => setItems((current) => current.map((value, i) => i === itemIndex ? { ...value, price: event.target.value } : value))} placeholder="قیمت" dir="ltr" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" /><input value={item.originalPrice} onChange={(event) => setItems((current) => current.map((value, i) => i === itemIndex ? { ...value, originalPrice: event.target.value } : value))} placeholder="قیمت قبل" dir="ltr" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" /><input value={item.linkUrl} onChange={(event) => setItems((current) => current.map((value, i) => i === itemIndex ? { ...value, linkUrl: event.target.value } : value))} placeholder="لینک" dir="ltr" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none sm:col-span-2" /><input value={item.buttonText} onChange={(event) => setItems((current) => current.map((value, i) => i === itemIndex ? { ...value, buttonText: event.target.value } : value))} placeholder="متن دکمه" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" /><textarea value={item.description} onChange={(event) => setItems((current) => current.map((value, i) => i === itemIndex ? { ...value, description: event.target.value } : value))} placeholder="توضیح آیتم" rows={2} className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" /></div></div>)}</div>}
                {resourceError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{resourceError}</p>}
                <button type="button" onClick={() => void createResource()} disabled={savingResource} className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{savingResource ? "در حال ساخت..." : `ساخت ${creator === "FORM" ? "فرم" : "ویترین"} و انتخاب آن`}</button></div>
            </div>}

            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-700">Quick Replies</p><p className="mt-1 text-[10px] leading-5 text-slate-400">کاربر با انتخاب پاسخ سریع به پیام مقصد منتقل می‌شود.</p></div><span className="text-[10px] text-slate-400">{message.quickReplies.length}/13</span></div>
                {message.quickReplies.length > 0 && <div className="mt-4 space-y-3">{message.quickReplies.map((quickReply, qrIndex) => <div key={quickReply.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-500">پاسخ سریع {qrIndex + 1}</span><button type="button" onClick={() => onRemoveQuickReply(quickReply.id)} className="text-slate-400 hover:text-red-600"><X size={15} /></button></div><div className="space-y-3"><div><label className="mb-1.5 block text-[10px] font-semibold text-slate-500">عنوان</label><input value={quickReply.title} maxLength={20} onChange={(event) => onUpdateQuickReply(quickReply.id, { title: event.target.value })} placeholder="مثلاً: بله، نمایش بده" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none" /><div className="mt-1 text-left text-[9px] text-slate-400">{quickReply.title.length}/20</div></div><div><label className="mb-1.5 block text-[10px] font-semibold text-slate-500">رفتن به</label><div className="relative"><select value={quickReply.nextMessageId ?? ""} onChange={(event) => onUpdateQuickReply(quickReply.id, { nextMessageId: event.target.value || null })} className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pl-8 text-xs outline-none"><option value="">انتخاب پیام مقصد</option>{messageOptions.filter((option) => option.id !== message.id).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /></div></div></div></div>)}</div>}
                {message.quickReplies.length < 13 && <button type="button" onClick={onAddQuickReply} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"><Plus size={14} /> افزودن Quick Reply</button>}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3"><div className="flex items-center gap-1"><button type="button" disabled={index === 0} onClick={onMoveUp} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30" aria-label="انتقال به بالا"><ArrowUp size={15} /></button><button type="button" disabled={index === total - 1} onClick={onMoveDown} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30" aria-label="انتقال به پایین"><ArrowDown size={15} /></button></div><div className="flex items-center gap-2"><span className="hidden text-[10px] text-slate-400 sm:inline">{getMessageTypeLabel(message.messageType)}</span>{total > 1 && <button type="button" onClick={onRemove} className="flex items-center gap-1 rounded-lg border border-red-100 px-2.5 py-2 text-xs text-red-600 hover:bg-red-50"><Trash2 size={14} /> حذف</button>}</div></div>
        </div>
    );
}
