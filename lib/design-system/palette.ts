/** Shared Daira design tokens. Keep these values aligned with app/globals.css. */
export const dairaPalette = {
  background: {
    page: "#F4F7FC", // آبی-خاکستری بسیار روشن؛ پس‌زمینه اصلی صفحه
    section: "#EEF3FB", // آبی-خاکستری روشن؛ پس‌زمینه بخش‌ها
    surface: "#FFFFFF", // سفید؛ کارت‌ها و سطوح اصلی
    surfaceHover: "#F8FAFC", // خاکستری مایل به آبی بسیار روشن؛ حالت هاور سطح
    surfaceActive: "#F1F5F9", // خاکستری مایل به آبی روشن؛ سطح فعال
    headerStart: "#DCE7FF", // ابتدای گرادیان ثابت هدر داشبورد
    headerMiddle: "#E5EDFF", // میانه گرادیان هدر داشبورد
    headerEnd: "#EAF0FF", // انتهای گرادیان هدر داشبورد
  },
  primary: {
    main: "#2F61FD", // آبی اصلی برند
    hover: "#1E4BD8", // آبی تیره‌تر؛ حالت هاور
    active: "#1539A8", // آبی عمیق؛ حالت فعال
    disabledBackground: "#E2E8F0", // خاکستری روشن؛ پس‌زمینه غیرفعال
    disabledText: "#94A3B8", // خاکستری متوسط؛ متن غیرفعال
  },
  secondary: {
    outline: "#CBD5E1", // خاکستری مرز دکمه‌های ثانویه
    hoverBackground: "#EFF6FF", // آبی بسیار روشن؛ پس‌زمینه هاور
    activeBackground: "#DBEAFE", // آبی روشن؛ پس‌زمینه فعال
  },
  text: {
    heading: "#18233C", // سرمه‌ای؛ تیترها
    body: "#5A6B87", // آبی-خاکستری؛ متن اصلی
    muted: "#94A3B8", // خاکستری؛ متن کم‌رنگ و راهنما
    link: "#2F61FD", // آبی؛ لینک‌ها
    linkHover: "#1E4BD8", // آبی تیره؛ لینک در حالت هاور
  },
  form: {
    background: "#FFFFFF", // سفید؛ پس‌زمینه پیش‌فرض فیلدهای فرم
    searchBackground: "#F8FAFC", // خاکستری مایل به آبی بسیار روشن؛ پس‌زمینه فیلد جستجو
    border: "#E2E8F0", // خاکستری روشن؛ مرز فیلدها
    borderHover: "#CBD5E1", // خاکستری؛ مرز فیلد در حالت هاور
    focus: "#2F61FD", // آبی اصلی؛ حالت فوکوس
    error: "#EF4444", // قرمز؛ خطا
  },
  status: {
    accent: "#DB4CF2", // ارغوانی؛ رنگ تأکیدی
    accentHover: "#C026D3", // ارغوانی تیره؛ تأکید در حالت هاور
    success: "#10B981", // سبز؛ موفقیت
    warning: "#F59E0B", // نارنجی؛ هشدار
    error: "#EF4444", // قرمز؛ آیکن‌ها و وضعیت خطا
    errorBackground: "#FEF2F2", // پس‌زمینه پیام خطا
    errorBorder: "#FECACA", // حاشیه پیام خطا
    errorText: "#B91C1C", // متن پیام خطا با کنتراست بیشتر
  },
  border: "#E2E8F0", // خاکستری روشن؛ مرز عمومی
  heroGlow: "#E0EAFF", // آبی بسیار روشن؛ درخشش تزئینی
  pinkGlow: "#FCE7F3", // صورتی بسیار روشن؛ درخشش تزئینی
} as const;

export type DairaPalette = typeof dairaPalette;
