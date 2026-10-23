# راهنمای اعمال تغییرات — جایگزینی منبع همراه‌یار با مخزن Google Drive

**تاریخ:** ۱۴۰۴/۰۸/۰۲ — **دامنه:** mka-law-library (نسخه‌ی مستقل Vercel) و apps/mka-core (مونوریپو)

---

## ۱. خلاصه‌ی تغییرات

| مورد | قبل | بعد |
|------|-----|-----|
| منبع داده‌ی قوانین | اسکرپر سایت hamrahyaar.com | مخزن اختصاصی Google Drive سازمان |
| فایل اسکرپر | `src/lib/hy-scrape.server.ts` | **حذف شد** |
| ماژول منبع جدید | — | `src/lib/gdrive-source.server.ts` |
| منابع رسمی دولتی | — | `src/lib/official-sources.server.ts` — **فقط با اجازه‌ی مالک** |
| جدول ایندکس اسناد | — | `drive_documents` (مهاجرت جدید SQL) |
| استخراج متن PDF | — | کتابخانه `unpdf` (pdf.js) + شناسایی PDFهای بدساخت → needs-ocr |

**سیاست جدید منبع داده (طبق دستور مالک):**

1. داده فقط از مخزن Google Drive همگام‌سازی می‌شود:
   `https://drive.google.com/drive/folders/1Jx0cipUqQyGnJk4hFCURzWIg1Abo1Del`
2. هیچ درخواستی به سایت‌های ثالث (از جمله همراه‌یار) زده نمی‌شود.
3. در صورت نبود سند یا تأییدیه در مخزن، مراجعه به سایت‌های رسمی
   (tax.gov.ir، rc.majlis.ir، qavanin.ir، rooznamehrasmi.ir) فقط پس از مشورت با
   مالک و با اجازه‌ی او — از مسیر پرچم `OFFICIAL_FALLBACK_APPROVED=true` در Vercel —
   ممکن می‌شود. پیش‌فرض: **بسته** و توابع واکشی خطای راهنما برمی‌گردانند.
4. لینک‌های پیشنهادی جستجوی رسمی (بدون واکشی خودکار) همیشه در دسترس‌اند
   (`officialSearchLinks` در `official-sources.server.ts`).

---

## ۲. اعمال تغییرات — دو روش

### روش الف) کپی فایل‌ها (ساده‌ترین)

1. داخل پوشه‌ی `mka-law-library/` همین بسته، همه‌ی فایل‌ها را با حفظ مسیر، روی مخزن
   `mka-law-library` کپی کنید (جایگزین شوند):
   - `src/lib/gdrive-source.server.ts` *(جدید)*
   - `src/lib/official-sources.server.ts` *(جدید)*
   - `src/lib/library.functions.ts` *(بازنویسی)*
   - `src/routes/index.tsx` *(متن UI)*
   - `src/integrations/supabase/types.ts` *(تایپ جدول جدید)*
   - `supabase/migrations/20261024080000_drive_documents.sql` *(جدید)*
   - `.env.example` ، `package.json` ، `bun.lock` ، `README.md` ، `docs/01_DIRECTIVES.md`
2. **این فایل را دستی حذف کنید:** `src/lib/hy-scrape.server.ts`
3. برای مونوریپو، همین کار را با پوشه‌ی `mousavitax-platform/apps/mka-core/` انجام دهید
   (حذف `apps/mka-core/src/lib/hy-scrape.server.ts` را فراموش نکنید).

### روش ب) پچ گیت

```bash
# در ریشه‌ی کلون mka-law-library:
git apply --stat mka-law-library.patch      # پیش‌نمایش
git apply mka-law-library.patch
rm -f src/lib/hy-scrape.server.ts           # حذف اسکرپر قدیمی (پچ شامل حذف نمی‌شود)

# در ریشه‌ی کلون mousavitax-platform:
git apply mousavitax-mka-core.patch
rm -f apps/mka-core/src/lib/hy-scrape.server.ts
```

سپس:

```bash
bun install        # افزودن unpdf
bun run build      # بیلد — باید بدون خطا تمام شود
bunx tsc --noEmit  # تایپ‌چک — صفر خطا
```

---

## ۳. مهاجرت دیتابیس (Supabase)

فایل `supabase/migrations/20261024080000_drive_documents.sql` را در
**Supabase Dashboard → SQL Editor** اجرا کنید (یا با supabase CLI اعمال کنید).
این مهاجرت:

- جدول `drive_documents` را می‌سازد (متادیتا + متن استخراج‌شده + وضعیت)
- RLS فقط-خواندنی عمومی مطابق بقیه‌ی جداول تنظیم می‌کند
- ایندکس‌های trigram برای جستجو روی نام و محتوا می‌سازد

