import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminCredentialsPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  const { data: creds, error } = await supabase
    .from("credentials")
    .select(
      "id, credential_number, kind, status, issued_at, expires_at, public_token, people(full_name, birth_date), issued_church_name, issued_church_cnpj"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Credenciais</h1>
        <p className="mt-4 text-red-600">Erro: {error.message}</p>
      </main>
    );
  }

  const labelKind = (k: string) =>
    k === "chaplain" ? "Capelão" : "Serviço de Capelania";

  return (
    <main className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Credenciais</h1>
        <Link className="border rounded px-3 py-2" href="/admin/credentials/new">
          + Emitir
        </Link>
      </header>

      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr className="text-left">
              <th className="p-3">Número</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Pessoa</th>
              <th className="p-3">Igreja</th>
              <th className="p-3">Validade</th>
              <th className="p-3">Status</th>
              <th className="p-3">Ver</th>
            </tr>
          </thead>
          <tbody>
            {(creds ?? []).map((c: any) => (
              <tr key={c.id} className="border-b">
                <td className="p-3">{c.credential_number}</td>
                <td className="p-3">{labelKind(c.kind)}</td>
                <td className="p-3">
                  {c.people?.full_name} — {c.people?.birth_date}
                </td>
                <td className="p-3">
                  {c.issued_church_name}
                  {c.issued_church_cnpj ? ` — ${c.issued_church_cnpj}` : ""}
                </td>
                <td className="p-3">
                  {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="p-3">{c.status}</td>
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
          </tbody>
        </table>
      </div>
    </main>
  );
}
