# پالت رسمی و واحد رنگی دایرا — Liquid Glass

این فایل **مرجع خوانای پالت کل سایت** است. منبع اجرایی و یگانه اعداد رنگی: `lib/design-system/palette.ts`. خروجی خودکار CSS: `app/daira-tokens.css`؛ آن را دستی ویرایش نکنید. `npm run theme:generate` برای تولید و `npm run theme:check` برای کنترل انطباق استفاده می‌شود.

## قواعد

- یک خانواده آبی برند؛ درجات مثبت/منفی/هشدار/اطلاع‌رسانی/درصف/پردازش با معنی ثابت.
- سطح Glass برای کارت‌های غیرورودی؛ فرم، متن طولانی، تقویم و متن گفتگو سطوح مات‌تر دارند.
- هدر و داک موجود با لایه‌های اختصاصی و محافظ گوشه حفظ می‌شوند؛ هاله رنگی داخل شیشه ممنوع است.
- رنگ‌های مستقیم HEX در کامپوننت جدید ممنوع؛ فقط CSS Variable `var(--daira-*)` یا `dairaPalette` استفاده شود.
- کنتراست متن روی شیشه بر حسب روشن‌ترین/تیره‌ترین محتوای پشت آن باید بررسی شود؛ برای کارهای متنی از سطح تقریباً مات استفاده شود.
- برای مرورگر بدون Blur و `prefers-reduced-transparency` جایگزین جامد وجود دارد.

## اصلی و خنثی

| توکن CSS | مقدار | نمونه استفاده |
|---|---|---|
| `--daira-brand-50` | `#F2F6FF` | رنگ معنایی |
| `--daira-brand-100` | `#E9F0FF` | رنگ معنایی |
| `--daira-brand-200` | `#D6E4FF` | رنگ معنایی |
| `--daira-brand-300` | `#B8CFFF` | رنگ معنایی |
| `--daira-brand-400` | `#82A6FF` | رنگ معنایی |
| `--daira-brand-500` | `#5280FF` | رنگ معنایی |
| `--daira-brand-600` | `#2F61FD` | رنگ معنایی |
| `--daira-brand-700` | `#1E4BD8` | رنگ معنایی |
| `--daira-brand-800` | `#1539A8` | رنگ معنایی |
| `--daira-brand-900` | `#102A78` | رنگ معنایی |
| `--daira-page-bg` | `#F4F7FC` | رنگ معنایی |
| `--daira-section-alt` | `#EEF3FB` | رنگ معنایی |
| `--daira-page-depth` | `#E7EFF9` | رنگ معنایی |
| `--daira-surface` | `#FFFFFF` | رنگ معنایی |
| `--daira-surface-hover` | `#F8FAFC` | رنگ معنایی |
| `--daira-surface-active` | `#F1F5F9` | رنگ معنایی |
| `--daira-primary` | `#2F61FD` | رنگ معنایی |
| `--daira-primary-hover` | `#1E4BD8` | رنگ معنایی |
| `--daira-primary-active` | `#1539A8` | رنگ معنایی |
| `--daira-outline` | `#CBD5E1` | رنگ معنایی |
| `--daira-outline-hover-bg` | `#EFF6FF` | رنگ معنایی |
| `--daira-outline-active-bg` | `#DBEAFE` | رنگ معنایی |
| `--daira-heading` | `#18233C` | رنگ معنایی |
| `--daira-text` | `#24344D` | رنگ متن |
| `--daira-text-secondary` | `#52637D` | رنگ متن |
| `--daira-muted` | `#60718A` | رنگ معنایی |
| `--daira-text-disabled` | `#94A3B8` | رنگ متن |
| `--daira-inverse-text` | `#FFFFFF` | رنگ متن |
| `--daira-link` | `#2F61FD` | رنگ معنایی |
| `--daira-link-hover` | `#1E4BD8` | رنگ معنایی |
| `--daira-icon` | `#60718A` | رنگ معنایی |
| `--daira-icon-active` | `#2F61FD` | رنگ معنایی |
| `--daira-disabled-bg` | `#E2E8F0` | رنگ معنایی |
| `--daira-disabled-text` | `#94A3B8` | رنگ متن |

## شیشه، خط و سایه

