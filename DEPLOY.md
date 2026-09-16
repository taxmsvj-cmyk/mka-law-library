# استقرار خودکار (Vercel)

با اتصال این مخزن به Vercel، هر بار که روی شاخه اصلی پوش کنید سایت به‌صورت خودکار به‌روز می‌شود.
پوش روی شاخه‌های دیگر هم یک نسخه پیش‌نمایش جداگانه می‌سازد.

## مراحل یک‌بارِ راه‌اندازی

1. وارد <https://vercel.com/new> شوید و با همان حساب GitHub وارد شوید.
2. مخزن `mka-law-library` را انتخاب و Import کنید.
3. تنظیمات Build را دست نزنید؛ فایل `vercel.json` همه چیز را تعیین می‌کند
   (نصب و ساخت با bun، خروجی Nitro با پریست `vercel`).
4. در بخش Environment Variables این مقادیر را از فایل `.env` پروژه اضافه کنید
   (برای هر سه محیط Production، Preview و Development):

   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_PROJECT_ID`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`

5. روی Deploy بزنید. از این به بعد هر `git push` به شاخه اصلی، استقرار تازه‌ای می‌سازد.

## نکته‌ها

- فایل `.env` عمداً در مخزن نیست؛ مقادیر فقط در تنظیمات Vercel نگهداری می‌شوند.
- برای دامنه اختصاصی: Project → Settings → Domains.
- اگر به‌جای Vercel از Netlify استفاده کردید، کافی است در تنظیمات سایت
  `NITRO_PRESET=netlify` و دستور ساخت `bun run build` را قرار دهید و همان
  متغیرهای بالا را اضافه کنید.
