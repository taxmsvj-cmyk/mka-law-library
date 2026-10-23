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

/* ------------------------------------------------------------------ */
/* خواندن کتابخانه                                                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* همگام‌سازی از مخزن Google Drive (جایگزین اسکرپر همراه‌یار)          */
/* ------------------------------------------------------------------ */

/**
 * کل مخزن Google Drive سازمان را پیمایش و ایندکس می‌کند:
 *   ۱) هر فایل → جدول drive_documents (متادیتا + وضعیت استخراج متن)
 *   ۲) هر پوشه/فایل سطح‌بالای قانونی → جدول books
 *   ۳) هر فایل داخل هر قانون → جدول articles (برای جستجوی متن کامل)
 */
export const syncBooks = createServerFn({ method: "POST" }).handler(async () => {
  const {
    walkDriveTree,
    cleanTitle,
    driveViewUrl,
    isLibraryBook,
    DRIVE_PREFIX,
  } = await import("./gdrive-source.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const nodes = await walkDriveTree();
  if (nodes.length === 0) {
    throw new Error(
      "مخزن Google Drive خوانده نشد. مطمئن شوید پوشه به اشتراک گذاشته شده و در دسترس است.",
    );
  }
  const files = nodes.filter((node) => !node.isFolder);

  // ۱) ایندکس کامل متادیتا در drive_documents
  const docRows = files.map((file) => ({
    id: file.id,
    name: file.name,
    folder_path: file.folderPath || null,
    root_id: file.rootId || null,
    root_name: file.rootName || null,
    mime_type: file.mimeType,
    size: file.size,
    modified_time: file.modifiedTime,
    drive_url: driveViewUrl(file.id),
    synced_at: new Date().toISOString(),
  }));
  for (let i = 0; i < docRows.length; i += 500) {
    const { error } = await supabaseAdmin
      .from("drive_documents")
      .upsert(docRows.slice(i, i + 500), { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  // ۲) کتاب‌ها: موارد سطح‌بالای مخزن (پوشه‌های قوانین و اسناد مستقل)
  const topLevel = nodes.filter(isLibraryBook);
  const bookRows = topLevel.map((node) => ({
    source_id: DRIVE_PREFIX + node.id,
    title: cleanTitle(node.name),
    url: driveViewUrl(node.id, node.isFolder),
    category: "مخزن اسناد Google Drive",
  }));
  for (let i = 0; i < bookRows.length; i += 500) {
    const { error } = await supabaseAdmin
      .from("books")
      .upsert(bookRows.slice(i, i + 500), { onConflict: "source_id" });
    if (error) throw new Error(error.message);
  }

  // ۳) مواد/اسناد هر قانون
  const articleRows: Array<{
    source_id: string;
    book_source_id: string;
    title: string;
    label: string;
    chapter: string | null;
    url: string;
    order_index: number;
  }> = [];
  for (const node of topLevel) {
    const children = node.isFolder
      ? files.filter((file) => file.rootId === node.id && file.id !== node.id)
      : [node];
    children.forEach((file, index) => {
      const chapter = file.folderPath
        ? file.folderPath.split(" / ").slice(1).join(" / ").trim() || null
        : null;
      articleRows.push({
        source_id: DRIVE_PREFIX + file.id,
        book_source_id: DRIVE_PREFIX + node.id,
        title: cleanTitle(file.name),
        label: cleanTitle(file.name),
        chapter,
        url: driveViewUrl(file.id),
        order_index: index,
      });
    });
  }
  for (let i = 0; i < articleRows.length; i += 500) {
    const { error } = await supabaseAdmin
      .from("articles")
      .upsert(articleRows.slice(i, i + 500), { onConflict: "source_id" });
    if (error) throw new Error(error.message);
  }

  // ۴) شمارش اسناد هر کتاب
  const counts = new Map<string, number>();
  for (const row of articleRows) {
    counts.set(row.book_source_id, (counts.get(row.book_source_id) ?? 0) + 1);
  }
  await Promise.all(
    [...counts.entries()].map(([sourceId, count]) =>
      supabaseAdmin.from("books").update({ articles_count: count }).eq("source_id", sourceId),
    ),
  );

  return {
    found: nodes.length,
    indexed: files.length,
    books: bookRows.length,
    articles: articleRows.length,
  };
});

/**
 * استخراج متن دسته‌ای اسناد یک قانون از مخزن Drive و ذخیره در articles
 * (و همگام‌سازی با drive_documents برای جستجو).
 */
export const scrapeBook = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sourceId: z.string(), batchSize: z.number().int().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const {
      downloadDriveFile,
      extractDriveText,
      mapWithConcurrency,
      DRIVE_PREFIX,
    } = await import("./gdrive-source.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const batchSize = Math.min(Math.max(data.batchSize ?? 20, 1), 40);

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
        const fileId = row.source_id.startsWith(DRIVE_PREFIX)
          ? row.source_id.slice(DRIVE_PREFIX.length)
          : row.source_id;
        const { data: doc } = await supabaseAdmin
          .from("drive_documents")
          .select("name, mime_type")
          .eq("id", fileId)
          .maybeSingle();
        const mime = doc?.mime_type ?? "";
        const res = await downloadDriveFile(fileId, mime);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const { text, status } = await extractDriveText(doc?.name ?? fileId, mime, bytes);
        const stored = text.slice(0, 200_000) || null;
        await supabaseAdmin
          .from("articles")
          .update({ content: stored, scraped_at: new Date().toISOString() })
          .eq("source_id", row.source_id);
        await supabaseAdmin
          .from("drive_documents")
          .update({ content: stored, extraction_status: status })
          .eq("id", fileId);
        scraped += 1;
      } catch (error) {
        console.error("drive article extract failed", row.source_id, error);
      }
    });

    const [{ count: total }, { count: remaining }] = await Promise.all([
      supabaseAdmin
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("book_source_id", data.sourceId),
      supabaseAdmin
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("book_source_id", data.sourceId)
        .is("scraped_at", null),
    ]);

    await supabaseAdmin
      .from("books")
      .update({ scraped_at: new Date().toISOString() })
      .eq("source_id", data.sourceId);

    return { total: total ?? 0, scraped, remaining: remaining ?? 0 };
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

/**
 * فهرست بخشنامه‌ها را از مخزن Google Drive می‌سازد — هر سندی که نام یا
 * مسیرش حاوی «بخشنامه» باشد (یا با عبارت داده‌شده مطابقت کند).
 */
export const syncCircularList = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ term: z.string().optional(), maxPages: z.number().int().min(1).max(400).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const {
      walkDriveTree,
      cleanTitle,
      driveViewUrl,
      isCircularLike,
      normalizeDigits,
      DRIVE_PREFIX,
    } = await import("./gdrive-source.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const nodes = await walkDriveTree();
    let candidates = nodes.filter(isCircularLike);
    const term = (data.term ?? "").trim();
    if (term.length > 1) {
      candidates = candidates.filter((node) => `${node.name} ${node.folderPath}`.includes(term));
    }

    let saved = 0;
    if (candidates.length > 0) {
      const rows = candidates.map((node) => {
        const normalized = normalizeDigits(node.name);
        const number =
          /(?:شماره|ش\.|نامه)?\s*([0-9]{2,10}(?:\s*[-/]\s*[0-9]{1,6})*)/.exec(normalized)?.[1]
            ?.replace(/\s+/g, "") ?? null;
        const regDate =
          /\b(1[34][0-9]{2})[/\-.](0?[1-9]|1[0-2])[/\-.](0?[1-9]|[12][0-9]|3[01])\b/.exec(normalized)?.[0]?.replace(/[.\-]/g, "/") ?? null;
        return {
          source_id: DRIVE_PREFIX + node.id,
          kind: "بخشنامه",
          number,
          reg_date: regDate,
          subject: cleanTitle(node.name),
          url: driveViewUrl(node.id),
          query_term: "drive",
        };
      });
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabaseAdmin
          .from("circulars")
          .upsert(rows.slice(i, i + 500), { onConflict: "source_id" });
        if (error) throw new Error(error.message);
        saved += Math.min(500, rows.length - i);
      }
    }

    const { count } = await supabaseAdmin
      .from("circulars")
      .select("*", { count: "exact", head: true });
    return { saved, total: count ?? 0 };
  });

