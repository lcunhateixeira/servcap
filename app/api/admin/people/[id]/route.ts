import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // valida sessão
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // valida role
    const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", auth.user.id)
        .single();

    if (pErr || !profile || profile.role !== "super_admin") {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const full_name = String(body.full_name ?? "").trim();
    const birth_date = body.birth_date ? String(body.birth_date) : null;

    if (!full_name) {
        return NextResponse.json(
            { error: "Nome é obrigatório" },
            { status: 400 }
        );
    }
    //Normaliza CPF
    const cpfRaw = body.cpf ? String(body.cpf) : null;
    const cpf = cpfRaw ? cpfRaw.replace(/\D/g, "") : null;

    if (cpf && cpf.length !== 11) {
        return NextResponse.json({ error: "CPF inválido (precisa ter 11 dígitos)" }, { status: 400 });
    }

    // Atualiza com service role (robusto)
    const admin = createAdminClient();

    const { error: upErr } = await admin
        .from("people")
        .update({ full_name, birth_date, cpf })
        .eq("id", id);

    if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // valida sessão
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // valida role
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", auth.user.id)
        .single();

    if (!profile || profile.role !== "super_admin") {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // (opcional) verificar se possui credenciais
    const admin = createAdminClient();

    const { count } = await admin
        .from("credentials")
        .select("id", { count: "exact", head: true })
        .eq("person_id", id);

    if ((count ?? 0) > 0) {
        // soft delete
        await admin
            .from("people")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id);

        return NextResponse.json({ ok: true, mode: "soft-delete" });
    }

    // se não tiver vínculos, também fazemos soft delete (consistência)
    await admin
        .from("people")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

    return NextResponse.json({ ok: true, mode: "soft-delete" });
}

