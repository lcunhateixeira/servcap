import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderCertificateFiles } from "@/lib/certificates/render";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;

  const body = await req.json().catch(() => ({}));
  const personId = String(body?.person_id ?? "");

  if (!personId) {
    return NextResponse.json({ error: "person_id é obrigatório" }, { status: 400 });
  }

  // auth + role
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Verifica que o aluno está na turma e está "concluído"
  const { data: enr, error: eEnr } = await admin
    .from("enrollments")
    .select("id, status")
    .eq("cohort_id", cohortId)
    .eq("person_id", personId)
    .single();

  if (eEnr || !enr) return NextResponse.json({ error: "Enrollment não encontrado" }, { status: 404 });

  if (enr.status !== "concluído") {
    return NextResponse.json({ error: "Somente status 'concluído' pode gerar certificado" }, { status: 400 });
  }

  // Pega course_id da turma
  const { data: cohort, error: eCoh } = await admin
    .from("cohorts")
    .select("id, course_id")
    .eq("id", cohortId)
    .single();

  if (eCoh || !cohort) return NextResponse.json({ error: "Turma não encontrada" }, { status: 404 });

  // Upsert do certificado (1 por pessoa+turma)
  const nowIso = new Date().toISOString();
  const { data: cert, error: eUp } = await admin
    .from("certifications")
    .upsert(
      [{ person_id: personId, cohort_id: cohortId, course_id: cohort.course_id, issued_at: nowIso }],
      { onConflict: "person_id,cohort_id" }
    )
    .select("id")
    .single();

  if (eUp || !cert) return NextResponse.json({ error: eUp?.message ?? "Falha ao criar certificado" }, { status: 400 });

  // Renderiza PNG+PDF e salva URLs
  const out = await renderCertificateFiles(cert.id);

  return NextResponse.json({ ok: true, certificationId: cert.id, ...out });
}