> اگر جدول `drive_documents` قبلاً به‌صورت دستی ساخته شده (مانند محیط mka-core)،
> مهاجرت به‌خاطر `IF NOT EXISTS` بی‌ضرر اجرا می‌شود؛ فقط ستون‌های
> `root_id`، `root_name`، `drive_url` و `extraction_status` در صورت نبود، اضافه
> نمی‌شوند — در این صورت این ستون‌ها را با یک `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` دستی اضافه کنید.

---

## ۴. متغیرهای محیطی (Vercel → Settings → Environment Variables)

| متغیر | الزامی | توضیح |
|-------|--------|-------|
| `GDRIVE_ROOT_FOLDER_ID` | خیر | پیش‌فرض همان مخزن رسمی سازمان است (`1Jx0cipUqQyGnJk4hFCURzWIg1Abo1Del`) |
| `GOOGLE_DRIVE_API_KEY` | توصیه‌شده | کلید API گوگل — بدون آن از «نمای عمومی پوشه» استفاده می‌شود (کار می‌کند ولی کندتر و بدون متادیتای کامل) |
| `OFFICIAL_FALLBACK_APPROVED` | خیر | **پیش‌فرض بسته.** فقط پس از مشورت با مالک و اجازه‌ی او `true` شود |

### ساخت کلید Google API (اختیاری ولی توصیه‌شده — ۵ دقیقه)

1. وارد https://console.cloud.google.com شوید → پروژه‌ی جدید یا موجود
2. **APIs & Services → Library** → «Google Drive API» → **Enable**
3. **Credentials → Create Credentials → API key**
4. روی کلید → **Restrict key** → فقط «Google Drive API»
5. در Vercel متغیر `GOOGLE_DRIVE_API_KEY` را با مقدار کلید ثبت → **Redeploy**

> نکته: کلید API فقط برای خواندن پوشه‌ی **عمومی** کافی است؛ نیازی به OAuth و
> Service Account نیست و این کلید محرمانه نیست (باز هم Restrict کنید).

---

## ۵. گردش کار پس از استقرار

1. صفحه‌ی اصلی نرم‌افزار → دکمه‌ی **«۱) همگام‌سازی مخزن Drive»**
   → کل درخت مخزن پیمایش و در `drive_documents` / `books` / `articles` ایندکس می‌شود
   (۱۷ قانون سطح‌بالا و بیش از ۱۳۰۰ سند شناسایی شد).
2. دکمه‌ی **«۲) استخراج متن کامل همه قوانین»** → متن اسناد متنی و PDFهای دارای لایه‌ی
   متن استخراج و در جستجوی متن کامل قرار می‌گیرد. اسناد اسکن‌شده (JPG/PDF بدون لایه‌ی
   متن) با وضعیت `needs-ocr` علامت می‌خورند و لینک مشاهده‌ی مستقیم Drive دارند.
3. صفحه‌ی بخشنامه‌ها → «همگام‌سازی» → همه‌ی اسنادی که نام/مسیرشان «بخشنامه» دارد
   (۹۰ مورد شناسایی شد) به آرشیو بخشنامه‌ها اضافه می‌شود.

## ۶. یادداشت‌های فنی

- **حالت بدون کلید (فعلاً):** پیمایش از نمای عمومی پوشه انجام می‌شود؛ سرعت محدود
  (~۵۰ پوشه در دقیقه) و اسناد گوگل (Sheets) قابل صادرات نیستند. با کلید API همه‌چیز
  سریع‌تر و کامل‌تر می‌شود.
- **PDF فارسی بدساخت:** برخی PDFها متن جدا‌شده (presentation forms) دارند؛ ماژول این را
  تشخیص می‌دهد و به‌جای ذخیره‌ی متن بی‌ارزش، `needs-ocr` ثبت می‌کند. برای OCR واقعی
  می‌توان بعداً سرویس هوش مصنوعی (مانند پیاده‌سازی drive-sync در mka-core) به این
  نقطه وصل کرد — نقطه‌ی اتصال: تابع `extractDriveText`.
- **امنیت:** تابع `fetchOfficialPageText` دو لایه حفاظت دارد: گیت اجازه‌ی مالک +
  لیست سفید دامنه‌های رسمی (ضد SSRF). هیچ کلید محرمانه‌ای در ماژول‌های جدید استفاده
  نمی‌شود.
- `mapWithConcurrency` (همان رفتار مودبانه‌ی قبلی) حفظ شده؛ واکشی هم‌زمان حداکثر ۴ سند.
