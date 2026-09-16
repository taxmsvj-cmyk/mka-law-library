DROP INDEX IF EXISTS public.articles_content_trgm_idx;
DROP EXTENSION IF EXISTS pg_trgm;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
CREATE INDEX IF NOT EXISTS articles_content_trgm_idx ON public.articles USING gin (content extensions.gin_trgm_ops);