import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBook, scrapeBook } from "@/lib/library.functions";
import { PdfButton } from "@/components/PdfButton";


const bookQueryOptions = (sourceId: string) =>
  queryOptions({
    queryKey: ["book", sourceId],
    queryFn: () => getBook({ data: { sourceId } }),
  });

export const Route = createFileRoute("/books/$sourceId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(bookQueryOptions(params.sourceId)),
  head: ({ loaderData }) => {
    const title = loaderData?.book?.title ?? "قانون";
    return {
      meta: [
        { title: `${title} | کتابخانه قوانین مالیاتی` },
        {
          name: "description",
          content: `متن کامل مواد و بخشنامه‌های مرتبط با ${title} در کتابخانه قوانین مالیاتی.`,
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: `متن کامل مواد و بخشنامه‌های مرتبط با ${title}`,
        },
      ],
    };
  },
  component: BookPage,
  errorComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">
      بارگذاری این قانون ناموفق بود.
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">قانون پیدا نشد.</div>
  ),
});

function BookPage() {
  const { sourceId } = Route.useParams();
  const { data } = useSuspenseQuery(bookQueryOptions(sourceId));
  const scrapeFn = useServerFn(scrapeBook);

  const scrape = useMutation({
    mutationFn: async () => {
      let guard = 0;
      for (;;) {
        const result = await scrapeFn({ data: { sourceId, batchSize: 20 } });
        if (result.remaining === 0 || result.scraped === 0 || ++guard > 40) break;
      }
      window.location.reload();
    },
  });

  const regulationsByArticle = data.regulations.reduce<Record<string, typeof data.regulations>>(
    (acc, regulation) => {
      (acc[regulation.article_source_id] ??= []).push(regulation);
      return acc;
    },
    {},
  );

  let currentChapter: string | null = null;

  return (
    <div className="min-h-screen">
      <header className="print-header bg-gradient-header text-primary-foreground">
        <div className="mx-auto max-w-4xl px-5 py-10">
          <Link to="/" className="no-print text-xs opacity-80 hover:opacity-100">
            ← بازگشت به کتابخانه
          </Link>
          <h1 className="mt-3 text-2xl font-bold leading-9 sm:text-3xl">
            {data.book?.title ?? "قانون"}
          </h1>
          <p className="mt-3 text-xs opacity-85">
            {data.articles.length} ماده • {data.regulations.length} بخشنامه و مقرره مرتبط
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => scrape.mutate()}
            disabled={scrape.isPending}
            className="no-print h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {scrape.isPending ? "در حال استخراج…" : "استخراج / بروزرسانی متن این قانون"}
          </button>
          <PdfButton
            variant="primary"
            fileName={`${data.book?.title ?? "قانون"} — با بخشنامه‌های مرتبط`}
            label="دانلود PDF کامل (با جدول‌های مرتبط)"
          />
          {data.book?.url && (
            <a
              href={data.book.url}
              target="_blank"
              rel="noreferrer"
              className="no-print text-xs text-muted-foreground underline"
            >
              مشاهده منبع
            </a>
          )}
        </div>
        {scrape.error && (
          <p className="no-print mb-4 text-sm text-destructive">{scrape.error.message}</p>
        )}


        {data.articles.length === 0 && (
          <p className="text-sm text-muted-foreground">
            هنوز ماده‌ای برای این قانون ذخیره نشده است.
          </p>
        )}

        <div className="space-y-5">
          {data.articles.map((article) => {
            const showChapter = article.chapter && article.chapter !== currentChapter;
            if (article.chapter) currentChapter = article.chapter;
            const regulations = regulationsByArticle[article.source_id] ?? [];

            return (
              <div key={article.source_id}>
                {showChapter && (
                  <h2 className="mb-3 mt-8 text-sm font-semibold text-primary">
                    {article.chapter}
                  </h2>
                )}
                <article id={article.source_id} className="panel scroll-mt-6 p-5">
                  <h3 className="text-sm font-bold">{article.title}</h3>
                  {article.content ? (
                    <p className="law-text mt-3 text-foreground/90">{article.content}</p>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">متن ذخیره نشده است.</p>
                  )}

                  {regulations.length > 0 && (
                    <div className="mt-5 border-t border-border pt-4">
                      <h4 className="text-xs font-semibold text-primary">
                        بخشنامه‌ها و مقررات مرتبط ({regulations.length})
                      </h4>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="text-muted-foreground">
                            <tr>
                              <th className="pb-2 font-medium">نوع</th>
                              <th className="pb-2 font-medium">شماره</th>
                              <th className="pb-2 font-medium">تاریخ</th>
                              <th className="pb-2 font-medium">موضوع</th>
                            </tr>
                          </thead>
                          <tbody>
                            {regulations.map((regulation) => (
                              <tr key={regulation.id} className="border-t border-border/60">
                                <td className="py-2 align-top">{regulation.kind ?? "—"}</td>
                                <td className="py-2 align-top">{regulation.number ?? "—"}</td>
                                <td className="py-2 align-top whitespace-nowrap">
                                  {regulation.reg_date ?? "—"}
                                </td>
                                <td className="py-2 align-top leading-6">
                                  {regulation.subject ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </article>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
