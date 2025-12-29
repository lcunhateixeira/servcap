import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const admin = createAdminClient();
    
    // 1) pegar person_id e cohort_id do enrollment
    const { data: enr, error: e1 } = await admin
        .from("enrollments")
        .select("person_id, cohort_id")
        .eq("id", id)
        .single();

    if (e1 || !enr) return NextResponse.json({ error: "Enrollment não encontrado" }, { status: 404 });

    // 2) ver se existe certificação
    const { count, error: e2 } = await admin
        .from("certifications")
        .select("id", { count: "exact", head: true })
        .eq("person_id", enr.person_id)
        .eq("cohort_id", enr.cohort_id);

    if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

    if ((count ?? 0) > 0) {
        return NextResponse.json(
            { error: "Não é possível remover: já existe certificado para este aluno nesta turma." },
            { status: 400 }
        );
    }

    // 3) delete
    const { error: e3 } = await admin.from("enrollments").delete().eq("id", id);
    if (e3) return NextResponse.json({ error: e3.message }, { status: 400 });

    return NextResponse.json({ ok: true });
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    console.log("PATCH /admin/enrollments/[id]");
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
    console.log("Updating enrollment", id, "to status", status);
    const { error } = await admin.from("enrollments").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
}