import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PhotoUploader from "./photo-uploader";
import { formatDateBR } from "@/lib/formatters/date";
import { formatCPF } from "@/lib/formatters/helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 50;

type SP = {
  page?: string;
  q?: string; // busca nome
  birth?: string; // yyyy-mm-dd
};

function buildHref(base: string, params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim() !== "") qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const birth = (sp.birth ?? "").trim();

  const currentPage = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  let query = supabase
    .from("people")
    .select("id, full_name, birth_date, cpf, photo_url, created_at", {
      count: "exact",
    })
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  // Filtro nome
  if (q) query = query.ilike("full_name", `%${q}%`);

  // Filtro nascimento exato (opcional)
  if (birth) query = query.eq("birth_date", birth);

  const { data: people, error, count } = await query.range(from, to);

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Pessoas</h1>
        <p className="mt-4 text-red-600">Erro: {error.message}</p>
      </main>
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const prevPage = Math.max(currentPage - 1, 1);
  const nextPage = Math.min(currentPage + 1, totalPages);

  const baseParams = { q, birth };

  const prevHref = buildHref("/admin/people", {
    ...baseParams,
    page: String(prevPage),
  });

  const nextHref = buildHref("/admin/people", {
    ...baseParams,
    page: String(nextPage),
  });

  return (
    <main className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pessoas</h1>
          <p className="text-sm opacity-70">
            Página {currentPage} de {totalPages} — {total} registros
          </p>
        </div>

        <Link className="border rounded px-3 py-2" href="/admin/people/new">
          + Nova pessoa
        </Link>
      </header>

      {/* Filtros */}
      <form
        className="border rounded p-3 flex flex-wrap gap-2 items-end"
        method="get"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs font-medium">
            Buscar por nome
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            className="border rounded p-2 text-sm"
            placeholder="Ex: Maria, João..."
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="birth" className="text-xs font-medium">
            Nascimento (opcional)
          </label>
          <input
            id="birth"
            name="birth"
            type="date"
            defaultValue={birth}
            className="border rounded p-2 text-sm"
          />
        </div>

        {/* ao filtrar, volta para página 1 */}
        <input type="hidden" name="page" value="1" />

        <button className="border rounded px-3 py-2 text-sm font-semibold">
          Filtrar
        </button>

        <a className="underline text-sm ml-2" href="/admin/people">
          Limpar
        </a>
      </form>

      {/* Tabela */}
      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr className="text-left">
              <th className="p-3">CPF</th>
              <th className="p-3">Nome</th>
              <th className="p-3">Nascimento</th>
              <th className="p-3">Foto</th>
            </tr>
          </thead>
          <tbody>
            {(people ?? []).map((p) => (
              <tr key={p.id} className="border-b align-top">
                <td className="p-3">
                  {formatCPF(p.cpf)}
                </td>
                <td className="p-3">
                  <Link className="underline" href={`/admin/people/${p.id}`}>
                    {p.full_name}
                  </Link>
                </td>
                <td className="p-3">
                  {formatDateBR(p.birth_date)}
                </td>
                <td className="p-3">
                  <PhotoUploader personId={p.id} currentPhotoUrl={p.photo_url} />
                </td>
              </tr>
            ))}

            {(!people || people.length === 0) && (
              <tr>
                <td className="p-6 opacity-70" colSpan={3}>
                  Nenhum registro encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between">
        <Link
          className={`border rounded px-3 py-2 ${currentPage === 1 ? "pointer-events-none opacity-50" : ""
            }`}
          href={prevHref}
        >
          ← Anterior
        </Link>

        <Link
          className={`border rounded px-3 py-2 ${currentPage === totalPages ? "pointer-events-none opacity-50" : ""
            }`}
          href={nextHref}
        >
          Próxima →
        </Link>
      </div>
    </main>
  );
}
