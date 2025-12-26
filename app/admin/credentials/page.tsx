import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CredentialActions from "./credential-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 50;

type SP = {
  page?: string;
  q?: string;
  status?: string;
  kind?: string;
  church?: string;
};

function buildHref(base: string, params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim() !== "") qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export default async function AdminCredentialsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim(); // active|suspended|revoked|expired
  const kind = (sp.kind ?? "").trim(); // volunteer_service|chaplain
  const church = (sp.church ?? "").trim();

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
    .from("v_credentials_list")
    .select(
      "id, credential_number, kind, status, issued_at, expires_at, public_token, issued_church_name, issued_church_cnpj, full_name, birth_date",
      { count: "exact" }
    )
    .order("full_name", { ascending: true });

  // Busca geral (nome ou número)
  if (q) {
    query = query.or(`credential_number.ilike.%${q}%,full_name.ilike.%${q}%`);
  }

  // Filtros
  if (status) query = query.eq("status", status);
  if (kind) query = query.eq("kind", kind);
  if (church) query = query.ilike("issued_church_name", `%${church}%`);

  const { data: creds, error, count } = await query.range(from, to);

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Credenciais</h1>
        <p className="mt-4 text-red-600">Erro: {error.message}</p>
      </main>
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const prevPage = Math.max(currentPage - 1, 1);
  const nextPage = Math.min(currentPage + 1, totalPages);

  const baseParams = { q, status, kind, church };
  const prevHref = buildHref("/admin/credentials", {
    ...baseParams,
    page: String(prevPage),
  });
  const nextHref = buildHref("/admin/credentials", {
    ...baseParams,
    page: String(nextPage),
  });

  const labelKind = (k: string) =>
    k === "chaplain" ? "Capelão" : "Serviço de Capelania";

  return (
    <main className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credenciais</h1>
          <p className="text-sm opacity-70">
            Página {currentPage} de {totalPages} — {total} registros
          </p>
        </div>

        <Link className="border rounded px-3 py-2" href="/admin/credentials/new">
          + Emitir
        </Link>
      </header>

      {/* Filtros */}
      <form
        className="border rounded p-3 flex flex-wrap gap-2 items-end"
        method="get"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs font-medium">
            Buscar (Nome ou Nº)
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            className="border rounded p-2 text-sm"
            placeholder="Ex: SC-2025-000123 ou João"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-xs font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="border rounded p-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="revoked">revoked</option>
            <option value="expired">expired</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="kind" className="text-xs font-medium">
            Tipo
          </label>
          <select
            id="kind"
            name="kind"
            defaultValue={kind}
            className="border rounded p-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="volunteer_service">Serviço de Capelania</option>
            <option value="chaplain">Capelão</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="church" className="text-xs font-medium">
            Igreja
          </label>
          <input
            id="church"
            name="church"
            defaultValue={church}
            className="border rounded p-2 text-sm"
            placeholder="Ex: Batista"
          />
        </div>

        {/* ao filtrar, volta para a página 1 */}
        <input type="hidden" name="page" value="1" />

        <button className="border rounded px-3 py-2 text-sm font-semibold">
          Filtrar
        </button>

        <a className="underline text-sm ml-2" href="/admin/credentials">
          Limpar
        </a>
      </form>

      {/* Tabela */}
      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr className="text-left">
              <th className="p-3">Número</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Pessoa</th>
              <th className="p-3">Igreja</th>
              <th className="p-3">Validade</th>
              <th className="p-3">Status</th>
              <th className="p-3">Ações</th>
              <th className="p-3">Ver</th>
            </tr>
          </thead>
          <tbody>
            {(creds ?? []).map((c: any) => (
              <tr key={c.id} className="border-b align-top">
                <td className="p-3">{c.credential_number}</td>
                <td className="p-3">{labelKind(c.kind)}</td>
                <td className="p-3">
                  {c.full_name}
                  <div className="text-xs opacity-70">{c.birth_date}</div>
                </td>
                <td className="p-3">
                  {c.issued_church_name}
                  <div className="text-xs opacity-70">
                    {c.issued_church_cnpj ?? ""}
                  </div>
                </td>
                <td className="p-3">
                  {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="p-3">{c.status}</td>
                <td className="p-3">
                  <CredentialActions credentialId={c.id} status={c.status} />
                </td>
                <td className="p-3">
                  <Link
                    className="underline"
                    href={`/credencial/${c.public_token}`}
                    target="_blank"
                  >
                    abrir
                  </Link>
                </td>
              </tr>
            ))}
            {(!creds || creds.length === 0) && (
              <tr>
                <td className="p-6 opacity-70" colSpan={8}>
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
          className={`border rounded px-3 py-2 ${
            currentPage === 1 ? "pointer-events-none opacity-50" : ""
          }`}
          href={prevHref}
        >
          ← Anterior
        </Link>

        <Link
          className={`border rounded px-3 py-2 ${
            currentPage === totalPages ? "pointer-events-none opacity-50" : ""
          }`}
          href={nextHref}
        >
          Próxima →
        </Link>
      </div>
    </main>
  );
}
