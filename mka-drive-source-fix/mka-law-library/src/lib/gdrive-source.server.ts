/**
 * Server-only Google Drive source — مخزن اختصاصی اسناد مالیاتی مالک پروژه.
 *
 * این ماژول جایگزین کامل اسکرپر hamrahyaar.com شده است (ریسک حقوقی وابستگی به
 * سایت شخصی ثالث + شکنندگی regex). منبع داده‌ی کتابخانه اکنون پوشه‌ی Google
 * Drive خودِ سازمان است و هیچ درخواستی به سایت‌های ثالث زده نمی‌شود.
 *
 * دو حالت اتصال پشتیبانی می‌شود:
 *  ۱) حالت API (توصیه‌شده): کلید API گوگل با دسترسی Drive API در متغیر
 *     GOOGLE_DRIVE_API_KEY — پایدار، سریع و با متادیتای کامل.
 *  ۲) حالت عمومی (بدون کلید): خواندن نمای تعبیه‌شده‌ی پوشه‌های عمومی
 *     (embeddedfolderview) — بدون هیچ پیکربندی، فقط برای پوشه‌های عمومی.
 *
 * هیچ فایل .env و هیچ کلید محرمانه‌ای در این ماژول استفاده نمی‌شود.
 */

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const EMBEDDED_VIEW_BASE = "https://drive.google.com/embeddedfolderview";
const DRIVE_HOST = "https://drive.google.com";

/** ریشه‌ی مخزن اسناد — قابل بازنویسی با متغیر محیطی GDRIVE_ROOT_FOLDER_ID. */
export const DRIVE_ROOT_FOLDER =
  process.env["GDRIVE_ROOT_FOLDER_ID"] ?? "1Jx0cipUqQyGnJk4hFCURzWIg1Abo1Del";

/** پیشوند شناسه‌های مجازی در جداول books/articles/circulars. */
export const DRIVE_PREFIX = "drive:";

export type DriveNode = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
  /** مسیر پوشه‌ها از ریشه، مثلا «1 - قانون مالیات‌های مستقیم / باب اول». */
  folderPath: string;
  /** شناسه‌ی گره سطح‌بالای ریشه که این سند به آن می‌رسد (برای نگاشت کتاب/ماده). */
  rootId: string;
  rootName: string;
  depth: number;
};

export type DriveListMode = "api" | "public-view";

export function driveApiKey(): string | null {
  const key = process.env["GOOGLE_DRIVE_API_KEY"];
  return key && key.trim().length > 10 ? key.trim() : null;
}

export function driveMode(): DriveListMode {
  return driveApiKey() ? "api" : "public-view";
}

/* ------------------------------------------------------------------ */
/* ابزارهای HTML (خودکفا — بدون وابستگی به ماژول اسکرپر قدیمی)         */
/* ------------------------------------------------------------------ */

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

export function toPlainText(html: string): string {
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

/** تبدیل ارقام فارسی/عربی به لاتین برای استخراج شماره و تاریخ. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** حذف شماره‌گذاری ابتدای نام («1 - ...» یا «۱-...») و پسوند فایل. */
export function cleanTitle(name: string): string {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  const stripped = base
    .replace(/^\s*\d{1,3}\s*[-–—]\s*/u, "")
    .replace(/^\s*[-–—]\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || base.trim() || name.trim();
}

export function driveViewUrl(id: string, isFolder = false): string {
  return isFolder
    ? `${DRIVE_HOST}/drive/folders/${id}`
    : `${DRIVE_HOST}/file/d/${id}/view`;
}

/** اجرای موازی با سقف هم‌زمانی — مودبانه و بدون فشار به منبع. */
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

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
}

/* ------------------------------------------------------------------ */
/* حالت ۱: Drive API رسمی (با کلید)                                    */
/* ------------------------------------------------------------------ */

type ApiFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
};

