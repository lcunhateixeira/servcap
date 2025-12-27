import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCredentialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  // auth
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  // role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  // credencial
  const { data: c, error } = await supabase
    .from("credentials")
    .select(
      "id, credential_number, kind, status, issued_at, expires_at, public_token, front_image_url, back_image_url, rendered_at, person_id"
    )
    .eq("id", id)
    .single();

  if (error || !c) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Credencial</h1>
        <p className="text-red-600">Credencial não encontrada.</p>
        <Link className="underline" href="/admin/credentials">
          Voltar
        </Link>
      </main>
    );
  }

  // pessoa (para mostrar nome)
  const { data: p } = await supabase
    .from("people")
    .select("full_name")
    .eq("id", c.person_id)
    .single();

  const publicUrl = `/credencial/${c.public_token}`;

  return (
    <main className="p-6 space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Credencial</h1>
          <p className="text-sm opacity-70">{c.credential_number}</p>
          <p className="text-sm opacity-70">
            Pessoa: <strong>{p?.full_name ?? "-"}</strong>
          </p>
          <p className="text-sm opacity-70">
            Status: <strong>{c.status}</strong>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Link className="underline" href="/admin/credentials">
            ← Voltar
          </Link>

          <div className="flex gap-2">
            <Link className="underline text-sm" href={publicUrl} target="_blank">
              Página pública
            </Link>
            {c.front_image_url && (
              <a className="underline text-sm" href={c.front_image_url} target="_blank">
                Abrir frente
              </a>
            )}
            {c.back_image_url && (
              <a className="underline text-sm" href={c.back_image_url} target="_blank">
                Abrir verso
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="border rounded p-4">
        <h2 className="font-semibold mb-3">Ações</h2>
        <RenderCredentialButton credentialId={c.id} />
        {c.rendered_at && (
          <p className="text-xs opacity-70 mt-2">
            Última geração: {new Date(c.rendered_at).toLocaleString("pt-BR")}
          </p>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-3">Frente</h2>
          {c.front_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.front_image_url}
              alt="Frente da credencial"
              className="w-full rounded border"
            />
          ) : (
            <p className="text-sm opacity-70">Ainda não gerada.</p>
          )}
        </div>

        <div className="border rounded p-4">
          <h2 className="font-semibold mb-3">Verso</h2>
          {c.back_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.back_image_url}
              alt="Verso da credencial"
              className="w-full rounded border"
            />
          ) : (
            <p className="text-sm opacity-70">Ainda não gerada.</p>
          )}
        </div>
      </section>
    </main>
  );
}

// Import “inline” para manter simples
import RenderCredentialButton from "./render-credential-button";
