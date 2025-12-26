import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewPersonPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  async function createPerson(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const full_name = String(formData.get("full_name") || "").trim();
    const birth_date = String(formData.get("birth_date") || "").trim();
    const photo_url = String(formData.get("photo_url") || "").trim() || null;

    if (!full_name || !birth_date) {
      // simples: volta sem criar
      return;
    }

    await supabase.from("people").insert({ full_name, birth_date, photo_url });
    redirect("/admin/people");
  }

  return (
    <main className="p-6 max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Nova pessoa</h1>

      <form action={createPerson} className="space-y-3 border rounded p-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Nome completo</label>
          <input name="full_name" className="border rounded p-2 w-full" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Data de nascimento</label>
          <input
            name="birth_date"
            type="date"
            className="border rounded p-2 w-full"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Foto (URL)</label>
          <input name="photo_url" className="border rounded p-2 w-full" />
        </div>

        <button className="border rounded px-3 py-2 font-semibold">
          Salvar
        </button>
      </form>
    </main>
  );
}
