import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 20;

function getStr(sp: Record<string, string | string[] | undefined>, key: string) {
  const v = sp[key];
  if (!v) return "";
  return Array.isArray(v) ? v[0] : v;
}

function clampPage(n: number) {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export default async function AdminCertificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = getStr(sp, "q").trim();
  const page = clampPage(Number(getStr(sp, "page") || "1"));

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // auth + role
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  // query
  // - busca pelo nome da pessoa OU nome do curso (ilike)
  let query = supabase
    .from("certifications")
    .select(
      `
      id,
      issued_at,
      rendered_at,
      png_url,
      pdf_url,
      public_token,
      people:person_id ( full_name ),
      courses:course_id ( name )
    `,
      { count: "exact" }
    )
    .order("issued_at", { ascending: false })
    .range(from, to);

  if (q) {
    // OR em tabelas relacionadas funciona com aliases (people/courses)
    query = query.or(
      `people.full_name.ilike.%${q}%,courses.name.ilike.%${q}%`
    );
  }

  const { data, count, error } = await query;

  if (error) {
    return (
      <main className="p-6 space-y-3">
        <h1 className="text-2xl font-bold">Certificados</h1>
        <p className="text-red-600">Erro: {error.message}</p>
      </main>
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  const qs = (overrides: Record<string, string | number | null>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const p = overrides.page ?? page;
    params.set("page", String(p));
    return `?${params.toString()}`;
  };

  return (
    <main className="p-6 space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Certificados</h1>
          <p className="text-sm opacity-70">
            Total: <strong>{total}</strong>
          </p>
        </div>

        <form className="flex gap-2" action="/admin/certifications" method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por pessoa ou curso..."
            className="border rounded px-3 py-2 text-sm w-72"
          />
          <input type="hidden" name="page" value="1" />
          <button className="border rounded px-3 py-2 text-sm font-semibold">
            Filtrar
          </button>
          <Link className="underline text-sm self-center" href="/admin/certifications">
            Limpar
          </Link>
        </form>
      </header>

      <section className="border rounded overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-zinc-50">
            <tr className="text-left">
              <th className="p-3">Pessoa</th>
              <th className="p-3">Curso</th>
              <th className="p-3">Emitido</th>
              <th className="p-3">Gerado</th>
              <th className="p-3">Arquivos</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data?.length ? (
              data.map((row: any) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3">{row.people?.full_name ?? "-"}</td>
                  <td className="p-3">{row.courses?.name ?? "-"}</td>
                  <td className="p-3">
                    {row.issued_at ? new Date(row.issued_at).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td className="p-3">
                    {row.rendered_at ? new Date(row.rendered_at).toLocaleString("pt-BR") : "-"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-3 flex-wrap">
                      {row.png_url ? (
                        <a className="underline" href={row.png_url} target="_blank">
                          PNG
                        </a>
                      ) : (
                        <span className="opacity-50">PNG</span>
                      )}
                      {row.pdf_url ? (
                        <a className="underline" href={row.pdf_url} target="_blank">
                          PDF
                        </a>
                      ) : (
                        <span className="opacity-50">PDF</span>
                      )}
                      {row.public_token ? (
                        <a className="underline" href={`/certificado/${row.public_token}`} target="_blank">
                          Público
                        </a>
                      ) : (
                        <span className="opacity-50">Público</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <Link className="underline" href={`/admin/certifications/${row.id}`}>
                      Ver
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-3" colSpan={6}>
                  <span className="opacity-70">Nenhum resultado.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <footer className="flex items-center justify-between">
        <div className="text-sm opacity-70">
          Página <strong>{page}</strong> de <strong>{totalPages}</strong>
        </div>

        <div className="flex gap-2">
          <Link
            className={`border rounded px-3 py-2 text-sm ${!prevPage ? "pointer-events-none opacity-40" : ""}`}
            href={prevPage ? qs({ page: prevPage }) : "#"}
          >
            ← Anterior
          </Link>
          <Link
            className={`border rounded px-3 py-2 text-sm ${!nextPage ? "pointer-events-none opacity-40" : ""}`}
            href={nextPage ? qs({ page: nextPage }) : "#"}
          >
            Próxima →
          </Link>
        </div>
      </footer>
    </main>
  );
}
