import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const listBooks = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [{ data: books, error }, { count }] = await Promise.all([
    supabase.from("books").select("*").order("category").order("title"),
    supabase.from("articles").select("*", { count: "exact", head: true }),
  ]);
  if (error) throw new Error(error.message);
  return { books: books ?? [], totalArticles: count ?? 0 };
});

export const getBook = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ sourceId: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: book } = await supabase
      .from("books")
      .select("*")
      .eq("source_id", data.sourceId)
      .maybeSingle();
    const { data: articles } = await supabase
      .from("articles")
      .select("*")
      .eq("book_source_id", data.sourceId)
      .order("order_index");
    const { data: regulations } = await supabase
      .from("article_regulations")
      .select("*")
      .in("article_source_id", (articles ?? []).map((article) => article.source_id).slice(0, 800));
    return { book: book ?? null, articles: articles ?? [], regulations: regulations ?? [] };
  });

export const searchArticles = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ q: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const term = data.q.trim().slice(0, 120);
    if (term.length < 2) return { results: [] };
    const supabase = publicClient();
    const { data: results, error } = await supabase
      .from("articles")
      .select("source_id, book_source_id, title, label, chapter, url, content")
      .or(`title.ilike.%${term}%,content.ilike.%${term}%`)
      .limit(60);
    if (error) throw new Error(error.message);
    return { results: results ?? [] };
  });

export const syncBooks = createServerFn({ method: "POST" }).handler(async () => {
  const { fetchBookIndex, isTaxRelated } = await import("./hy-scrape.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const all = await fetchBookIndex();
  const taxBooks = all.filter(isTaxRelated);
  if (taxBooks.length === 0) throw new Error("هیچ کتاب مالیاتی در فهرست منبع پیدا نشد.");

  const { error } = await supabaseAdmin.from("books").upsert(
    taxBooks.map((book) => ({
      source_id: book.sourceId,
      title: book.title,
      url: book.url,
      category: book.category,
    })),
    { onConflict: "source_id" },
  );
  if (error) throw new Error(error.message);
  return { found: all.length, saved: taxBooks.length };
});

export const scrapeBook = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sourceId: z.string(), batchSize: z.number().int().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { fetchBookArticles, fetchArticleDetail, mapWithConcurrency } = await import(
      "./hy-scrape.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const batchSize = Math.min(Math.max(data.batchSize ?? 20, 1), 40);

    const toc = await fetchBookArticles(data.sourceId);
    if (toc.length === 0) return { total: 0, scraped: 0, remaining: 0 };

    await supabaseAdmin.from("articles").upsert(
      toc.map((article) => ({
        source_id: article.sourceId,
        book_source_id: data.sourceId,
        title: article.label,
        label: article.label,
        chapter: article.chapter,
        url: article.url,
        order_index: article.orderIndex,
      })),
      { onConflict: "source_id" },
    );

    const { data: pending } = await supabaseAdmin
      .from("articles")
      .select("source_id")
      .eq("book_source_id", data.sourceId)
      .is("scraped_at", null)
      .order("order_index")
      .limit(batchSize);

    const batch = pending ?? [];
    let scraped = 0;

    await mapWithConcurrency(batch, 4, async (row) => {
      try {
        const detail = await fetchArticleDetail(row.source_id);
        await supabaseAdmin
          .from("articles")
          .update({
            title: detail.title,
            content: detail.content,
            scraped_at: new Date().toISOString(),
          })
          .eq("source_id", row.source_id);

        if (detail.regulations.length > 0) {
          await supabaseAdmin.from("article_regulations").upsert(
            detail.regulations.map((regulation) => ({
              article_source_id: row.source_id,
              kind: regulation.kind,
              number: regulation.number,
              reg_date: regulation.regDate,
              subject: regulation.subject,
            })),
            { onConflict: "article_source_id,kind,number,subject", ignoreDuplicates: true },
          );
        }
        scraped += 1;
      } catch (error) {
        console.error("scrape article failed", row.source_id, error);
      }
    });

    const { count: remaining } = await supabaseAdmin
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("book_source_id", data.sourceId)
      .is("scraped_at", null);

    await supabaseAdmin
      .from("books")
      .update({ articles_count: toc.length, scraped_at: new Date().toISOString() })
      .eq("source_id", data.sourceId);

    return { total: toc.length, scraped, remaining: remaining ?? 0 };
  });

