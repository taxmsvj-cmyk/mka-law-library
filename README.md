# کتابخانه حقوقی MKA

وب‌اپلیکیشن مرور و جست‌وجوی متون قانونی: کتاب‌ها و مواد قانونی، بخشنامه‌ها و
مقررات مرتبط، با جست‌وجوی متنی و خروجی PDF.

ساخته‌شده با TanStack Start (React 19 + Vite) و Tailwind CSS، با پایگاه داده
Supabase (PostgreSQL).

---

## پیش‌نیازها

- [Bun](https://bun.sh) نسخه ۱ یا بالاتر
- یک پروژه Supabase (برای داده‌ها)

## نصب و اجرای محلی

```bash
# ۱) دریافت کد
git clone https://github.com/taxmsvj-cmyk/mka-law-library.git
cd mka-law-library

# ۲) نصب وابستگی‌ها
bun install

# ۳) تنظیم متغیرهای محیطی
cp .env.example .env
#   مقادیر را از داشبورد Supabase → Project Settings → API بردارید

# ۴) اجرای محیط توسعه
bun run dev        # http://localhost:8080
```

### دستورهای موجود

| دستور | کار |
| --- | --- |
| `bun run dev` | اجرای سرور توسعه |
| `bun run build` | ساخت نسخه تولید |
| `bun run preview` | پیش‌نمایش نسخه ساخته‌شده |
| `bun run lint` | بررسی کیفیت کد با ESLint |
| `bun run format` | قالب‌بندی کد با Prettier |
| `bunx tsc --noEmit` | بررسی نوع‌ها (TypeScript) |

## متغیرهای محیطی

نمونه کامل در [`.env.example`](.env.example) است. فایل `.env` واقعی در مخزن
نگهداری نمی‌شود و در `.gitignore` قرار دارد. متغیرهای `VITE_*` در مرورگر قابل
مشاهده‌اند، پس فقط کلید عمومی (publishable) را در آن‌ها بگذارید؛ کلید
`service_role` تنها سمت سرور استفاده می‌شود.

## پایگاه داده

ساختار جدول‌ها و مراحل اجرای مهاجرت‌ها در [`docs/DATABASE.md`](docs/DATABASE.md)
توضیح داده شده است.

## استقرار

راهنمای اتصال مخزن به Vercel (یا Netlify) و به‌روزرسانی خودکار با هر push در
[`DEPLOY.md`](DEPLOY.md) آمده است.

## یکپارچگی پیوسته (CI)

با هر push و هر Pull Request، workflow موجود در
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) این مراحل را اجرا می‌کند:
نصب وابستگی‌ها، ESLint، بررسی نوع‌ها و ساخت پروژه.

## ساختار پوشه‌ها

```text
.
├── .github/workflows/     # اتوماسیون GitHub Actions (CI)
├── docs/                  # مستندات پروژه (پایگاه داده، دستورالعمل‌ها)
├── public/                # فایل‌های ایستا (favicon، robots.txt)
├── supabase/
│   ├── config.toml        # تنظیمات پروژه Supabase
│   └── migrations/        # مهاجرت‌های SQL به ترتیب زمانی
├── src/
│   ├── routes/            # صفحه‌ها (مسیریابی بر پایه فایل)
│   │   ├── __root.tsx     # چیدمان کلی و <head> مشترک
│   │   ├── index.tsx      # صفحه خانه و جست‌وجو
│   │   ├── books.$sourceId.tsx      # نمایش یک کتاب و مواد آن
│   │   ├── circulars.index.tsx      # فهرست بخشنامه‌ها
│   │   └── circulars.$sourceId.tsx  # جزئیات یک بخشنامه
│   ├── components/        # کامپوننت‌های رابط کاربری
│   │   ├── PdfButton.tsx  # خروجی PDF
│   │   └── ui/            # کتابخانه کامپوننت‌های پایه (shadcn/ui)
│   ├── lib/
│   │   ├── library.functions.ts  # توابع سرور: خواندن کتاب‌ها، مواد، جست‌وجو
│   │   ├── hy-scrape.server.ts   # برداشت داده از منبع بیرونی (فقط سرور)
│   │   └── utils.ts              # ابزارهای کمکی
│   ├── integrations/supabase/    # کلاینت‌ها و تایپ‌های پایگاه داده
│   ├── hooks/             # هوک‌های React
│   ├── styles.css         # تم و توکن‌های طراحی Tailwind
│   ├── router.tsx         # پیکربندی روتر
│   ├── server.ts          # ورودی سمت سرور (SSR)
│   └── routeTree.gen.ts   # تولید خودکار — دستی ویرایش نشود
├── vite.config.ts         # پیکربندی ساخت
└── vercel.json            # تنظیمات استقرار
```

> نکته: فایل‌های `*.server.ts` و توابع داخل `createServerFn` فقط روی سرور اجرا
> می‌شوند و در باندل مرورگر قرار نمی‌گیرند.
