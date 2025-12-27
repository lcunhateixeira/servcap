import { NextResponse } from "next/server";
import QRCode from "qrcode";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateBR } from "@/lib/formatters/date";
import { formatCPF } from "@/lib/formatters/helper";

async function fetchAsDataUrl(url: string): Promise<string | null> {
    try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const buf = Buffer.from(await resp.arrayBuffer());
        // tenta manter como jpeg/png; como é DataURL, ok ser genérico
        return `data:${resp.headers.get("content-type") ?? "image/jpeg"};base64,${buf.toString("base64")}`;
    } catch {
        return null;
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    console.log("[render] id =", id);

    // 1) valida sessão e role (super_admin)
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", auth.user.id)
        .single();

    if (!profile || profile.role !== "super_admin") {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const admin = createAdminClient();

    // 2) busca credencial
    // const { data: c, error } = await admin
    //     .from("credentials")
    //     .select(`
    //                 id,
    //                 credential_number,
    //                 kind,
    //                 status,
    //                 issued_at,
    //                 expires_at,
    //                 public_token,
    //                 person_id,
    //                 church_id,
    //                 people:people!credentials_person_id_fkey(
    //                 full_name,
    //                 birth_date,
    //                 cpf,
    //                 photo_url
    //             ),
    //                 churches:churches!credentials_church_id_fkey(
    //                     name,
    //                     cnpj
    //                 )
    //             `)
    //     .eq("id", id)
    //     .single();

    const { data: c, error } = await admin
        .from("credentials")
        .select("id, credential_number, kind, status, issued_at, expires_at, public_token, person_id, church_id")
        .eq("id", id)
        .single();

    console.log("[render] error =", error?.message);
    console.log("[render] c =", c);

    if (error || !c) {
        return NextResponse.json({ error: "Credencial não encontrada", details: error?.message ?? null }, { status: 404 });
    }

    const { data: person, error: ePerson } = await admin
        .from("people")
        .select("full_name, birth_date, cpf, photo_url")
        .eq("id", c.person_id)
        .single();

    if (ePerson || !person) {
        return NextResponse.json({ error: "Pessoa não encontrada", details: ePerson?.message ?? null }, { status: 404 });
    }

    let churchName = "";
    let churchCnpj = "";

    if (c.church_id) {
        const { data: church, error: eChurch } = await admin
            .from("churches")
            .select("name, cnpj")
            .eq("id", c.church_id)
            .single();

        if (!eChurch && church) {
            churchName = church.name ?? "";
            churchCnpj = church.cnpj ?? "";
        }
    }


    // 4) URL pública p/ QR
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
        return NextResponse.json(
            { error: "NEXT_PUBLIC_APP_URL não configurado" },
            { status: 500 }
        );
    }

    const publicCredentialUrl = `${appUrl}/credencial/${c.public_token}`;

    const qrDataUrl = await QRCode.toDataURL(publicCredentialUrl, {
        margin: 1,
        width: 220,
    });


    // 5) gerar SVGs (horizontal 1000x640)
    const W = 1000;
    const H = 640;

    const title = c.kind === "chaplain" ? "CAPELÃO" : "SERVIÇO DE CAPELANIA";

    const personName = person.full_name ?? "";
    const personBirth = person.birth_date ?? null;
    const personCpf = person.cpf ?? null;
    const personPhotoUrl = person.photo_url ?? null;

    const cpfBR = formatCPF(personCpf);
    const birthBR = formatDateBR(personBirth);
    const expBR = formatDateBR(c.expires_at);

    const photoDataUrl = personPhotoUrl ? await fetchAsDataUrl(personPhotoUrl) : null;

    const frontSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <rect x="0" y="0" width="100%" height="120" fill="#111827"/>
    <text x="40" y="72" font-size="34" font-family="Arial" fill="#ffffff" font-weight="700">${title}</text>
    <text x="40" y="105" font-size="16" font-family="Arial" fill="#d1d5db">${churchName}</text>

    <rect x="40" y="160" width="220" height="220" rx="18" fill="#f3f4f6" stroke="#e5e7eb"/>
    ${photoDataUrl
            ? `<image href="${photoDataUrl}" x="40" y="160" width="220" height="220" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 18)"/>`
            : `<text x="150" y="280" font-size="14" font-family="Arial" fill="#6b7280" text-anchor="middle">SEM FOTO</text>`
        }

    <text x="290" y="200" font-size="16" font-family="Arial" fill="#6b7280">Nome</text>
    <text x="290" y="235" font-size="28" font-family="Arial" fill="#111827" font-weight="700">${personName ?? ""}</text>

    <text x="290" y="285" font-size="16" font-family="Arial" fill="#6b7280">CPF</text>
    <text x="290" y="320" font-size="22" font-family="Arial" fill="#111827" font-weight="700">${cpfBR}</text>

    <text x="290" y="365" font-size="16" font-family="Arial" fill="#6b7280">Nascimento</text>
    <text x="290" y="400" font-size="22" font-family="Arial" fill="#111827" font-weight="700">${birthBR}</text>

    <text x="40" y="470" font-size="16" font-family="Arial" fill="#6b7280">Nº Credencial</text>
    <text x="40" y="505" font-size="28" font-family="Arial" fill="#111827" font-weight="700">${c.credential_number}</text>

    <text x="40" y="555" font-size="16" font-family="Arial" fill="#6b7280">Validade</text>
    <text x="40" y="590" font-size="22" font-family="Arial" fill="#111827" font-weight="700">${expBR}</text>

    <image href="${qrDataUrl}" x="${W - 280}" y="${H - 320}" width="220" height="220"/>
    <text x="${W - 280}" y="${H - 70}" font-size="14" font-family="Arial" fill="#6b7280">Verificar credencial</text>
  </svg>
  `;

    const backSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <rect x="0" y="0" width="100%" height="120" fill="#111827"/>
    <text x="40" y="72" font-size="28" font-family="Arial" fill="#ffffff" font-weight="700">ESCOLA DE CAPELANIA</text>
    <text x="40" y="105" font-size="14" font-family="Arial" fill="#d1d5db">Emissão e validação</text>

    <text x="40" y="170" font-size="18" font-family="Arial" fill="#111827" font-weight="700">Dados da Escola</text>
    <text x="40" y="205" font-size="16" font-family="Arial" fill="#374151">Escola: Escola de Capelania Integral</text>
    <text x="40" y="230" font-size="16" font-family="Arial" fill="#374151">Assinatura: _______________________________</text>

    <text x="40" y="285" font-size="18" font-family="Arial" fill="#111827" font-weight="700">Igreja vinculada</text>
    <text x="40" y="320" font-size="16" font-family="Arial" fill="#374151">${churchName}</text>
    <text x="40" y="345" font-size="16" font-family="Arial" fill="#374151">CNPJ: ${churchCnpj || "-"}</text>

    <text x="40" y="400" font-size="18" font-family="Arial" fill="#111827" font-weight="700">Verificação</text>
    <text x="40" y="430" font-size="16" font-family="Arial" fill="#374151">Use o QR Code para validar a credencial online.</text>

    <image href="${qrDataUrl}" x="${W - 280}" y="${H - 320}" width="220" height="220"/>
    <text x="${W - 280}" y="${H - 70}" font-size="12" font-family="Arial" fill="#6b7280">${publicCredentialUrl}</text>
  </svg>
  `;

    // 6) converter para PNG
    const frontPng = await sharp(Buffer.from(frontSvg)).png().toBuffer();
    const backPng = await sharp(Buffer.from(backSvg)).png().toBuffer();

    // 7) upload no storage
    const frontPath = `${c.id}/front.png`;
    const backPath = `${c.id}/back.png`;

    const { error: up1 } = await admin.storage
        .from("credential-cards")
        .upload(frontPath, frontPng, { upsert: true, contentType: "image/png" });

    if (up1) return NextResponse.json({ error: up1.message }, { status: 400 });

    const { error: up2 } = await admin.storage
        .from("credential-cards")
        .upload(backPath, backPng, { upsert: true, contentType: "image/png" });

    if (up2) return NextResponse.json({ error: up2.message }, { status: 400 });

    const frontUrl = admin.storage.from("credential-cards").getPublicUrl(frontPath).data.publicUrl;
    const backUrl = admin.storage.from("credential-cards").getPublicUrl(backPath).data.publicUrl;

    // 8) salvar urls no banco
    await admin
        .from("credentials")
        .update({
            front_image_url: frontUrl,
            back_image_url: backUrl,
            rendered_at: new Date().toISOString(),
        })
        .eq("id", c.id);

    return NextResponse.json({ ok: true, frontUrl, backUrl });
}