| توکن CSS | مقدار | نمونه استفاده |
|---|---|---|
| `--daira-glass-card` | `rgba(255,255,255,0.42)` | شفافیت و متریال |
| `--daira-glass-raised` | `rgba(255,255,255,0.58)` | شفافیت و متریال |
| `--daira-glass-modal` | `rgba(255,255,255,0.78)` | شفافیت و متریال |
| `--daira-glass-drawer` | `rgba(255,255,255,0.84)` | شفافیت و متریال |
| `--daira-glass-popover` | `rgba(255,255,255,0.90)` | شفافیت و متریال |
| `--daira-glass-toast` | `rgba(255,255,255,0.85)` | شفافیت و متریال |
| `--daira-glass-rim` | `rgba(255,255,255,0.94)` | شفافیت و متریال |
| `--daira-glass-inner-rim` | `rgba(255,255,255,0.58)` | شفافیت و متریال |
| `--daira-glass-overlay` | `rgba(24,35,60,0.30)` | شفافیت و متریال |
| `--daira-border` | `#DCE5F2` | رنگ معنایی |
| `--daira-border-hover` | `#B9CBE2` | رنگ معنایی |
| `--daira-divider` | `#DCE5EF` | رنگ معنایی |
| `--daira-shadow-card` | `0 5px 20px rgba(22,54,110,0.065)` | عمق لایه |
| `--daira-shadow-card-hover` | `0 12px 30px rgba(22,54,110,0.12)` | عمق لایه |
| `--daira-shadow-floating` | `0 18px 48px rgba(24,35,60,0.16)` | عمق لایه |

## فرم و تعامل

| توکن CSS | مقدار | نمونه استفاده |
|---|---|---|
| `--daira-input-bg` | `rgba(255,255,255,0.94)` | ورودی |
| `--daira-search-bg` | `#F8FAFC` | رنگ معنایی |
| `--daira-input-border` | `#DCE5F2` | ورودی |
| `--daira-input-border-hover` | `#B9CBE2` | ورودی |
| `--daira-input-focus` | `#2F61FD` | ورودی |
| `--daira-input-focus-ring` | `0 0 0 3px rgba(47,97,253,0.20)` | ورودی |
| `--daira-input-error-ring` | `0 0 0 3px rgba(239,68,68,0.15)` | ورودی |
| `--daira-input-label` | `#334155` | ورودی |
| `--daira-input-disabled` | `#F1F5F9` | ورودی |
| `--daira-tabs-active-bg` | `#E9F0FF` | رنگ معنایی |
| `--daira-tabs-active-text` | `#1E4BD8` | رنگ متن |
| `--daira-row-selected` | `rgba(47,97,253,0.08)` | رنگ معنایی |
| `--daira-row-hover` | `rgba(255,255,255,0.36)` | رنگ معنایی |
| `--daira-calendar-today` | `#2F61FD` | رنگ معنایی |
| `--daira-calendar-selected` | `#2F61FD` | رنگ معنایی |
| `--daira-calendar-selected-text` | `#FFFFFF` | رنگ متن |
| `--daira-upload-bg` | `#F6F9FF` | رنگ معنایی |
| `--daira-upload-border` | `#C9D8ED` | رنگ معنایی |
| `--daira-upload-active-border` | `#2F61FD` | رنگ معنایی |
| `--daira-chat-sent-bg` | `#E9F0FF` | رنگ معنایی |
| `--daira-chat-received-bg` | `#FFFFFF` | رنگ معنایی |

## موفقیت، هشدار و بازخورد

