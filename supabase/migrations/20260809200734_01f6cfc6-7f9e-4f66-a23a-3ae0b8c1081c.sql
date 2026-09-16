CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL UNIQUE,
  title text NOT NULL,
  url text NOT NULL,
  category text,
  articles_count integer NOT NULL DEFAULT 0,
  scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.books TO anon;
GRANT SELECT ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Books are publicly readable" ON public.books;
CREATE POLICY "Books are publicly readable" ON public.books FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL UNIQUE,
  book_source_id text NOT NULL,
  title text NOT NULL,
  label text,
  chapter text,
  url text NOT NULL,
  content text,
  order_index integer NOT NULL DEFAULT 0,
  scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS articles_book_idx ON public.articles (book_source_id, order_index);
CREATE INDEX IF NOT EXISTS articles_content_trgm_idx ON public.articles USING gin (content public.gin_trgm_ops);
GRANT SELECT ON public.articles TO anon;
GRANT SELECT ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Articles are publicly readable" ON public.articles;
CREATE POLICY "Articles are publicly readable" ON public.articles FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.article_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_source_id text NOT NULL,
  kind text,
  number text,
  reg_date text,
  subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_source_id, kind, number, subject)
);
CREATE INDEX IF NOT EXISTS article_regulations_article_idx ON public.article_regulations (article_source_id);
GRANT SELECT ON public.article_regulations TO anon;
GRANT SELECT ON public.article_regulations TO authenticated;
GRANT ALL ON public.article_regulations TO service_role;
ALTER TABLE public.article_regulations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Article regulations are publicly readable" ON public.article_regulations;
CREATE POLICY "Article regulations are publicly readable" ON public.article_regulations FOR SELECT USING (true);