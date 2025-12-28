import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderCredentialImages } from "@/lib/credentials/render";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  const { frontUrl, backUrl } = await renderCredentialImages(id);
  return NextResponse.json({ ok: true, frontUrl, backUrl });
}