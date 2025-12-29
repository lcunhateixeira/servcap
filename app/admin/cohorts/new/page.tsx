import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CohortForm from "./cohort-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewCohortPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).single();
  if (!profile || profile.role !== "super_admin") redirect("/dashboard");

  const { data: courses } = await supabase.from("courses").select("id, name").order("name");

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Nova Turma</h1>
      <CohortForm courses={courses ?? []} />
    </main>
  );
}
