CREATE TABLE public.circulars (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id text NOT NULL UNIQUE,
  kind text,
  number text,
  reg_date text,
  subject text,
  content text,
  url text NOT NULL,
  query_term text,
  scraped_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.circulars TO anon;
GRANT SELECT ON public.circulars TO authenticated;
GRANT ALL ON public.circulars TO service_role;

ALTER TABLE public.circulars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circulars are publicly readable" ON public.circulars FOR SELECT USING (true);

CREATE INDEX idx_circulars_number ON public.circulars (number);
CREATE INDEX idx_circulars_scraped_at ON public.circulars (scraped_at);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_circulars_updated_at BEFORE UPDATE ON public.circulars FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();