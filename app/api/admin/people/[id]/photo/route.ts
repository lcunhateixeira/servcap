import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // valida sessão (admin logado)
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // valida super_admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Envie uma imagem" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Máximo 2MB" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${id}/photo.${ext}`;

  const admin = createAdminClient();

  const { error: upErr } = await admin.storage
    .from("people-photos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  const { data: urlData } = admin.storage.from("people-photos").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  const { error: dbErr } = await admin
    .from("people")
    .update({ photo_url: publicUrl })
    .eq("id", id);

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, photo_url: publicUrl });
}
