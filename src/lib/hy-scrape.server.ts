/**
 * Server-only scraper for hamrahyaar.com (قوانین و بخشنامه های مالیاتی).
 * Pure fetch + regex parsing so it runs inside the edge server runtime.
 */

const BASE = "https://hamrahyaar.com";

export type ScrapedBook = {
  sourceId: string;
  title: string;
  url: string;
  category: string | null;
};

export type ScrapedRegulation = {
  kind: string | null;
  number: string | null;
  regDate: string | null;
  subject: string | null;
};

export type ScrapedArticle = {
  sourceId: string;
  label: string;
  chapter: string | null;
  url: string;
  orderIndex: number;
};

export type ScrapedArticleDetail = {
  title: string;
  content: string;
  regulations: ScrapedRegulation[];
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  zwnj: "\u200c",
};

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => ENTITIES[name] ?? m);
}

function toText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchHtml(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(25_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "fa,en;q=0.8",
      },
    });
  } catch (cause) {
    throw new Error(
      `اتصال به منبع «همراه‌یار» برقرار نشد (${url}). این سرور به سایت منبع دسترسی ندارد یا سایت پاسخ نمی‌دهد؛ لطفاً بعداً دوباره تلاش کنید.`,
      { cause },
    );
  }
  if (!response.ok) {
    throw new Error(`دریافت صفحه ناموفق بود [${response.status}]: ${url}`);
  }
  return await response.text();
}

/** Library index: categories + every law/book link. */
export async function fetchBookIndex(): Promise<ScrapedBook[]> {
  const html = await fetchHtml(`${BASE}/books_cat`);
  const books: ScrapedBook[] = [];
  const seen = new Set<string>();
  const token = /<h6[^>]*>([\s\S]*?)<\/h6>|href="https:\/\/hamrahyaar\.com\/books\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  let category: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = token.exec(html)) !== null) {
    if (match[1] !== undefined) {
      const text = toText(match[1]).split("\n")[0]?.trim() ?? "";
      if (text) category = text;
      continue;
    }
    const sourceId = match[2]!;
    const title = toText(match[3] ?? "");
    if (!title || seen.has(sourceId)) continue;
    seen.add(sourceId);
    books.push({ sourceId, title, url: `${BASE}/books/${sourceId}`, category });
  }
  return books;
}

/** Book page: table of contents (chapters + articles). */
export async function fetchBookArticles(bookSourceId: string): Promise<ScrapedArticle[]> {
  const html = await fetchHtml(`${BASE}/books/${bookSourceId}`);
  const articles: ScrapedArticle[] = [];
  const seen = new Set<string>();
  const token = /<h6[^>]*>([\s\S]*?)<\/h6>|href="https:\/\/hamrahyaar\.com\/books\/mavad\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  let chapter: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = token.exec(html)) !== null) {
    if (match[1] !== undefined) {
      const text = toText(match[1]).replace(/\n+/g, " — ").trim();
      if (text) chapter = text;
      continue;
    }
    const sourceId = match[2]!;
    const label = toText(match[3] ?? "");
    if (!label || seen.has(sourceId)) continue;
    seen.add(sourceId);
    articles.push({
      sourceId,
      label,
      chapter,
      url: `${BASE}/books/mavad/${sourceId}`,
      orderIndex: articles.length,
    });
  }
  return articles;
}

function parseRegulations(html: string): ScrapedRegulation[] {
  const labels = new Map<string, string>();
  const labelRe = /id="(mog_\d+)-tab"[^>]*>([\s\S]*?)<\/button>/g;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = labelRe.exec(html)) !== null) {
    labels.set(labelMatch[1]!, toText(labelMatch[2] ?? "").replace(/^\d+\s*/, "").trim());
  }

  const regulations: ScrapedRegulation[] = [];
  const panelRe = /id="(mog_\d+)"[^>]*>([\s\S]*?)<\/table>/g;
  let panelMatch: RegExpExecArray | null;
  while ((panelMatch = panelRe.exec(html)) !== null) {
    const kind = labels.get(panelMatch[1]!) ?? null;
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(panelMatch[2] ?? "")) !== null) {
      const cells = [...(rowMatch[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) =>
        toText(cell[1] ?? ""),
      );
      if (cells.length < 3) continue;
      regulations.push({
        kind,
        number: cells[0] || null,
        regDate: cells[1] || null,
        subject: cells[2] || null,
      });
    }
  }
  return regulations;
}

/** Article page: full text, amendment history and related circulars. */
export async function fetchArticleDetail(articleSourceId: string): Promise<ScrapedArticleDetail> {
  const html = await fetchHtml(`${BASE}/books/mavad/${articleSourceId}`);

  const rawTitle = toText(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? "");
  const title = rawTitle.includes(" - ") ? rawTitle.split(" - ").slice(1).join(" - ").trim() : rawTitle;

  let main = "";
  const desIndex = html.indexOf('id="div_des"');
  if (desIndex !== -1) {
    const after = html.slice(html.indexOf(">", desIndex) + 1);
    const navIndex = after.indexOf('<div class="pb-3 mb-3">');
    main = toText(navIndex === -1 ? after.slice(0, 20000) : after.slice(0, navIndex));
  }

  const historyParts: string[] = [];
  const historyRe = /id="his_\d+_content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  let historyMatch: RegExpExecArray | null;
  while ((historyMatch = historyRe.exec(html)) !== null) {
    const text = toText(historyMatch[1] ?? "");
    if (text) historyParts.push(text);
  }

  const content = historyParts.length
    ? `${main}\n\n=== سیر تحول ===\n\n${historyParts.join("\n\n")}`
    : main;

  return { title: title || `ماده ${articleSourceId}`, content, regulations: parseRegulations(html) };
}