async function apiListChildren(folderId: string): Promise<DriveNode[]> {
  const key = driveApiKey()!;
  const out: DriveNode[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${DRIVE_API_BASE}/files`);
    url.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
    url.searchParams.set(
      "fields",
      "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
    );
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("key", key);
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Drive API [${res.status}]: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { files: ApiFile[]; nextPageToken?: string };
    for (const f of json.files ?? []) {
      const isFolder = f.mimeType === "application/vnd.google-apps.folder";
      out.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        isFolder,
        size: f.size ? Number(f.size) : null,
        modifiedTime: f.modifiedTime ?? null,
        folderPath: "",
        rootId: "",
        rootName: "",
        depth: 0,
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return out;
}

/* ------------------------------------------------------------------ */
/* حالت ۲: نمای تعبیه‌شده‌ی پوشه‌ی عمومی (بدون کلید)                    */
/* ------------------------------------------------------------------ */

type ViewEntry = { id: string; title: string; isFolder: boolean };

async function viewListEntries(folderId: string): Promise<ViewEntry[]> {
  const res = await fetchWithTimeout(
    `${EMBEDDED_VIEW_BASE}?id=${encodeURIComponent(folderId)}`,
    { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "fa,en;q=0.8" } },
  );
  if (!res.ok) {
    throw new Error(
      `خواندن پوشه‌ی Google Drive ناموفق بود [${res.status}]. مطمئن شوید پوشه به‌صورت «هر کسی با لینک» به اشتراک گذاشته شده است.`,
    );
  }
  const html = await res.text();
  const entries: ViewEntry[] = [];
  const seen = new Set<string>();
  const entryRe = /<div class="flip-entry" id="entry-([\w-]+)"[^>]*>([\s\S]*?)<div class="flip-entry-title">([\s\S]*?)<\/div>/g;

  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(html)) !== null) {
    const id = match[1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    const href = /href="([^"]+)"/.exec(match[2] ?? "")?.[1] ?? "";
    const isFolder = href.includes("/drive/folders/");
    const title = toPlainText(match[3] ?? "").replace(/\s+/g, " ").trim();
    if (!title) continue;
    entries.push({ id, title, isFolder });
  }
  return entries;
}

/** حدس MIME از پسوند فایل — فقط برای حالت عمومی که متادیتای MIME ندارد. */
export function guessMimeType(name: string): string {
  const ext = (name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic"].includes(ext)) return `image/${ext === "jpg" ? "jpeg" : ext}`;
  if (["txt", "md"].includes(ext)) return "text/plain";
  if (ext === "csv") return "text/csv";
  if (ext === "json") return "application/json";
  if (["html", "htm"].includes(ext)) return "text/html";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "doc") return "application/msword";
  if (ext === "xls") return "application/vnd.ms-excel";
  return "application/octet-stream";
}

/* ------------------------------------------------------------------ */
/* پیمایش درخت مخزن                                                    */
/* ------------------------------------------------------------------ */

async function listChildrenOf(folderId: string): Promise<DriveNode[]> {
  if (driveMode() === "api") return apiListChildren(folderId);

  const entries = await viewListEntries(folderId);
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.title,
    mimeType: entry.isFolder
      ? "application/vnd.google-apps.folder"
      : guessMimeType(entry.title),
    isFolder: entry.isFolder,
    size: null,
    modifiedTime: null,
    folderPath: "",
    rootId: "",
    rootName: "",
    depth: 0,
  }));
}

export type WalkOptions = { maxDepth?: number; maxNodes?: number };

/**
 * کل درخت پوشه‌ی مخزن را پیمایش می‌کند (BFS با سقف ایمنی).
 * هر گره شامل مسیر پوشه و ریشه‌ی سطح‌بالای خودش است.
 */
export async function walkDriveTree(options: WalkOptions = {}): Promise<DriveNode[]> {
  const maxDepth = options.maxDepth ?? 6;
  const maxNodes = options.maxNodes ?? 4000;
  const all: DriveNode[] = [];
  const queue: Array<{ id: string; path: string; rootId: string; rootName: string; depth: number }> = [
    { id: DRIVE_ROOT_FOLDER, path: "", rootId: "", rootName: "", depth: 0 },
  ];
  const failedFolders: string[] = [];

  while (queue.length > 0 && all.length < maxNodes) {
    const folder = queue.shift()!;
    let children: DriveNode[];
    try {
      children = await listChildrenOf(folder.id);
    } catch (error) {
      console.error("drive walk folder failed", folder.path || "(root)", error);
      failedFolders.push(folder.path || "(root)");
      continue;
    }

    for (const child of children) {
      if (all.length >= maxNodes) break;
      const path = folder.path ? `${folder.path} / ${child.name}` : child.name;
      const rootId = folder.rootId || child.id;
      const rootName = folder.rootName || child.name;
      const depth = folder.depth + 1;

      // پوشه‌های آینه‌ی مخزن کد در سطح بالا را کامل رد کن (ایندکس و پیمایش) —
      // محتوای قانونی ندارند و بودجه‌ی پیمایش را هدر می‌دهند.
      const isMirrorFolder =
        child.isFolder && depth === 1 && EXCLUDED_TOP_LEVEL.has(child.name.trim().toLowerCase());
      if (isMirrorFolder) continue;

      const node: DriveNode = {
        ...child,
        folderPath: folder.path,
        rootId,
        rootName,
        depth,
      };
      all.push(node);
      if (child.isFolder && depth < maxDepth) {
        queue.push({ id: child.id, path, rootId, rootName, depth });
      }
    }

    // حالت عمومی: مکث کوتاه بین پوشه‌ها برای جلوگیری از فشار به سرویس
    if (driveMode() === "public-view") await new Promise((r) => setTimeout(r, 120));
  }

  if (failedFolders.length > 0) {
    console.warn("drive walk: some folders skipped:", failedFolders.slice(0, 10).join(" | "));
  }
  return all;
}

/* ------------------------------------------------------------------ */
/* دانلود و استخراج متن                                                */
/* ------------------------------------------------------------------ */

/**
 * دانلود بایت‌های فایل. در حالت API، اسناد گوگل (Docs/Sheets) به
 * متن/CSV صادر می‌شوند؛ در حالت عمومی از مسیر دانلود مستقیم استفاده می‌شود.
 */
export async function downloadDriveFile(id: string, mimeType: string): Promise<Response> {
  if (driveMode() === "api") {
    const key = driveApiKey()!;
    const base = `${DRIVE_API_BASE}/files/${encodeURIComponent(id)}`;
    const url =
      mimeType === "application/vnd.google-apps.document"
        ? `${base}/export?key=${key}&mimeType=${encodeURIComponent("text/plain")}`
        : mimeType === "application/vnd.google-apps.spreadsheet"
          ? `${base}/export?key=${key}&mimeType=${encodeURIComponent("text/csv")}`
          : mimeType.startsWith("application/vnd.google-apps")
            ? `${base}/export?key=${key}&mimeType=${encodeURIComponent("application/pdf")}`
            : `${base}?key=${key}&alt=media&supportsAllDrives=true`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Drive دانلود [${res.status}]: ${body.slice(0, 200)}`);
    }
    return res;
  }

  // حالت عمومی: دانلود مستقیم (فایل‌های باینری/متنی معمولی)
  let res = await fetchWithTimeout(`${DRIVE_HOST}/uc?export=download&id=${encodeURIComponent(id)}`);
  if (res.ok && (res.headers.get("content-type") ?? "").includes("text/html")) {
    // صفحه‌ی تأیید اسکن ویروس گوگل → تلاش با confirm=t
    res = await fetchWithTimeout(
      `${DRIVE_HOST}/uc?export=download&confirm=t&id=${encodeURIComponent(id)}`,
    );
  }
  if (!res.ok) {
    throw new Error(`دانلود فایل از Drive ناموفق بود [${res.status}]`);
  }
  return res;
}

