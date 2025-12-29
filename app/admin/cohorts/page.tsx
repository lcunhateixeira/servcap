import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CohortsPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).single();
  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  const { data } = await supabase
    .from("cohorts")
    .select("id, name, starts_at, ends_at, courses:course_id(name)")
    .order("starts_at", { ascending: false });

  return (
    <main className="p-6 space-y-4">
      <header className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">Turmas</h1>
        <Link className="border rounded px-3 py-2 text-sm font-semibold" href="/admin/cohorts/new">
          + Nova turma
        </Link>
      </header>

      <section className="border rounded overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-zinc-50">
            <tr className="text-left">
              <th className="p-3">Turma</th>
              <th className="p-3">Curso</th>
              <th className="p-3">Início</th>
              <th className="p-3">Fim</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.name}</td>
                <td className="p-3">{r.courses?.name ?? "-"}</td>
                <td className="p-3">{r.starts_at ? new Date(r.starts_at).toLocaleDateString("pt-BR") : "-"}</td>
                <td className="p-3">{r.ends_at ? new Date(r.ends_at).toLocaleDateString("pt-BR") : "-"}</td>
                <td className="p-3">
                  <Link className="underline" href={`/admin/cohorts/${r.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
