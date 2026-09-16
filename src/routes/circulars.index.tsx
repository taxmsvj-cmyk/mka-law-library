import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listCirculars, scrapeCirculars, syncCircularList } from "@/lib/library.functions";
import { PdfButton } from "@/components/PdfButton";

const circularsQueryOptions = queryOptions({
  queryKey: ["circulars", 0, ""],
  queryFn: () => listCirculars({ data: {} }),
});

export const Route = createFileRoute("/circulars/")({
  head: () => ({
    meta: [
      { title: "بخشنامه‌های مالیاتی — متن کامل" },
      {
        name: "description",
        content:
          "آرشیو متن کامل بخشنامه‌های مالیاتی سازمان امور مالیاتی با جستجوی متنی در شماره، تاریخ و موضوع.",
      },
      { property: "og:title", content: "بخشنامه‌های مالیاتی — متن کامل" },
      {
        property: "og:description",
        content: "آرشیو جستجوپذیر متن کامل بخشنامه‌های مالیاتی ایران",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(circularsQueryOptions),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="mx-auto max-w-3xl p-8 text-sm">یافت نشد.</div>,
  component: CircularsPage,
});

function CircularsPage() {
  const initial = useSuspenseQuery(circularsQueryOptions);
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const syncFn = useServerFn(syncCircularList);
  const scrapeFn = useServerFn(scrapeCirculars);

  const list = useQuery({
    queryKey: ["circulars", page, query],
    queryFn: () => listCirculars({ data: { q: query, page } }),
    initialData: page === 0 && query === "" ? initial.data : undefined,
  });

  const addLog = (line: string) => setLog((prev) => [line, ...prev].slice(0, 12));

  const sync = useMutation({
    mutationFn: async () => {
      const result = await syncFn({ data: {} });
      addLog(`فهرست بخشنامه‌ها دریافت شد: ${result.total} بخشنامه در دیتابیس`);
      await list.refetch();
    },
  });

  const scrapeAll = useMutation({
    mutationFn: async () => {
      let guard = 0;
      for (;;) {
        const result = await scrapeFn({ data: { batchSize: 20 } });
        addLog(`${result.scraped} بخشنامه ذخیره شد — ${result.remaining} مورد باقی مانده`);
        if (result.remaining === 0 || result.scraped === 0 || ++guard > 500) break;
      }
      await list.refetch();
    },
  });

  const data = list.data;
  const busy = sync.isPending || scrapeAll.isPending;
  const pages = data ? Math.ceil(data.total / data.size) : 0;

  return (
    <div className="min-h-screen">
      <header className="print-header bg-gradient-header text-primary-foreground">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <Link to="/" className="no-print text-xs opacity-80 hover:opacity-100">
            ← بازگشت به کتابخانه
          </Link>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">بخشنامه‌های مالیاتی</h1>
          <p className="mt-3 max-w-2xl text-sm leading-8 opacity-90">
            استخراج فهرست بخشنامه‌ها با صفحه‌بندی منبع و ذخیره متن کامل هر بخشنامه.
          </p>
          <div className="mt-6 text-sm">
            <div className="text-2xl font-bold">{data?.total ?? 0}</div>
            <div className="opacity-80">بخشنامه</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <section className="panel no-print p-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setPage(0);
              setQuery(term);
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="جستجو در متن، موضوع یا شماره بخشنامه…"
              className="h-11 flex-1 rounded-lg border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="h-11 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              جستجو
            </button>
          </form>
        </section>

        <section className="panel no-print mt-8 p-5">
          <h2 className="text-lg font-semibold">استخراج بخشنامه‌ها</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ابتدا فهرست کامل بخشنامه‌ها را دریافت کنید (صفحه‌بندی خودکار)، سپس متن کامل آن‌ها را به
            صورت دسته‌ای ذخیره کنید.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => sync.mutate()}
              disabled={busy}
              className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {sync.isPending ? "در حال دریافت فهرست…" : "۱) دریافت فهرست بخشنامه‌ها"}
            </button>
            <button
              onClick={() => scrapeAll.mutate()}
              disabled={busy || (data?.total ?? 0) === 0}
              className="h-10 rounded-lg bg-gold px-5 text-sm font-medium text-gold-foreground disabled:opacity-50"
            >
              {scrapeAll.isPending ? "در حال استخراج متن…" : "۲) استخراج متن کامل بخشنامه‌ها"}
            </button>
          </div>
          {(sync.error || scrapeAll.error) && (
            <p className="mt-3 text-sm text-destructive">
              {(sync.error ?? scrapeAll.error)?.message}
            </p>
          )}
          {log.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
              {log.map((line, index) => (
                <li key={index}>• {line}</li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <PdfButton
            variant="primary"
            fileName={`فهرست بخشنامه‌های مالیاتی — صفحه ${page + 1}`}
            label="دانلود PDF این فهرست"
          />
        </div>

        <section className="mt-6 space-y-3">
          {data?.circulars.length === 0 && (
            <p className="text-sm text-muted-foreground">بخشنامه‌ای یافت نشد.</p>
          )}
          {data?.circulars.map((circular) => (
            <Link
              key={circular.source_id}
              to="/circulars/$sourceId"
              params={{ sourceId: circular.source_id }}
              className="panel block p-4 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {circular.number && <span>شماره: {circular.number}</span>}
                {circular.reg_date && <span>تاریخ: {circular.reg_date}</span>}
                {circular.status && <span>وضعیت: {circular.status}</span>}
                {!circular.scraped_at && <span className="text-gold">متن ذخیره نشده</span>}
              </div>
              <div className="mt-2 text-sm font-semibold leading-7">
                {circular.subject ?? `بخشنامه ${circular.source_id}`}
              </div>
            </Link>
          ))}

          {pages > 1 && (
            <div className="no-print flex items-center justify-center gap-3 pt-4 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-9 rounded-lg border border-border px-4 disabled:opacity-40"
              >
                قبلی
              </button>
              <span className="text-muted-foreground">
                صفحه {page + 1} از {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                disabled={page + 1 >= pages}
                className="h-9 rounded-lg border border-border px-4 disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