export type ExtractionStatus = "text" | "pdf-text" | "needs-ocr" | "binary" | "empty" | "pending";

const OCR_MIME_PREFIXES = ["image/"];
const TEXTUAL_MIMES = ["text/plain", "text/csv", "text/html", "application/json"];
const GOOGLE_DOC_MIMES = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
];

/**
 * استخراج متن از بایت‌های سند. برای PDFها در صورت موجود بودن unpdf
 * از pdf.js استفاده می‌شود؛ تصاویر و باینری‌ها needs-ocr علامت می‌خورند.
 */
export async function extractDriveText(
  name: string,
  mimeType: string,
  bytes: Uint8Array,
): Promise<{ text: string; status: ExtractionStatus }> {
  const mime = mimeType || guessMimeType(name);

  if (mime.startsWith("text/") || TEXTUAL_MIMES.includes(mime) || GOOGLE_DOC_MIMES.includes(mime)) {
    const text = toPlainText(new TextDecoder("utf-8").decode(bytes));
    return { text, status: text.trim().length > 0 ? "text" : "empty" };
  }

  if (mime === "application/pdf") {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      const merged = (Array.isArray(text) ? text.join("\n\n") : text).trim();
      // PDFهای فارسیِ بدساخت، نویسه‌های جدا (presentation forms) برمی‌گردانند —
      // این متن برای جستجو بی‌ارزش است؛ به‌جای ذخیره، needs-ocr علامت می‌خورَد.
      const forms = (merged.match(/[\uFB50-\uFDFF\uFE70-\uFEFF]/g) ?? []).length;
      const garbled = merged.length > 0 && forms / merged.length > 0.25;
      if (garbled) return { text: "", status: "needs-ocr" };
      return { text: merged, status: merged.length > 40 ? "pdf-text" : "needs-ocr" };
    } catch (error) {
      // unpdf نصب نیست یا PDF متن قابل استخراج ندارد (اسکن‌شده) → needs-ocr
      console.warn("pdf extract skipped", name, (error as Error).message?.slice(0, 120));
      return { text: "", status: "needs-ocr" };
    }
  }

  if (OCR_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    return { text: "", status: "needs-ocr" };
  }

  return { text: "", status: "binary" };
}

