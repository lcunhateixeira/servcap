import QRCode from "qrcode";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateBR } from "@/lib/formatters/date";
import { formatCPF } from "@/lib/formatters/helper";

async function fetchAsDataUrl(url: string): Promise<string | null> {
    try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const buf = Buffer.from(await resp.arrayBuffer());
        return `data:${resp.headers.get("content-type") ?? "image/jpeg"};base64,${buf.toString("base64")}`;
    } catch {
        return null;
    }
}

/**
 * Renderiza frente/verso em PNG, faz upload no bucket credential-cards
 * e atualiza a credencial com front_image_url/back_image_url/rendered_at.
 */
export async function renderCredentialImages(credentialId: string) {
    const admin = createAdminClient();

    // busca credencial (sem join, mais robusto)
    const { data: c, error } = await admin
        .from("credentials")
        .select("id, credential_number, kind, status, church_id, issued_at, expires_at, public_token, person_id")
        .eq("id", credentialId)
        .single();

    if (error || !c) throw new Error(`Credencial não encontrada: ${error?.message ?? ""}`);

    // pessoa
    const { data: person, error: ePerson } = await admin
        .from("people")
        .select("full_name, birth_date, cpf, photo_url")
        .eq("id", c.person_id)
        .single();

    if (ePerson || !person) throw new Error(`Pessoa não encontrada: ${ePerson?.message ?? ""}`);

    //Igreja
    const { data: church, error: eChurch } = await admin
        .from("churches")
        .select("name, cnpj")
        .eq("id", c.church_id)
        .single();
   
    let churchName = church?.name ?? "";
    let churchCnpj = church?.cnpj ?? "";
   
    if (eChurch) throw new Error(`Igreja não encontrada: ${eChurch?.message ?? ""}`);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL não configurado");

    const publicCredentialUrl = `${appUrl}/credencial/${c.public_token}`;

    const qrDataUrl = await QRCode.toDataURL(publicCredentialUrl, { margin: 1, width: 220 });
    const photoDataUrl = person.photo_url ? await fetchAsDataUrl(person.photo_url) : null;

    const W = 1000;
    const H = 640;

    const title = c.kind === "chaplain" ? "CAPELÃO" : "SERVIÇO DE CAPELANIA";
    const cpfBR = formatCPF(person.cpf ?? null);
    const birthBR = formatDateBR(person.birth_date ?? null);
    const expBR = formatDateBR(c.expires_at);

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
    <text x="290" y="235" font-size="28" font-family="Arial" fill="#111827" font-weight="700">${person.full_name ?? ""}</text>

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
  </svg>`;

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
  </svg>`;

    const frontPng = await sharp(Buffer.from(frontSvg)).png().toBuffer();
    const backPng = await sharp(Buffer.from(backSvg)).png().toBuffer();

    const frontPath = `${c.id}/front.png`;
    const backPath = `${c.id}/back.png`;

    const { error: up1 } = await admin.storage
        .from("credential-cards")
        .upload(frontPath, frontPng, { upsert: true, contentType: "image/png" });
    if (up1) throw new Error(up1.message);

    const { error: up2 } = await admin.storage
        .from("credential-cards")
        .upload(backPath, backPng, { upsert: true, contentType: "image/png" });
    if (up2) throw new Error(up2.message);

    const frontUrl = admin.storage.from("credential-cards").getPublicUrl(frontPath).data.publicUrl;
    const backUrl = admin.storage.from("credential-cards").getPublicUrl(backPath).data.publicUrl;

    await admin
        .from("credentials")
        .update({
            front_image_url: frontUrl,
            back_image_url: backUrl,
            rendered_at: new Date().toISOString(),
        })
        .eq("id", c.id);

    return { frontUrl, backUrl };
}
