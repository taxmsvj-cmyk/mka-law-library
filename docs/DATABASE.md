# پایگاه داده و مهاجرت‌ها

پایگاه داده روی Supabase (PostgreSQL) است. همه جدول‌ها در اسکیمای `public` هستند،
RLS روی همه فعال است و فقط خواندن عمومی مجاز است؛ نوشتن تنها با کلید `service_role`
(اسکرپر سمت سرور) انجام می‌شود.

## جدول‌ها

### `books` — فهرست کتاب‌ها/قوانین

| ستون | نوع | توضیح |
| --- | --- | --- |
| `id` | uuid | کلید اصلی |
| `source_id` | text (unique) | شناسه در منبع اصلی؛ در آدرس صفحه استفاده می‌شود |
| `title` | text | عنوان کتاب/قانون |
| `url` | text | نشانی صفحه منبع |
| `category` | text | دسته‌بندی |
| `articles_count` | int | تعداد مواد |
| `scraped_at` | timestamptz | آخرین برداشت اطلاعات |
| `created_at` | timestamptz | زمان ایجاد |

### `articles` — مواد قانونی هر کتاب

| ستون | نوع | توضیح |
| --- | --- | --- |
| `id` | uuid | کلید اصلی |
| `source_id` | text (unique) | شناسه ماده |
| `book_source_id` | text | ارجاع به `books.source_id` |
| `title`, `label`, `chapter` | text | عنوان، برچسب و فصل |
| `url` | text | نشانی منبع |
| `content` | text | متن ماده (ایندکس `pg_trgm` برای جست‌وجو) |
| `order_index` | int | ترتیب نمایش |
| `scraped_at`, `created_at` | timestamptz | زمان‌ها |

ایندکس‌ها: `articles_book_idx (book_source_id, order_index)`،
`articles_content_trgm_idx` (GIN/trigram برای جست‌وجوی متنی).

### `article_regulations` — مقررات مرتبط با هر ماده

| ستون | نوع | توضیح |
| --- | --- | --- |
| `id` | uuid | کلید اصلی |
| `article_source_id` | text | ارجاع به `articles.source_id` |
| `kind`, `number`, `reg_date`, `subject` | text | نوع، شماره، تاریخ و موضوع |

کلید یکتای ترکیبی: `(article_source_id, kind, number, subject)`.

### `circulars` — بخشنامه‌ها

| ستون | نوع | توضیح |
| --- | --- | --- |
| `id` | uuid | کلید اصلی |
| `source_id` | text (unique) | شناسه بخشنامه |
| `kind`, `number`, `reg_date`, `subject` | text | نوع، شماره، تاریخ، موضوع |
| `content` | text | متن کامل |
| `url`, `query_term` | text | نشانی و عبارت جست‌وجوی برداشت |
| `issuer`, `status`, `related_articles`, `interpretation`, `source_name` | text | فیلدهای تکمیلی |
| `scraped_at`, `created_at`, `updated_at` | timestamptz | زمان‌ها (`updated_at` با تریگر به‌روز می‌شود) |

ایندکس‌ها: `idx_circulars_number`، `idx_circulars_scraped_at`.

## مهاجرت‌ها

فایل‌های SQL در `supabase/migrations/` به ترتیب زمانی اجرا می‌شوند:

1. `20260809200734_*.sql` — ساخت `books`، `articles`، `article_regulations` + دسترسی‌ها و RLS
2. `20260809200749_*.sql` — تکمیل همان مرحله
3. `20260810070655_*.sql` — ساخت `circulars` + تریگر `updated_at`
4. `20260912125736_*.sql` — افزودن ستون‌های تکمیلی به `circulars`

## راه‌اندازی یک پایگاه داده تازه

با Supabase CLI:

```bash
supabase link --project-ref <project-ref>
supabase db push          # اجرای همه مهاجرت‌ها به ترتیب
```

یا بدون CLI: در داشبورد Supabase به بخش SQL Editor بروید و محتوای هر چهار فایل را
به همان ترتیب بالا اجرا کنید.

## افزودن مهاجرت جدید

فایل تازه‌ای با نام `supabase/migrations/<YYYYMMDDHHMMSS>_<توضیح>.sql` بسازید.
برای هر جدول جدید در `public` حتماً بعد از `CREATE TABLE` این ترتیب را رعایت کنید:
`GRANT` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`.
