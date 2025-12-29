import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).single();
  if (!profile || profile.role !== "super_admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const course_id = String(body.course_id ?? "");
  const name = String(body.name ?? "").trim();
  const starts_at = body.starts_at ? String(body.starts_at) : null;
  const ends_at = body.ends_at ? String(body.ends_at) : null;

  if (!course_id || !name) return NextResponse.json({ error: "course_id e name são obrigatórios" }, { status: 400 });

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("cohorts")
    .insert([{ course_id, name, starts_at, ends_at }])
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, id: data.id });
}
