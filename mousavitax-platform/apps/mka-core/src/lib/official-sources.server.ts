/**
 * منابع رسمی دولتی — دسترسی خودکار فقط با اجازه‌ی صریح مالک پروژه.
 *
 * سیاست پروژه (طبق دستور مالک):
 *   ۱) منبع اصلی داده، مخزن اختصاصی Google Drive سازمان است (gdrive-source.server.ts).
 *   ۲) اگر اطلاعات یا تأییدیه‌ای در مخزن وجود نداشت، پیش از هرگونه مراجعه به
 *      منابع رسمی باید با مالک پروژه مشورت شود و اجازه گرفته شود.
 *   ۳) اجازه فقط از مسیر متغیر محیطی OFFICIAL_FALLBACK_APPROVED=true
 *      (در Vercel / محیط اجرا) اعطا می‌شود — نه از داخل کد و نه از UI.
 *
 * تا زمانی که این پرچم فعال نشده باشد:
 *   - هیچ درخواست شبکه‌ای به سایت‌های رسمی زده نمی‌شود؛
 *   - توابع واکشی خطای شفاف فارسی با راهنمای اقدام برمی‌گردانند؛
 *   - لینک‌های جستجوی رسمی (بدون واکشی) به‌عنوان پیشنهاد مراجعه در دسترس‌اند.
 */

export type OfficialSite = {
  id: string;
  label: string;
  host: string;
  home: string;
};

/** سایت‌های رسمی مورد تأیید مالک برای مراجعه (فقط با اجازه واکشی می‌شوند). */
export const OFFICIAL_SITES: OfficialSite[] = [
  {
    id: "tax",
    label: "سازمان امور مالیاتی ایران",
    host: "tax.gov.ir",
    home: "https://tax.gov.ir",
  },
  {
    id: "intamedia",
    label: "پایگاه اطلاع‌رسانی سازمان امور مالیاتی",
    host: "intamedia.ir",
    home: "https://intamedia.ir",
  },
  {
    id: "majlis-rc",
    label: "مرکز پژوهش‌های مجلس — قوانین و مقررات",
    host: "rc.majlis.ir",
    home: "https://rc.majlis.ir",
  },
  {
    id: "qavanin",
    label: "پایگاه ملی اطلاع‌رسانی قوانین و مقررات",
    host: "qavanin.ir",
    home: "https://qavanin.ir",
  },
  {
    id: "rooznameh-rasmi",
    label: "روزنامه رسمی کشور",
    host: "rooznamehrasmi.ir",
    home: "https://www.rooznamehrasmi.ir",
  },
];

const ALLOWED_HOSTS = new Set<string>(
  OFFICIAL_SITES.flatMap((site) => [site.host, `www.${site.host}`]),
);

export function isOfficialFallbackApproved(): boolean {
  return process.env["OFFICIAL_FALLBACK_APPROVED"] === "true";
}

/** پیام استاندارد برای حالت «اجازه داده نشده» — شامل مسیر دقیق اقدام. */
export function officialApprovalMessage(action: string): string {
  return [
    `مراجعه به منابع رسمی («${action}») هنوز مجاز نشده است.`,
    "طبق سیاست پروژه، در صورت نبود سند یا تأییدیه در مخزن Google Drive، ابتدا باید با مالک پروژه مشورت کنید و پس از دریافت اجازه، متغیر محیطی OFFICIAL_FALLBACK_APPROVED را با مقدار true در تنظیمات Vercel ثبت کنید.",
    "تا آن زمان، فقط لینک‌های مراجعه‌ی دستی به سایت‌های رسمی ارائه می‌شود و هیچ داده‌ای به‌صورت خودکار از آن‌ها دریافت یا ذخیره نمی‌شود.",
  ].join(" ");
}

/**
 * گیتِ اجازه — هر تابعی که بخواهد واقعاً به سایت رسمی درخواست بزند،
 * موظف است اول این تابع را صدا بزند. در غیر این صورت خطا می‌دهد.
 */
export function assertOfficialApproval(action: string): void {
  if (!isOfficialFallbackApproved()) {
    throw new Error(officialApprovalMessage(action));
  }
}

export type OfficialLink = { site: string; label: string; url: string };

/**
 * لینک‌های جستجوی رسمی برای یک عبارت — بدون هیچ واکشی شبکه‌ای.
 * این لینک‌ها همیشه در دسترس‌اند چون صرفاً مراجعه‌ی دستی را پیشنهاد می‌دهند.
 */
export function officialSearchLinks(query: string): OfficialLink[] {
  const q = query.trim().slice(0, 120);
  if (q.length < 2) return [];
  return OFFICIAL_SITES.map((site) => ({
    site: site.id,
    label: site.label,
    url: `https://www.google.com/search?q=${encodeURIComponent(`site:${site.host} ${q}`)}`,
  }));
}

/**
 * واکشی متن یک صفحه از سایت‌های رسمی — دو لایه محافظت:
 *   ۱) گیتِ اجازه‌ی مالک (assertOfficialApproval)
 *   ۲) لیست سفید دامنه‌ها (ضد SSRF — فقط دامنه‌های رسمی تعریف‌شده)
 */
export async function fetchOfficialPageText(rawUrl: string): Promise<string> {
  assertOfficialApproval("واکشی محتوای منبع رسمی");

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("نشانی منبع رسمی نامعتبر است.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("پروتکل نشانی منبع رسمی مجاز نیست.");
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = [...ALLOWED_HOSTS].some(
    (h) => host === h || host.endsWith(`.${h.replace(/^www\./, "")}`),
  );
  if (!allowed) {
    throw new Error(`دامنه‌ی «${host}» در فهرست منابع رسمی مورد تأیید نیست.`);
  }

  const res = await fetch(rawUrl, {
    signal: AbortSignal.timeout(25_000),
    headers: {
      "User-Agent": "MKA-Law-Library/1.0 (approved official-source fetch)",
      "Accept-Language": "fa,en;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`دریافت صفحه‌ی رسمی ناموفق بود [${res.status}]: ${rawUrl}`);
  }
  const { toPlainText } = await import("./gdrive-source.server");
  return toPlainText(await res.text());
}
