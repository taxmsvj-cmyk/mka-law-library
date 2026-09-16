interface PdfButtonProps {
  /** نام فایل پیشنهادی (بدون پسوند) — در کادر چاپ به عنوان نام سند نمایش داده می‌شود */
  fileName: string;
  label?: string;
  variant?: "primary" | "outline";
}

/**
 * دانلود PDF سند با استفاده از موتور چاپ مرورگر.
 * فونت فارسی و راست‌چینی کامل حفظ می‌شود و جدول‌های مرتبط هم در PDF می‌آیند.
 */
export function PdfButton({ fileName, label = "دانلود PDF", variant = "outline" }: PdfButtonProps) {
  const handleClick = () => {
    const previous = document.title;
    document.title = fileName;
    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    window.setTimeout(restore, 3000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        variant === "primary"
          ? "no-print h-10 rounded-lg bg-gold px-5 text-sm font-medium text-gold-foreground hover:opacity-90"
          : "no-print h-10 rounded-lg border border-border bg-card px-5 text-sm font-medium text-foreground hover:bg-secondary"
      }
    >
      {label}
    </button>
  );
}
