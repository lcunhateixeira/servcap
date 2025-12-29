import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).single();
  if (!profile || profile.role !== "super_admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const person_id = String(body.person_id ?? "");
  const status = String(body.status ?? "matriculado");

  if (!person_id) return NextResponse.json({ error: "person_id é obrigatório" }, { status: 400 });

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("enrollments")
    .insert([{ cohort_id: cohortId, person_id, status }])
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, id: data.id });
}
