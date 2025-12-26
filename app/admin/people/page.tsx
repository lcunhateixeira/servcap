import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminPeoplePage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  // checa role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  const { data: people, error } = await supabase
    .from("people")
    .select("id, full_name, birth_date, photo_url, created_at")
    .order("full_name", { ascending: true });

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Pessoas</h1>
        <p className="mt-4 text-red-600">Erro: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pessoas (Formados)</h1>
        <Link className="border rounded px-3 py-2" href="/admin/people/new">
          + Nova pessoa
        </Link>
      </header>

      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr className="text-left">
              <th className="p-3">Nome</th>
              <th className="p-3">Nascimento</th>
              <th className="p-3">Foto</th>
            </tr>
          </thead>
          <tbody>
            {(people ?? []).map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-3">{p.full_name}</td>
                <td className="p-3">{p.birth_date}</td>
                <td className="p-3">{p.photo_url ? "✅" : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
