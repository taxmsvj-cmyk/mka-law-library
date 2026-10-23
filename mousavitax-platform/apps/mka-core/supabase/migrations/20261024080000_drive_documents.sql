-- جدول ایندکس مخزن Google Drive — جایگزین منبع همراه‌یار
-- هر فایل/پوشه‌ی مخزن اسناد مالیاتی مالک پروژه اینجا فهرست و متن‌کاوی می‌شود.

CREATE TABLE IF NOT EXISTS public.drive_documents (
  id text PRIMARY KEY,                       -- شناسه‌ی فایل Google Drive
  name text NOT NULL,
  folder_path text,                          -- مسیر پوشه‌ها از ریشه‌ی مخزن
  root_id text,                              -- شناسه‌ی پوشه‌ی سطح‌بالای ریشه
  root_name text,                            -- نام پوشه‌ی سطح‌بالای ریشه (قانون اصلی)
  mime_type text,
  size bigint,
  modified_time timestamptz,
  drive_url text NOT NULL DEFAULT '',        -- لینک مشاهده در Drive
  extraction_status text NOT NULL DEFAULT 'pending',
                                             -- pending | text | pdf-text | needs-ocr | binary | empty
  content text,                              -- متن استخراج‌شده (در صورت امکان)
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.drive_documents TO anon;
GRANT SELECT ON public.drive_documents TO authenticated;
GRANT ALL ON public.drive_documents TO service_role;

ALTER TABLE public.drive_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Drive documents are publicly readable" ON public.drive_documents;
CREATE POLICY "Drive documents are publicly readable" ON public.drive_documents FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS drive_documents_folder_idx ON public.drive_documents (root_id);
CREATE INDEX IF NOT EXISTS drive_documents_status_idx ON public.drive_documents (extraction_status);
CREATE INDEX IF NOT EXISTS drive_documents_name_trgm_idx
  ON public.drive_documents USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS drive_documents_content_trgm_idx
  ON public.drive_documents USING gin (content extensions.gin_trgm_ops);
