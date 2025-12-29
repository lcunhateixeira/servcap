import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).single();
  if (!profile || profile.role !== "super_admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const status = String(body.status ?? "");

  if (!status) return NextResponse.json({ error: "status é obrigatório" }, { status: 400 });

  const admin = createAdminClient();

  const { error } = await admin.from("enrollments").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).single();
  if (!profile || profile.role !== "super_admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const admin = createAdminClient();

  const { error } = await admin.from("enrollments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
