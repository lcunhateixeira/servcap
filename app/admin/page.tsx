import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Card({
  title,
  value,
  subtitle,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  href?: string;
}) {
  const content = (
    <div className="border rounded-lg p-4 bg-white hover:bg-zinc-50 transition-colors">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {subtitle && <div className="text-xs opacity-60 mt-2">{subtitle}</div>}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // auth + role (mantém também aqui, mesmo já tendo no layout — evita flash se layout mudar)
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  const nowIso = new Date().toISOString();

  // CONTAGENS (usar head:true para performance)
  const [
    peopleCount,
    credentialsActiveCount,
    credentialsExpiredCount,
    certificationsCount,
    cohortsCount,
    enrollmentsCount,
  ] = await Promise.all([
    supabase.from("people").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("credentials").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("credentials")
      .select("id", { count: "exact", head: true })
      .lt("expires_at", nowIso)
      .neq("status", "revoked"),
    supabase.from("certifications").select("id", { count: "exact", head: true }),
    supabase.from("cohorts").select("id", { count: "exact", head: true }),
    supabase.from("enrollments").select("id", { count: "exact", head: true }),
  ]);

  const people = peopleCount.count ?? 0;
  const credActive = credentialsActiveCount.count ?? 0;
  const credExpired = credentialsExpiredCount.count ?? 0;
  const certs = certificationsCount.count ?? 0;
  const cohorts = cohortsCount.count ?? 0;
  const enrollments = enrollmentsCount.count ?? 0;

  // Recentes (opcional)
  const { data: recentCreds } = await supabase
    .from("credentials")
    .select("id, credential_number, kind, status, issued_at, expires_at, people:person_id(full_name)")
    .order("issued_at", { ascending: false })
    .limit(6);

  const { data: recentCerts } = await supabase
    .from("certifications")
    .select("id, issued_at, people:person_id(full_name), courses:course_id(name), cohorts:cohort_id(name)")
    .order("issued_at", { ascending: false })
    .limit(6);

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard • Admin</h1>
          <p className="text-sm opacity-70">
            Visão geral do sistema (pessoas, credenciais, turmas e certificados).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link className="border rounded px-3 py-2 text-sm font-semibold" href="/admin/people/new">
            + Nova pessoa
          </Link>
          <Link className="border rounded px-3 py-2 text-sm font-semibold" href="/admin/cohorts/new">
            + Nova turma
          </Link>
          <Link className="border rounded px-3 py-2 text-sm font-semibold" href="/admin/credentials">
            Emitir credencial
          </Link>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card title="Pessoas" value={people} subtitle="Cadastros ativos" href="/admin/people" />
        <Card title="Credenciais ativas" value={credActive} subtitle="Status = active" href="/admin/credentials?status=active" />
        <Card title="Credenciais vencidas" value={credExpired} subtitle="expires_at < hoje" href="/admin/credentials?status=expired" />
        <Card title="Certificados" value={certs} subtitle="Total emitidos" href="/admin/certifications" />
        <Card title="Turmas" value={cohorts} subtitle="Total de cohorts" href="/admin/cohorts" />
        <Card title="Matrículas" value={enrollments} subtitle="Total de enrollments" href="/admin/cohorts" />
      </section>

      {/* Recentes */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Credenciais recentes</h2>
            <Link className="text-sm underline" href="/admin/credentials">
              Ver todas
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            {(recentCreds ?? []).length ? (
              recentCreds!.map((c: any) => (
                <div key={c.id} className="border rounded p-3 text-sm">
                  <div className="font-semibold">{c.credential_number}</div>
                  <div className="opacity-70">
                    {c.people?.full_name ?? "-"} • {c.kind} • {c.status}
                  </div>
                  <div className="text-xs opacity-60 mt-1">
                    Emitida: {c.issued_at ? new Date(c.issued_at).toLocaleDateString("pt-BR") : "-"} •
                    Validade: {c.expires_at ? new Date(c.expires_at).toLocaleDateString("pt-BR") : "-"}
                  </div>
                  <div className="mt-2">
                    <Link className="underline text-xs" href={`/admin/credentials/${c.id}`}>
                      Abrir
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm opacity-60">Nenhuma credencial encontrada.</p>
            )}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Certificados recentes</h2>
            <Link className="text-sm underline" href="/admin/certifications">
              Ver todos
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            {(recentCerts ?? []).length ? (
              recentCerts!.map((c: any) => (
                <div key={c.id} className="border rounded p-3 text-sm">
                  <div className="font-semibold">{c.people?.full_name ?? "-"}</div>
                  <div className="opacity-70">
                    {c.courses?.name ?? "-"} • Turma: {c.cohorts?.name ?? "-"}
                  </div>
                  <div className="text-xs opacity-60 mt-1">
                    Emissão: {c.issued_at ? new Date(c.issued_at).toLocaleDateString("pt-BR") : "-"}
                  </div>
                  <div className="mt-2">
                    <Link className="underline text-xs" href={`/admin/certifications/${c.id}`}>
                      Abrir
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm opacity-60">Nenhum certificado encontrado.</p>
            )}
          </div>
        </div>
      </section>

      {/* Atalhos úteis */}
      <section className="border rounded-lg p-4 bg-white">
        <h2 className="font-semibold">Atalhos</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="border rounded px-3 py-2 text-sm" href="/admin/people">
            Pessoas
          </Link>
          <Link className="border rounded px-3 py-2 text-sm" href="/admin/cohorts">
            Turmas
          </Link>
          <Link className="border rounded px-3 py-2 text-sm" href="/admin/credentials">
            Credenciais
          </Link>
          <Link className="border rounded px-3 py-2 text-sm" href="/admin/certifications">
            Certificados
          </Link>
        </div>
      </section>
    </main>
  );
}
