import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderCertificateFiles } from "@/lib/certificates/render";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;

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
  console.log("Iniciando renderização de certificados para turma:", cohortId);
  // 1) turma -> course_id
  const { data: cohort, error: eCoh } = await admin
    .from("cohorts")
    .select("id, course_id, city, state, dates_text")
    .eq("id", cohortId)
    .single();

  if (eCoh || !cohort) {
    return NextResponse.json({ error: eCoh?.message ?? "Turma não encontrada" }, { status: 404 });
  }

  // 2) enrollments concluídos
  const { data: enrollments, error: eEnroll } = await admin
    .from("enrollments")
    .select("id, person_id, status")
    .eq("cohort_id", cohortId)
    .eq("status", "concluído");

  if (eEnroll) return NextResponse.json({ error: eEnroll.message }, { status: 400 });

  if (!enrollments?.length) {
    return NextResponse.json({ ok: true, total: 0, generated: 0, failed: [] });
  }

  //Load course data
  const { data: course, error: eCourse } = await admin
    .from("courses")
    .select("id, name, description, hours, topics")
    .eq("id", cohort.course_id)
    .single();
  if (eCourse || !course) {
    return NextResponse.json({ error: eCourse?.message ?? "Curso não encontrado" }, { status: 404 });
  }

  // 3) upsert certifications (1 por pessoa na turma)
  const nowIso = new Date().toISOString();
  const toUpsert = enrollments.map((enr) => ({
    person_id: enr.person_id,
    cohort_id: cohortId,
    course_id: cohort.course_id,
    hours: course.hours,
    topics: course.topics,
    city: cohort.city,
    state: cohort.state,
    dates_text: cohort.dates_text,
    issued_at: nowIso,
  }));

  const { data: certs, error: eUp } = await admin
    .from("certifications")
    .upsert(toUpsert, { onConflict: "person_id,cohort_id" })
    .select("id, person_id");

  if (eUp) return NextResponse.json({ error: eUp.message }, { status: 400 });

  // 4) render
  const failed: Array<{ person_id: string; certification_id: string; error: string }> = [];
  let generated = 0;

  for (const c of certs ?? []) {
    try {
      await renderCertificateFiles(c.id);
      generated++;
    } catch (err: any) {
      failed.push({
        person_id: c.person_id,
        certification_id: c.id,
        error: err?.message ?? String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, total: enrollments.length, generated, failed });
}
