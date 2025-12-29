import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateBR } from "@/lib/formatters/date";

function escapeXml(s: string) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function renderCertificateFiles(certId: string) {
  const admin = createAdminClient();

  // 1) buscar certificação
  const { data: cert, error: e1 } = await admin
    .from("certifications")
    .select(
      "id, person_id, course_id, cohort_id, issued_at, public_token, hours, topics, city, state, dates_text"
    )
    .eq("id", certId)
    .single();

  if (e1 || !cert) throw new Error(`Certificação não encontrada: ${e1?.message ?? ""}`);

  // 2) garantir public_token (sua coluna é text)
  const publicToken = cert.public_token?.trim() || crypto.randomUUID();
  if (!cert.public_token?.trim()) {
    await admin.from("certifications").update({ public_token: publicToken }).eq("id", cert.id);
  }

  // 3) buscar pessoa (nome)
  const { data: person, error: e2 } = await admin
    .from("people")
    .select("full_name")
    .eq("id", cert.person_id)
    .single();

  if (e2 || !person) throw new Error(`Pessoa não encontrada: ${e2?.message ?? ""}`);

  // 4) buscar nome do curso (se existir tabela courses com "name")
  let courseName = "CURSO";
  const { data: course } = await admin.from("courses").select("name").eq("id", cert.course_id).single();
  if (course?.name) courseName = course.name;

  // (Opcional) nome da turma/cohort (se você quiser exibir)
  // let cohortName = "";
  // const { data: cohort } = await admin.from("cohorts").select("name").eq("id", cert.cohort_id).single();
  // if (cohort?.name) cohortName = cohort.name;

  // 5) URL pública
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL não configurado");

  const publicUrl = `${appUrl}/certificado/${publicToken}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, { margin: 1, width: 260 });

  // 6) template base (PNG)
  const templatePath = path.join(process.cwd(), "public", "templates", "certificado-base.png");
  const templateBuffer = await fs.readFile(templatePath);

  const meta = await sharp(templateBuffer).metadata();
  const W = meta.width ?? 1400;
  const H = meta.height ?? 1000;

  // 7) campos do certificado
  const nome = escapeXml(person.full_name ?? "");
  const curso = escapeXml(courseName);
  const datas = escapeXml(cert.dates_text ?? "");
  const topics = escapeXml(cert.topics ?? "");
  const hours = escapeXml(cert.hours ?? "");
  const cityUf = escapeXml(`${cert.city ?? "Capivari de Baixo"}-${cert.state ?? "SC"}`);
  const issuedAt = escapeXml(formatDateBR(cert.issued_at ?? null));

  // 8) overlay SVG (ajustaremos a posição finamente depois)
  const overlaySvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <!-- Nome -->
    <text x="${Math.round(W * 0.54)}" y="${Math.round(H * 0.50)}"
      font-family="Georgia" font-size="${Math.round(H * 0.065)}"
      fill="#111" text-anchor="middle" font-style="italic">${nome}</text>

    <!-- Texto principal -->
    <text x="${Math.round(W * 0.24)}" y="${Math.round(H * 0.62)}"
      font-family="Arial" font-size="${Math.round(H * 0.028)}" fill="#111">
      <tspan x="${Math.round(W * 0.24)}" dy="0">Certificamos que participou do </tspan>
      <tspan font-weight="700">${curso}</tspan>
      <tspan> realizado em ${cityUf}, nos dias: </tspan>
      <tspan font-weight="700">${datas}</tspan>
      <tspan>, das 14:00 às 18:00.</tspan>

      <tspan x="${Math.round(W * 0.24)}" dy="${Math.round(H * 0.038)}">Os assuntos abordados foram: </tspan>
      <tspan font-weight="700">${topics}</tspan>

      <tspan x="${Math.round(W * 0.24)}" dy="${Math.round(H * 0.038)}">Carga horária: </tspan>
      <tspan font-weight="700">${hours}</tspan>
      <tspan> horas.</tspan>
    </text>

    <!-- Data de emissão -->
    <text x="${Math.round(W * 0.80)}" y="${Math.round(H * 0.88)}"
      font-family="Arial" font-size="${Math.round(H * 0.022)}" fill="#555" text-anchor="end">
      Emitido em: ${issuedAt}
    </text>

    <!-- QR -->
    <image href="${qrDataUrl}" x="${Math.round(W * 0.84)}" y="${Math.round(H * 0.66)}"
      width="${Math.round(W * 0.11)}" height="${Math.round(W * 0.11)}" />
  </svg>`;

  // 9) compor PNG final
  const pngBuffer = await sharp(templateBuffer)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  // 10) PDF a partir do PNG (pdf-lib)
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
  page.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height });
  const pdfBytes = await pdfDoc.save();

  // 11) upload no Storage
  const pngPath = `${cert.id}/certificate.png`;
  const pdfPath = `${cert.id}/certificate.pdf`;

  const { error: up1 } = await admin.storage
    .from("certificates")
    .upload(pngPath, pngBuffer, { upsert: true, contentType: "image/png" });
  if (up1) throw new Error(up1.message);

  const { error: up2 } = await admin.storage
    .from("certificates")
    .upload(pdfPath, Buffer.from(pdfBytes), { upsert: true, contentType: "application/pdf" });
  if (up2) throw new Error(up2.message);

  const pngUrl = admin.storage.from("certificates").getPublicUrl(pngPath).data.publicUrl;
  const pdfUrl = admin.storage.from("certificates").getPublicUrl(pdfPath).data.publicUrl;

  // 12) salvar urls no banco
  await admin
    .from("certifications")
    .update({ png_url: pngUrl, pdf_url: pdfUrl, rendered_at: new Date().toISOString() })
    .eq("id", cert.id);

  return { pngUrl, pdfUrl, publicUrl };
}
