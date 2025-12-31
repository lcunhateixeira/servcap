import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateBR } from "@/lib/formatters/date";
import { wrapSvgText } from "../svg/wrapText";


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

  // 5) URL pública
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL não configurado");

  const publicUrl = `${appUrl}/certificado/${publicToken}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, { margin: 1, width: 150 });

  // 6) template base (PNG)
  const templatePath = path.join(process.cwd(), "public", "templates", "certificado-base.png");
  const templateBuffer = await fs.readFile(templatePath);

  const meta = await sharp(templateBuffer).metadata();
  const W = meta.width ?? 1700;
  const H = meta.height ?? 1000;

  // fonte Roboto
  const bodyFontPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "Roboto-Regular.ttf"
  );

  // 7) campos do certificado
  const nome = person.full_name ?? "";
  const curso = courseName;
  const datas = cert.dates_text ?? "";
  const topics = cert.topics ?? "";
  const hours = cert.hours ?? "";
  const cityUf = `${cert.city ?? "Capivari de Baixo"}-${cert.state ?? "SC"}`;
  const issuedAt = formatDateBR(cert.issued_at ?? null);

  const textoPrincipal = `Certificamos que participou do curso ${curso}, realizado em ${cityUf}, nos dias ${datas}. Os assuntos abordados foram: ${topics}. Carga horária: ${hours} horas.`;

  // buffer do QR (a partir do data URL)
  const qrBase64 = qrDataUrl.split(",")[1];
  const qrBuffer = Buffer.from(qrBase64, "base64");

  // Nome (ajustar Y se for muito longo)
  let vertNome = 0.48;
  let vertTexto = 0.58;
  if (nome.length > 30) {
    vertNome = 0.46;
    vertTexto = 0.60;
  }
 

  // 9) gerar PNG com Sharp
  const pngBuffer = await sharp(templateBuffer)
    .composite([
      // Nome do aluno
      {
        input: {
          text: {
            text: nome,
            font: "Roboto",
            rgba: true,
            fontfile: bodyFontPath,
            width: Math.round(W * 0.6),
            height: Math.round(H * 0.10),
            wrap: "word",
            align: "center",
          },
        },
        left: Math.round(W * 0.33),
        top: Math.round(H * vertNome),
      },

      // Texto principal
      {
        input: {
          text: {
            text: textoPrincipal,
            font: "Roboto",
            fontfile: bodyFontPath,
            rgba: true,
            width: Math.round(W * 0.6),
            height: Math.round(H * 0.15),
            wrap: "word",
            align: "left",
          },
        },
        left: Math.round(W * 0.33),
        top: Math.round(H * vertTexto),
      },

      // Data de emissão
      {
        input: {
          text: {
            text: `Emitido em: ${issuedAt}`,
            font: "Roboto",
            fontfile: bodyFontPath,
            rgba: true,
            width: Math.round(W * 0.12),
            height: Math.round(H * 0.02),
            wrap: "word",
            align: "left",
          },
        },
        left: Math.round(W * 0.556),
        top: Math.round(H * 0.13),
      },

      // QR Code
      {
        input: qrBuffer,
        left: Math.round(W * 0.58),
        top: Math.round(H * 0.015),
      },
    ])
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