/** Runs tasks with limited concurrency to stay polite to the source site. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]!, index);
    }
  });
  await Promise.all(runners);
  return results;
}

export const TAX_KEYWORDS = [
  "مالیات",
  "مودیان",
  "ارزش افزوده",
  "بخشنامه",
  "آیین نامه",
  "آئین نامه",
  "پایانه های فروشگاهی",
  "تمبر",
  "عوارض",
];

export function isTaxRelated(book: { title: string; category: string | null }): boolean {
  const haystack = `${book.title} ${book.category ?? ""}`;
  return TAX_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

/* ------------------------------------------------------------------ */
/* بخشنامه‌ها: /search/moghar_list?s=<عبارت>&r=<تعداد>  →  /books/moghar/{id} */
/* ------------------------------------------------------------------ */

export type ScrapedCircularRow = {
  sourceId: string;
  kind: string | null;
  number: string | null;
  regDate: string | null;
  subject: string | null;
  url: string;
};

export type ScrapedCircularDetail = {
  title: string;
  content: string;
  number: string | null;
  regDate: string | null;
};

const CIRCULAR_LINK = /href="(?:https:\/\/hamrahyaar\.com)?\/books\/moghar\/(\d+)"/g;
const DATE_RE = /\d{4}\/\d{1,2}\/\d{1,2}/;

/** یک صفحه از فهرست بخشنامه‌ها را می‌خواند (r = تعداد/آفست). */
export async function fetchCircularList(term: string, r: number): Promise<ScrapedCircularRow[]> {
  const html = await fetchHtml(
    `${BASE}/search/moghar_list?s=${encodeURIComponent(term)}&r=${r}`,
  );
  const rows: ScrapedCircularRow[] = [];
  const seen = new Set<string>();

  // حالت جدولی: هر ردیف شامل شماره، تاریخ و موضوع است
  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const rowHtml = rowMatch[1] ?? "";
    const idMatch = /\/books\/moghar\/(\d+)/.exec(rowHtml);
    if (!idMatch) continue;
    const sourceId = idMatch[1]!;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
      .map((cell) => toText(cell[1] ?? "").replace(/\n+/g, " ").trim())
      .filter((cell) => cell.length > 0);
    const rowText = toText(rowHtml).replace(/\n+/g, " ");
    rows.push({
      sourceId,
      kind: null,
      number: cells.find((cell) => /\d/.test(cell) && !DATE_RE.test(cell)) ?? null,
      regDate: DATE_RE.exec(rowText)?.[0] ?? null,
      subject:
        cells.slice().sort((a, b) => b.length - a.length)[0] ??
        (rowText || null),
      url: `${BASE}/books/moghar/${sourceId}`,
    });
  }

  // حالت غیرجدولی: فقط لینک‌ها
  CIRCULAR_LINK.lastIndex = 0;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = CIRCULAR_LINK.exec(html)) !== null) {
    const sourceId = linkMatch[1]!;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    rows.push({
      sourceId,
      kind: null,
      number: null,
      regDate: null,
      subject: null,
      url: `${BASE}/books/moghar/${sourceId}`,
    });
  }

  return rows;
}

/**
 * تمام صفحات فهرست را با افزایش پارامتر r می‌خواند تا نتیجه تازه‌ای نماند.
 */
export async function fetchAllCircularRows(
  term: string,
  options: { step?: number; maxPages?: number; startFrom?: number } = {},
): Promise<ScrapedCircularRow[]> {
  const step = options.step ?? 10;
  const maxPages = options.maxPages ?? 400;
  const collected = new Map<string, ScrapedCircularRow>();
  let r = options.startFrom ?? step;

  for (let page = 0; page < maxPages; page++) {
    const rows = await fetchCircularList(term, r);
    const before = collected.size;
    for (const row of rows) {
      if (!collected.has(row.sourceId)) collected.set(row.sourceId, row);
    }
    if (collected.size === before) break; // نتیجه تازه‌ای نبود
    r += step;
  }

  return [...collected.values()];
}

/** متن کامل یک بخشنامه. */
export async function fetchCircularDetail(sourceId: string): Promise<ScrapedCircularDetail> {
  const html = await fetchHtml(`${BASE}/books/moghar/${sourceId}`);

  const rawTitle = toText(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? "");
  const title = rawTitle.includes(" - ")
    ? rawTitle.split(" - ").slice(1).join(" - ").trim()
    : rawTitle;

  let main = "";
  const desIndex = html.indexOf('id="div_des"');
  if (desIndex !== -1) {
    const after = html.slice(html.indexOf(">", desIndex) + 1);
    const navIndex = after.indexOf('<div class="pb-3 mb-3">');
    main = toText(navIndex === -1 ? after.slice(0, 60000) : after.slice(0, navIndex));
  }
  if (!main) {
    const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
    main = toText(body).slice(0, 60000);
  }

  const numberMatch = /شماره\s*[:：]?\s*([0-9\/\-الفبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]{3,40})/.exec(
    main,
  );

  return {
    title: title || `بخشنامه ${sourceId}`,
    content: main,
    number: numberMatch?.[1]?.trim() ?? null,
    regDate: DATE_RE.exec(main)?.[0] ?? null,
  };
}

/** عبارت‌های جستجو برای پوشش کامل بخشنامه‌های مالیاتی. */
export const CIRCULAR_QUERY_TERMS = ["مالیات", "بخشنامه", "ارزش افزوده", "مودیان"];
