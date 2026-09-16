import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCircular } from "@/lib/library.functions";
import { PdfButton } from "@/components/PdfButton";


const circularQueryOptions = (sourceId: string) =>
  queryOptions({
    queryKey: ["circular", sourceId],
    queryFn: async () => {
      const result = await getCircular({ data: { sourceId } });
      if (!result.circular) throw notFound();
      return result;
    },
  });

export const Route = createFileRoute("/circulars/$sourceId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(circularQueryOptions(params.sourceId)),
  head: ({ loaderData }) => {
    const subject = loaderData?.circular?.subject ?? "بخشنامه مالیاتی";
    return {
      meta: [
        { title: `${subject.slice(0, 55)} | بخشنامه مالیاتی` },
        {
          name: "description",
          content: `متن کامل بخشنامه ${loaderData?.circular?.number ?? ""} — ${subject.slice(0, 120)}`,
        },
        { property: "og:title", content: subject.slice(0, 60) },
        { property: "og:description", content: subject.slice(0, 150) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl p-8 text-sm">این بخشنامه یافت نشد.</div>
  ),
  component: CircularPage,
});

function CircularPage() {
  const { sourceId } = Route.useParams();
  const { data } = useSuspenseQuery(circularQueryOptions(sourceId));
  const circular = data.circular!;

  return (
    <div className="min-h-screen">
      <header className="print-header bg-gradient-header text-primary-foreground">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <Link to="/circulars" className="no-print text-xs opacity-80 hover:opacity-100">
            ← فهرست بخشنامه‌ها
          </Link>
          <h1 className="mt-3 text-xl font-bold leading-9 sm:text-2xl">
            {circular.subject ?? `بخشنامه ${circular.source_id}`}
          </h1>
          <div className="mt-3 flex flex-wrap gap-4 text-xs opacity-90">
            {circular.number && <span>شماره: {circular.number}</span>}
            {circular.reg_date && <span>تاریخ: {circular.reg_date}</span>}
            {circular.issuer && <span>مرجع صدور: {circular.issuer}</span>}
            {circular.status && <span>وضعیت: {circular.status}</span>}
            <a href={circular.url} target="_blank" rel="noreferrer" className="underline">
              منبع
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-5 flex flex-wrap gap-3">
          <PdfButton
            variant="primary"
            fileName={`بخشنامه-${circular.number ?? circular.source_id}`}
          />
        </div>
        {circular.content ? (
          <article className="panel whitespace-pre-line p-6 text-sm leading-8">
            {circular.content}
          </article>

        ) : (
          <p className="text-sm text-muted-foreground">
            متن این بخشنامه هنوز استخراج نشده است.
          </p>
        )}

        {circular.related_articles && (
          <section className="panel mt-5 p-5">
            <h2 className="text-xs font-semibold text-primary">مواد قانونی مرتبط</h2>
            <p className="mt-2 text-sm leading-8">{circular.related_articles}</p>
          </section>
        )}

        {circular.interpretation && (
          <section className="panel mt-5 p-5">
            <h2 className="text-xs font-semibold text-primary">متن تفسیری</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-8">{circular.interpretation}</p>
          </section>
        )}

        {circular.source_name && (
          <p className="mt-5 text-xs text-muted-foreground">منبع داده: {circular.source_name}</p>
        )}
      </main>
    </div>
  );
}
