export default function Loading() {
  return (
    <div
      dir="rtl"
      className="flex min-h-[60vh] items-center justify-center bg-[#F8FAFC] px-4"
    >
      <div className="flex items-center justify-center">
        <span
          className="h-7 w-7 animate-spin rounded-full border-2 border-[#DBEAFE] border-t-[#2563EB]"
          aria-label="در حال بارگذاری"
        />
      </div>
    </div>
  );
}
