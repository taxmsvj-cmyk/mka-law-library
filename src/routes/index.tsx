import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listBooks, scrapeBook, searchArticles, syncBooks } from "@/lib/library.functions";
import { PdfButton } from "@/components/PdfButton";

const booksQueryOptions = queryOptions({
  queryKey: ["books"],
  queryFn: () => listBooks(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "کتابخانه قوانین و بخشنامه‌های مالیاتی" },
      {
        name: "description",
        content:
          "استخراج و آرشیو کامل قوانین، مواد قانونی و بخشنامه‌های مالیاتی ایران با امکان جستجوی متن کامل.",
      },
      { property: "og:title", content: "کتابخانه قوانین و بخشنامه‌های مالیاتی" },
      {
        property: "og:description",
        content: "آرشیو جستجوپذیر قوانین و بخشنامه‌های مالیاتی ایران",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(booksQueryOptions),
  component: LibraryPage,
});

function LibraryPage() {
  const { data } = useSuspenseQuery(booksQueryOptions);
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const syncFn = useServerFn(syncBooks);
  const scrapeFn = useServerFn(scrapeBook);

  const search = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchArticles({ data: { q: query } }),
    enabled: query.trim().length > 1,
  });

  const addLog = (line: string) => setLog((prev) => [line, ...prev].slice(0, 12));

  const sync = useMutation({
    mutationFn: async () => {
      const result = await syncFn({});
      addLog(`فهرست قوانین بروزرسانی شد: ${result.saved} قانون مالیاتی از ${result.found} مورد`);
      await booksRefetch();
    },
  });

  const booksRefetch = async () => {
    await search.refetch().catch(() => undefined);
    window.location.reload();
  };

  const scrapeAll = useMutation({
    mutationFn: async () => {
      for (const book of data.books) {
        let guard = 0;
        for (;;) {
          const result = await scrapeFn({ data: { sourceId: book.source_id, batchSize: 20 } });
          addLog(
            `${book.title}: ${result.total - result.remaining} از ${result.total} ماده ذخیره شد`,
          );
          if (result.remaining === 0 || result.scraped === 0 || ++guard > 40) break;
        }
      }
      window.location.reload();
    },
  });

  const grouped = data.books.reduce<Record<string, typeof data.books>>((acc, book) => {
    const key = book.category ?? "سایر";
    (acc[key] ??= []).push(book);
    return acc;
  }, {});

  const busy = sync.isPending || scrapeAll.isPending;

  return (
    <div className="min-h-screen">
      <header className="print-header bg-gradient-header text-primary-foreground">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <p className="text-sm opacity-80">آرشیو دیجیتال مقررات</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            کتابخانه قوانین و بخشنامه‌های مالیاتی
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-8 opacity-90">
            قوانین، مواد قانونی و بخشنامه‌های مالیاتی از منبع همراه‌یار استخراج و در این کتابخانه
            ذخیره می‌شود؛ با جستجوی متن کامل در تمام مواد.
          </p>
          <div className="mt-8 flex flex-wrap items-end gap-6 text-sm">
            <div>
              <div className="text-2xl font-bold">{data.books.length}</div>
              <div className="opacity-80">قانون</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.totalArticles}</div>
              <div className="opacity-80">ماده ذخیره‌شده</div>
            </div>
            <Link
              to="/circulars"
              className="no-print rounded-lg bg-gold px-5 py-2.5 text-sm font-medium text-gold-foreground hover:opacity-90"
            >
              بخشنامه‌ها (متن کامل) ←
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <section className="panel no-print p-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(term);
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="جستجو در متن مواد و قوانین… مثلاً: ارزش افزوده"
              className="h-11 flex-1 rounded-lg border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="h-11 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              جستجو
            </button>
          </form>

          {query.trim().length > 1 && (
            <div className="mt-5 space-y-3">
              {search.isLoading && <p className="text-sm text-muted-foreground">در حال جستجو…</p>}
              {search.data?.results.length === 0 && (
                <p className="text-sm text-muted-foreground">نتیجه‌ای یافت نشد.</p>
              )}
              {search.data?.results.map((result) => (
                <Link
                  key={result.source_id}
                  to="/books/$sourceId"
                  params={{ sourceId: result.book_source_id }}
                  hash={result.source_id}
                  className="block rounded-lg border border-border bg-secondary/40 p-4 transition-colors hover:bg-secondary"
                >
                  <div className="text-sm font-semibold">{result.title}</div>
                  {result.chapter && (
                    <div className="mt-1 text-xs text-muted-foreground">{result.chapter}</div>
                  )}
                  <p className="mt-2 line-clamp-3 text-xs leading-6 text-muted-foreground">
                    {result.content?.slice(0, 320)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <PdfButton
            variant="primary"
            fileName="فهرست قوانین مالیاتی — کتابخانه"
            label="دانلود PDF فهرست قوانین"
          />
        </div>

        <section className="panel no-print mt-8 p-5">
          <h2 className="text-lg font-semibold">استخراج و بروزرسانی</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ابتدا فهرست قوانین مالیاتی را دریافت کنید، سپس متن کامل مواد و بخشنامه‌های هر قانون را
            ذخیره کنید. عملیات به صورت دسته‌ای انجام می‌شود و می‌توانید آن را ادامه دهید.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => sync.mutate()}
              disabled={busy}
              className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {sync.isPending ? "در حال دریافت فهرست…" : "۱) دریافت فهرست قوانین"}
            </button>
            <button
              onClick={() => scrapeAll.mutate()}
              disabled={busy || data.books.length === 0}
              className="h-10 rounded-lg bg-gold px-5 text-sm font-medium text-gold-foreground disabled:opacity-50"
            >
              {scrapeAll.isPending ? "در حال استخراج متن مواد…" : "۲) استخراج متن کامل همه قوانین"}
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

        <section className="mt-10 space-y-8">
          {data.books.length === 0 && (
            <p className="text-sm text-muted-foreground">
              هنوز قانونی ذخیره نشده است. با دکمه «دریافت فهرست قوانین» شروع کنید.
            </p>
          )}
          {Object.entries(grouped).map(([category, books]) => (
            <div key={category}>
              <h2 className="mb-3 border-b border-border pb-2 text-base font-semibold text-primary">
                {category}
                <span className="mr-2 text-xs font-normal text-muted-foreground">
                  ({books.length} قانون)
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {books.map((book) => (
                  <Link
                    key={book.source_id}
                    to="/books/$sourceId"
                    params={{ sourceId: book.source_id }}
                    className="panel p-4 transition-transform hover:-translate-y-0.5"
                  >
                    <div className="text-sm font-semibold leading-7">{book.title}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {book.articles_count > 0
                        ? `${book.articles_count} ماده`
                        : "متن مواد ذخیره نشده"}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
