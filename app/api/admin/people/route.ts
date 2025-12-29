import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Number(url.searchParams.get("page") ?? "1");

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // auth
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // role (super_admin)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // query people
  let query = supabase
    .from("people")
    .select("id, full_name", { count: "exact" })
    .is("deleted_at", null)
    .order("full_name", { ascending: true })
    .range(from, to);

  if (q) {
    query = query.ilike("full_name", `%${q}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    data: data ?? [],
    page: safePage,
    pageSize: PAGE_SIZE,
    count: count ?? 0,
  });
}