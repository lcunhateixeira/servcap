import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewCredentialPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  const { data: people } = await supabase
    .from("people")
    .select("id, full_name, birth_date")
    .order("full_name");

  const { data: churches } = await supabase
    .from("churches")
    .select("id, name, cnpj")
    .order("name");

  async function issueCredential(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const person_id = String(formData.get("person_id") || "");
    const church_id = String(formData.get("church_id") || "");
    const kind = String(formData.get("kind") || "");

    if (!person_id || !church_id || !kind) return;

    // pega snapshot da igreja
    const { data: church } = await supabase
      .from("churches")
      .select("name, cnpj")
      .eq("id", church_id)
      .single();

    // se existir credencial ativa, revoga (por causa do índice uq_one_active_credential_per_person)
    await supabase
      .from("credentials")
      .update({ status: "revoked" })
      .eq("person_id", person_id)
      .eq("status", "active");

    const { data: cred, error } = await supabase
      .from("credentials")
      .insert({
        person_id,
        church_id,
        kind,
        issued_church_name: church?.name ?? null,
        issued_church_cnpj: church?.cnpj ?? null,
        status: "active",
      })
      .select("id")
      .single();

    if (!error && cred?.id) {
      await supabase.from("credential_events").insert({
        credential_id: cred.id,
        event_type: "issued",
        note: "Emissão inicial via admin",
      });
    }

    redirect("/admin/credentials");
  }

  return (
    <main className="p-6 max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Emitir credencial</h1>

      <form action={issueCredential} className="space-y-3 border rounded p-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Pessoa</label>
          <select name="person_id" className="border rounded p-2 w-full">
            <option value="">Selecione...</option>
            {(people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} — {p.birth_date}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Igreja</label>
          <select name="church_id" className="border rounded p-2 w-full">
            <option value="">Selecione...</option>
            {(churches ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.cnpj ? `— ${c.cnpj}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Tipo</label>
          <select name="kind" className="border rounded p-2 w-full">
            <option value="">Selecione...</option>
            <option value="volunteer_service">Serviço de Capelania</option>
            <option value="chaplain">Capelão</option>
          </select>
        </div>

        <button className="border rounded px-3 py-2 font-semibold">
          Emitir
        </button>
      </form>
    </main>
  );
}