| توکن CSS | مقدار | نمونه استفاده |
|---|---|---|
| `--daira-success` | `#10B981` | رنگ معنایی |
| `--daira-success-text` | `#166534` | رنگ متن |
| `--daira-success-bg` | `#E9F8F0` | رنگ معنایی |
| `--daira-success-border` | `#BCE8CF` | رنگ معنایی |
| `--daira-warning` | `#D97706` | رنگ معنایی |
| `--daira-warning-text` | `#92400E` | رنگ متن |
| `--daira-warning-bg` | `#FFFBEB` | رنگ معنایی |
| `--daira-warning-border` | `#FDE68A` | رنگ معنایی |
| `--daira-error` | `#EF4444` | رنگ معنایی |
| `--daira-error-text` | `#B91C1C` | رنگ متن |
| `--daira-error-background` | `#FEF2F2` | رنگ معنایی |
| `--daira-error-border` | `#FECACA` | رنگ معنایی |
| `--daira-info` | `#0284C7` | رنگ معنایی |
| `--daira-info-text` | `#075985` | رنگ متن |
| `--daira-info-bg` | `#EBF7FF` | رنگ معنایی |
| `--daira-info-border` | `#BAE6FD` | رنگ معنایی |
| `--daira-processing` | `#7C3AED` | رنگ معنایی |
| `--daira-processing-text` | `#5B21B6` | رنگ متن |
| `--daira-processing-bg` | `#F3EEFF` | رنگ معنایی |
| `--daira-processing-border` | `#DDD0FE` | رنگ معنایی |
| `--daira-queue` | `#2F61FD` | رنگ معنایی |
| `--daira-queue-text` | `#1E4BD8` | رنگ متن |
| `--daira-queue-bg` | `#E9F0FF` | رنگ معنایی |
| `--daira-queue-border` | `#BFD1FF` | رنگ معنایی |
| `--daira-neutral` | `#64748B` | رنگ معنایی |
| `--daira-neutral-text` | `#52637D` | رنگ متن |
| `--daira-neutral-bg` | `#F1F5F9` | رنگ معنایی |
| `--daira-neutral-border` | `#DCE5EF` | رنگ معنایی |
| `--daira-accent` | `#DB4CF2` | رنگ معنایی |
| `--daira-accent-hover` | `#C026D3` | رنگ معنایی |
| `--daira-special-bg` | `#FDF0FF` | رنگ معنایی |
| `--daira-special-text` | `#86198F` | رنگ متن |
| `--daira-guide-bg` | `#FFFBEB` | رنگ معنایی |
| `--daira-guide-border` | `#FDE68A` | رنگ معنایی |
| `--daira-guide-text` | `#92400E` | رنگ متن |
| `--daira-guide-icon` | `#D97706` | رنگ معنایی |
| `--daira-badge-unread` | `#2F61FD` | بج |
| `--daira-badge-unread-text` | `#FFFFFF` | رنگ متن |
| `--daira-tooltip-bg` | `#24344D` | رنگ معنایی |
| `--daira-tooltip-text` | `#FFFFFF` | رنگ متن |

## نمودار و بارگذاری

| توکن CSS | مقدار | نمونه استفاده |
|---|---|---|
| `--daira-skeleton-base` | `#E5ECF6` | بارگذاری |
| `--daira-skeleton-highlight` | `#F5F8FF` | بارگذاری |
| `--daira-empty-icon-bg` | `#EDF3FF` | رنگ معنایی |
| `--daira-scrollbar` | `#C9D5E6` | رنگ معنایی |
| `--daira-chart-reach` | `#2F61FD` | نمایش داده |
| `--daira-chart-views` | `#0D9488` | نمایش داده |
| `--daira-chart-engagement` | `#7C3AED` | نمایش داده |
| `--daira-chart-follows` | `#D97706` | نمایش داده |
| `--daira-chart-profile` | `#0284C7` | نمایش داده |
| `--daira-chart-additional` | `#DB4CF2` | نمایش داده |
| `--daira-chart-grid` | `#DAE3F0` | نمایش داده |
| `--daira-chart-axis` | `#52637D` | نمایش داده |
| `--daira-chart-increase` | `#15803D` | نمایش داده |
| `--daira-chart-decrease` | `#B91C1C` | نمایش داده |
| `--daira-chart-empty` | `#CBD5E1` | نمایش داده |
| `--daira-publishing-surface` | `#FFFFFF` | رنگ معنایی |
| `--daira-publishing-soft` | `#F6F9FF` | رنگ معنایی |
| `--daira-publishing-border` | `#DFE7F3` | رنگ معنایی |
| `--daira-publishing-selected` | `#EDF3FF` | رنگ معنایی |
| `--daira-publishing-pulse` | `#BAD0FF` | رنگ معنایی |
| `--daira-publishing-completed` | `#16A34A` | رنگ معنایی |
| `--daira-publishing-completed-bg` | `#EAF8EF` | رنگ معنایی |
| `--daira-publishing-completed-border` | `#B8E7C6` | رنگ معنایی |
| `--daira-publishing-muted` | `#71819B` | رنگ معنایی |

## سازگاری ظاهر پیشین

| توکن CSS | مقدار | نمونه استفاده |
|---|---|---|
| `--daira-hero-glow` | `#E0EAFF` | رنگ معنایی |
| `--daira-pink-glow` | `#FCE7F3` | رنگ معنایی |
| `--daira-header-start` | `#EDF3FF` | رنگ معنایی |
| `--daira-header-middle` | `#F8FAFF` | رنگ معنایی |
| `--daira-header-end` | `#F2F6FF` | رنگ معنایی |


