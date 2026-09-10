export const metadata = {
  title: "حذف اطلاعات | SmartDirect",
  description: "دستورالعمل حذف اطلاعات کاربران SmartDirect",
};

export default function DataDeletionPage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-white text-slate-900"
    >
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        <header className="mb-12 border-b border-slate-200 pb-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            دستورالعمل حذف اطلاعات
          </h1>

          <p className="mt-4 text-sm leading-7 text-slate-500">
            SmartDirect
          </p>
        </header>

        <div className="space-y-10 text-[15px] leading-8 text-slate-700">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-900">
              حذف حساب و اطلاعات
            </h2>

            <p>
              کاربران SmartDirect می‌توانند درخواست حذف اطلاعات حساب
              کاربری و اطلاعات مربوط به اتصال Instagram خود را ارسال کنند.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-900">
              اطلاعاتی که می‌توان درخواست حذف آن‌ها را داد
            </h2>

            <ul className="list-disc space-y-2 pr-6">
              <li>اطلاعات حساب کاربری SmartDirect</li>
              <li>اطلاعات اتصال حساب Instagram</li>
              <li>اطلاعات مربوط به اتوماسیون‌های ایجادشده توسط کاربر</li>
              <li>اطلاعات ذخیره‌شده مرتبط با پیام‌ها و نظرات، در صورت وجود</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-900">
              نحوه درخواست حذف
            </h2>

            <p>
              برای درخواست حذف اطلاعات، کاربر باید از طریق کانال رسمی
              پشتیبانی SmartDirect درخواست خود را ارسال کند.
            </p>

            <p className="mt-3">
              درخواست باید شامل ایمیلی باشد که با حساب SmartDirect
              استفاده شده است تا امکان شناسایی حساب و پردازش درخواست
              وجود داشته باشد.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-900">
              قطع اتصال Instagram
            </h2>

            <p>
              کاربر همچنین می‌تواند اتصال حساب Instagram خود را از
              SmartDirect قطع کند. قطع اتصال باعث توقف دسترسی فعال سرویس
              به حساب متصل خواهد شد، اما حذف کامل اطلاعات ذخیره‌شده ممکن
              است نیازمند ارسال درخواست حذف اطلاعات باشد.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-900">
              پردازش درخواست
            </h2>

            <p>
              پس از دریافت درخواست معتبر، اطلاعات مربوط به حساب مطابق
              سیاست‌های نگهداری اطلاعات SmartDirect بررسی و برای حذف
              پردازش می‌شوند؛ مگر اینکه نگهداری بخشی از اطلاعات به دلیل
              الزامات قانونی یا امنیتی ضروری باشد.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-900">
              تماس
            </h2>

            <p>
              برای ارسال درخواست حذف اطلاعات، از اطلاعات تماس رسمی
              SmartDirect استفاده کنید.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}