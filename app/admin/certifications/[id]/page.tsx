import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RenderCertificateButton from "./render-certificate-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCertificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  const { data: cert, error } = await supabase
    .from("certifications")
    .select("id, person_id, course_id, issued_at, png_url, pdf_url, public_token, rendered_at, hours, topics, city, state, dates_text")
    .eq("id", id)
    .single();

  if (error || !cert) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Certificado</h1>
        <p className="text-red-600">Certificado não encontrado.</p>
        <Link className="underline" href="/admin/certifications">Voltar</Link>
      </main>
    );
  }

  const { data: person } = await supabase
    .from("people")
    .select("full_name")
    .eq("id", cert.person_id)
    .single();

  const { data: course } = await supabase
    .from("courses")
    .select("name")
    .eq("id", cert.course_id)
    .single();

  const publicUrl = cert.public_token ? `/certificado/${cert.public_token}` : null;

  return (
    <main className="p-6 space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Certificado</h1>
          <p className="text-sm opacity-70">V1 Pessoa: <strong>{person?.full_name ?? "-"}</strong></p>
          <p className="text-sm opacity-70">Curso: <strong>{course?.name ?? "-"}</strong></p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Link className="underline" href="/admin/certifications">← Voltar</Link>
          <div className="flex gap-2 flex-wrap justify-end">
            {publicUrl && (
              <Link className="underline text-sm" href={publicUrl} target="_blank">Página pública</Link>
            )}
            {cert.pdf_url && (
              <a className="underline text-sm" href={cert.pdf_url} target="_blank">Baixar PDF</a>
            )}
            {cert.png_url && (
              <a className="underline text-sm" href={cert.png_url} target="_blank">Abrir PNG</a>
            )}
          </div>
        </div>
      </header>

      <section className="border rounded p-4">
        <h2 className="font-semibold mb-3">Ações</h2>
        <RenderCertificateButton certificationId={cert.id} />
        {cert.rendered_at && (
          <p className="text-xs opacity-70 mt-2">
            Última geração: {new Date(cert.rendered_at).toLocaleString("pt-BR")}
          </p>
        )}
      </section>

      <section className="border rounded p-4">
        <h2 className="font-semibold mb-3">Preview</h2>

        {cert.png_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={cert.rendered_at ?? cert.png_url}
            src={`${cert.png_url}?v=${encodeURIComponent(cert.rendered_at ?? Date.now().toString())}`}
            alt="Certificado"
            className="w-full rounded border"
          />
        ) : (
          <p className="text-sm opacity-70">Ainda não gerado.</p>
        )}
      </section>
    </main>
  );
}