/* ------------------------------------------------------------------ */
/* سیاست منابع: چه چیزی «قانون» محسوب می‌شود                            */
/* ------------------------------------------------------------------ */

/**
 * پوشه‌های آینه‌ی مخزن کد و فایل‌های عملیاتی که نباید به‌عنوان «قانون»
 * در فهرست کتاب‌ها ظاهر شوند (در ایندکس جستجو می‌مانند ولی کتاب نمی‌شوند).
 */
const EXCLUDED_TOP_LEVEL = new Set([
  "apps",
  "data",
  "docs",
  "domains",
  "infra",
  "knowledge",
  "packages",
  "scripts",
  "services",
  "templates",
  "tests",
  "src",
]);

const EXCLUDED_TOP_FILES = new Set([
  "readme.md",
  ".gitignore",
  ".env.example",
  "111.xlsx",
  "رونوشت 111.xlsx",
  "سایت های متصل به درایور.xlsx",
  "سایت های متصل به درایور",
  "لیست بخشنامه های درایور",
]);

export function isLibraryBook(node: DriveNode): boolean {
  // فرزندان مستقیم ریشه‌ی مخزن (پیمایش، ریشه را عمق ۰ می‌گیرد → سطح بالا = عمق ۱)
  if (node.depth !== 1) return false;
  const name = node.name.trim();
  if (EXCLUDED_TOP_LEVEL.has(name.toLowerCase())) return false;
  if (EXCLUDED_TOP_FILES.has(name.toLowerCase())) return false;
  if (name.startsWith(".")) return false;
  return true;
}

/** آیا این سند «بخشنامه» محسوب می‌شود؟ (مسیر یا نام حاوی بخشنامه) */
export function isCircularLike(node: DriveNode): boolean {
  if (node.isFolder) return false;
  const haystack = `${node.name} ${node.folderPath}`;
  return haystack.includes("بخشنامه");
}