/** استخراج متن کامل بخشنامه‌های ذخیره‌نشده از مخزن Drive. */
export const scrapeCirculars = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ batchSize: z.number().int().min(1).max(40).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const {
      downloadDriveFile,
      extractDriveText,
      mapWithConcurrency,
      DRIVE_PREFIX,
    } = await import("./gdrive-source.server");
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
        const fileId = row.source_id.startsWith(DRIVE_PREFIX)
          ? row.source_id.slice(DRIVE_PREFIX.length)
          : row.source_id;
        const { data: doc } = await supabaseAdmin
          .from("drive_documents")
          .select("name, mime_type")
          .eq("id", fileId)
          .maybeSingle();
        const mime = doc?.mime_type ?? "";
        const res = await downloadDriveFile(fileId, mime);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const { text, status } = await extractDriveText(doc?.name ?? fileId, mime, bytes);
        const stored = text.slice(0, 200_000) || null;
        await supabaseAdmin
          .from("circulars")
          .update({ content: stored, scraped_at: new Date().toISOString() })
          .eq("source_id", row.source_id);
        await supabaseAdmin
          .from("drive_documents")
          .update({ content: stored, extraction_status: status })
          .eq("id", fileId);
        scraped += 1;
      } catch (error) {
        console.error("drive circular extract failed", row.source_id, error);
      }
    });

    const { count: remaining } = await supabaseAdmin
      .from("circulars")
      .select("*", { count: "exact", head: true })
      .is("scraped_at", null);

    return { scraped, remaining: remaining ?? 0 };
  });

/* ---------------------------- وضعیت مخزن ---------------------------- */

/** وضعیت اتصال و پیشرفت ایندکس مخزن Drive — برای نمایش در پنل همگام‌سازی. */
export const getDriveStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { driveMode, DRIVE_ROOT_FOLDER } = await import("./gdrive-source.server");
  const supabase = publicClient();
  const [indexed, extracted, needsOcr] = await Promise.all([
    supabase.from("drive_documents").select("*", { count: "exact", head: true }),
    supabase
      .from("drive_documents")
      .select("*", { count: "exact", head: true })
      .not("content", "is", null),
    supabase
      .from("drive_documents")
      .select("*", { count: "exact", head: true })
      .eq("extraction_status", "needs-ocr"),
  ]);
  return {
    mode: driveMode(),
    rootFolder: DRIVE_ROOT_FOLDER,
    indexed: indexed.count ?? 0,
    extracted: extracted.count ?? 0,
    needsOcr: needsOcr.count ?? 0,
  };
});
