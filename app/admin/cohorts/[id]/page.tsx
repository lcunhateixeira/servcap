import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RenderCertificatesButton from "./render-certificates-button";
import EnrollmentsManager from "./enrollments-manager";
import type { EnrollmentRow } from "./enrollments-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export default async function AdminCohortDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: cohortId } = await params;

  const supabase = await createClient();

  // auth + role
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  // turma + curso
  const { data: cohort, error: eCoh } = await supabase
    .from("cohorts")
    .select("id, name, course_id, starts_at, ends_at, courses:course_id(name)")
    .eq("id", cohortId)
    .single();

  // Buscar curso relacionado
  const { data: course, error: eCourse } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", cohort?.course_id)
    .single();

  if (eCoh || !cohort) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Turma</h1>
        <p className="text-red-600">Turma não encontrada.</p>
        <Link className="underline" href="/admin/cohorts">Voltar</Link>
      </main>
    );
  }

  const { data: rawEnrollments, error: eEnr } = await supabase
    .from("enrollments")
    .select(`
    id,
    person_id,
    status,
    created_at,
    people:person_id (
      full_name
    )
  `)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (eEnr) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Turma</h1>
        <p className="text-red-600">Erro ao carregar matrículas: {eEnr.message}</p>
      </main>
    );
  }

  // normaliza para o formato esperado pelo EnrollmentsManager
  const enrollments: EnrollmentRow[] =
    (rawEnrollments ?? []).map((row: any) => ({
      id: row.id,
      person_id: row.person_id,
      status: row.status,
      created_at: row.created_at,
      people: Array.isArray(row.people)
        ? row.people[0] ?? null   // se vier array, pega o primeiro
        : row.people ?? null,     // se já vier objeto ou undefined
    }));


  return (
    <main className="p-6 space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Turma - v1</h1>
          <p className="text-sm opacity-70">
            Curso: <strong>{course?.name ?? "-"}</strong>
          </p>
          <p className="text-sm opacity-70">
            Turma: <strong>{cohort.name ?? cohort.id}</strong>
          </p>
          <p className="text-sm opacity-70">
            Período:{" "}
            <strong>
              {cohort.starts_at ? new Date(cohort.starts_at).toLocaleDateString("pt-BR") : "-"}
            </strong>{" "}
            a{" "}
            <strong>
              {cohort.ends_at ? new Date(cohort.ends_at).toLocaleDateString("pt-BR") : "-"}
            </strong>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Link className="underline" href="/admin/cohorts">← Voltar</Link>
          <RenderCertificatesButton cohortId={cohortId} />
        </div>
      </header>

      <section className="border rounded p-4">
        <h2 className="font-semibold mb-3">Alunos da turma</h2>
        <EnrollmentsManager cohortId={cohortId} initialEnrollments={enrollments ?? []} />
      </section>
    </main>
  );
}