## تکمیل یکپارچگی مدال، جستجو، حالت خالی، حذف، کلمه کلیدی و فلو

| توکن CSS | مقدار | کاربرد |
|---|---|---|
| `--daira-glass-modal-balanced` | `rgba(255,255,255,0.74)` | daira glass |
| `--daira-glass-modal-ice` | `rgba(238,246,255,0.74)` | daira glass |
| `--daira-glass-modal-crystal` | `rgba(255,255,255,0.51)` | daira glass |
| `--daira-glass-modal-frost` | `rgba(255,255,255,0.89)` | daira glass |
| `--daira-glass-border-strong` | `rgba(255,255,255,0.97)` | daira glass |
| `--daira-glass-modal-dim` | `rgba(24,35,60,0.29)` | daira glass |
| `--daira-glass-modal-header` | `rgba(255,255,255,0.32)` | daira glass |
| `--daira-glass-modal-footer` | `rgba(255,255,255,0.20)` | daira glass |
| `--daira-search-surface` | `rgba(255,255,255,0.94)` | daira search |
| `--daira-search-border` | `#DCE5F2` | daira search |
| `--daira-search-focus` | `#2F61FD` | daira search |
| `--daira-search-placeholder` | `#60718A` | daira search |
| `--daira-empty-bg` | `rgba(255,255,255,0.42)` | daira empty |
| `--daira-empty-border` | `rgba(255,255,255,0.94)` | daira empty |
| `--daira-empty-title` | `#24344D` | daira empty |
| `--daira-empty-description` | `#52637D` | daira empty |
| `--daira-empty-icon-surface` | `#DDEAFE` | daira empty |
| `--daira-keyword-container` | `rgba(255,255,255,0.42)` | daira keyword |
| `--daira-keyword-chip-bg` | `#E9F0FF` | daira keyword |
| `--daira-keyword-chip-text` | `#1E4BD8` | daira keyword |
| `--daira-keyword-input-bg` | `rgba(255,255,255,0.94)` | daira keyword |
| `--daira-keyword-border` | `#DCE5F2` | daira keyword |
| `--daira-delete-modal` | `rgba(255,255,255,0.78)` | daira delete |
| `--daira-delete-emphasis` | `#B91C1C` | daira delete |
| `--daira-delete-soft` | `#FEF2F2` | daira delete |
| `--daira-guide-glass` | `rgba(255,251,235,0.80)` | daira guide |
| `--daira-guide-glass-rim` | `rgba(255,255,255,0.94)` | daira guide |
| `--daira-flow-card-glass` | `rgba(255,255,255,0.58)` | daira flow |
| `--daira-flow-selection` | `#E9F0FF` | daira flow |
| `--daira-skeleton-surface` | `rgba(255,255,255,0.42)` | daira skeleton |

### استانداردهای کامپوننت

- **Modal / Content Picker:** همه مدال‌ها شناور، چهار گوشه گرد، حداقل ۱۶px فاصله موبایل و حداکثر ۸۲dvh برای لیست‌های محتوا؛ فقط بخش نتایج اسکرول می‌شود، نه هدر و دکمه‌ها. پایه `.daira-glass-dialog` و `.daira-glass-overlay`.
- **Search:** زمینه سفید صدفی ۹۴٪ روی پنل شیشه‌ای؛ حداقل فونت 16px در موبایل برای جلوگیری از زوم Safari؛ فیلد یکسان با کلاس `.daira-search-field`.
- **Empty State:** آیکن و متن مرکزی، فاصله و جنس مشترک با `.daira-empty-state`؛ حالت خالی جستجو باید از حالت نبود هیچ آیتمی متمایز بماند.
- **Delete Confirmation:** پنجره شیشه‌ای با دکمه مخرب قرمز و دکمه انصراف مجزا، `.daira-glass-dialog--danger`.
- **Keyword Editor:** فیلد 16px، چیپ‌های ثابت، کلید Enter و دکمه افزودن دارای همان ساختار `.daira-keyword-field` و `.daira-keyword-chip`.
- **Guide:** `.daira-guide-glass` با رنگ هشدار زرد کم‌رنگ و لبه سفید؛ عنوان و توضیحات با توکن‌های معنایی راهنما.
- **Flow & Loading:** سطوح و انتخاب‌های فلو با `.daira-flow-glass` و Skeleton با `.daira-skeleton-glass`؛ تصویر/ویدیو و ورودی متن با وضوح کامل باقی می‌مانند.