/* ---------------------------- بخشنامه‌ها ---------------------------- */

export const listCirculars = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().optional(), page: z.number().int().min(0).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const page = data.page ?? 0;
    const size = 30;
    let query = supabase
      .from("circulars")
      .select("source_id, kind, number, reg_date, subject, url, status, issuer, scraped_at", {
        count: "exact",
      });
    const term = (data.q ?? "").trim().slice(0, 120);
    if (term.length > 1) {
      query = query.or(`subject.ilike.%${term}%,number.ilike.%${term}%,content.ilike.%${term}%`);
    }
    const { data: rows, count, error } = await query
      .order("reg_date", { ascending: false, nullsFirst: false })
      .range(page * size, page * size + size - 1);
    if (error) throw new Error(error.message);
    return { circulars: rows ?? [], total: count ?? 0, page, size };
  });

export const getCircular = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ sourceId: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: circular } = await supabase
      .from("circulars")
      .select("*")
      .eq("source_id", data.sourceId)
      .maybeSingle();
    return { circular: circular ?? null };
  });

/** فهرست بخشنامه‌ها را با صفحه‌بندی r از moghar_list دریافت و ذخیره می‌کند. */
export const syncCircularList = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ term: z.string().optional(), maxPages: z.number().int().min(1).max(400).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { fetchAllCircularRows, CIRCULAR_QUERY_TERMS } = await import("./hy-scrape.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const terms = data.term ? [data.term] : CIRCULAR_QUERY_TERMS;
    let saved = 0;

    for (const term of terms) {
      const rows = await fetchAllCircularRows(term, { maxPages: data.maxPages ?? 200 });
      if (rows.length === 0) continue;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabaseAdmin.from("circulars").upsert(
          chunk.map((row) => ({
            source_id: row.sourceId,
            kind: row.kind,
            number: row.number,
            reg_date: row.regDate,
            subject: row.subject,
            url: row.url,
            query_term: term,
          })),
          { onConflict: "source_id", ignoreDuplicates: false },
        );
        if (error) throw new Error(error.message);
        saved += chunk.length;
      }
    }

    const { count } = await supabaseAdmin
      .from("circulars")
      .select("*", { count: "exact", head: true });
    return { saved, total: count ?? 0 };
  });

/** متن کامل بخشنامه‌های ذخیره‌نشده را دسته‌ای استخراج می‌کند. */
export const scrapeCirculars = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ batchSize: z.number().int().min(1).max(40).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { fetchCircularDetail, mapWithConcurrency } = await import("./hy-scrape.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const batchSize = data.batchSize ?? 20;

    const { data: pending } = await supabaseAdmin
      .from("circulars")
      .select("source_id")
      .is("scraped_at", null)
      .limit(batchSize);

    const batch = pending ?? [];
    let scraped = 0;

    await mapWithConcurrency(batch, 4, async (row) => {
      try {
        const detail = await fetchCircularDetail(row.source_id);
        await supabaseAdmin
          .from("circulars")
          .update({
            ...(detail.title ? { subject: detail.title } : {}),
            content: detail.content,
            ...(detail.number ? { number: detail.number } : {}),
            ...(detail.regDate ? { reg_date: detail.regDate } : {}),
            scraped_at: new Date().toISOString(),
          })
          .eq("source_id", row.source_id);
        scraped += 1;
      } catch (error) {
        console.error("scrape circular failed", row.source_id, error);
      }
    });

    const { count: remaining } = await supabaseAdmin
      .from("circulars")
      .select("*", { count: "exact", head: true })
      .is("scraped_at", null);

    return { scraped, remaining: remaining ?? 0 };
  });
