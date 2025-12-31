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
  const qrDataUrl = await QRCode.toDataURL(publicUrl, { margin: 1, width: 260 });

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

  let baseX = Math.round(W * 0.33);
  let baseY = Math.round(H * 0.58);
  const textoSvg = wrapSvgText(textoPrincipal, {
    maxCharsPerLine: 68,
    lineHeight: Math.round(H * 0.038),
    x: baseX,
    y: baseY,
  });

  // Nome (ajustar Y se for muito longo)
  let vertNome = 0.50;
  if (nome.length > 38) {
    vertNome = 0.48;
  }
  baseX = Math.round(W * 0.33);
  baseY = Math.round(H * vertNome);

  const nomeSvg = wrapSvgText(nome, {
    maxCharsPerLine: 40,
    lineHeight: Math.round(H * 0.038),
    x: baseX,
    y: baseY,
  });

  // 8) overlay SVG (ajustaremos a posição finamente depois)
  // const overlaySvg = `
  // <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  //   <defs>
  //     <style type="text/css">
  //       @font-face {
  //         font-family: 'CertName';
  //         src: url('data:font/ttf;base64,${nameFontBase64}') format('truetype');
  //       }
  //       @font-face {
  //         font-family: 'CertBody';
  //         src: url('data:font/ttf;base64,${bodyFontBase64}') format('truetype');
  //       }
  //     </style>
  //   </defs>

  //   <!-- Nome -->
  //   <text x="${Math.round(W * 0.33)}" y="${Math.round(H * 0.50)}"
  //     font-family="CertName" font-size="${Math.round(H * 0.050)}"
  //     fill="#111" font-style="italic">${nomeSvg}</text>

  //   <!-- Texto principal -->
  //   <text x="${Math.round(W * 0.33)}" y="${Math.round(H * 0.56)}"
  //     font-family="CertBody" font-size="${Math.round(H * 0.020)}" fill="#111">
  //     ${textoSvg}
  //   </text>

  //   <!-- Data de emissão -->
  //   <text x="${Math.round(W * 0.56)}" y="${Math.round(H * 0.15)}"
  //     font-family="CertBody" font-size="${Math.round(H * 0.015)}" fill="#555">
  //     Emitido em: ${issuedAt}
  //   </text>

  //   <!-- QR -->
  //   <image href="${qrDataUrl}" x="${Math.round(W * 0.58)}" y="${Math.round(H * 0.015)}"
  //     width="${Math.round(W * 0.08)}" height="${Math.round(W * 0.08)}" />
  // </svg>`;
  // 8) compor PNG final usando texto nativo do sharp
  const pngBuffer = await sharp(templateBuffer)
    .composite([
      // Nome do aluno
      {
        input: {
          text: {
            text: "Nome teste 99999",
            font: "Roboto",
            rgba: true,
            background: { r: 0, g: 0, b: 0, alpha: 0 }, // 👈 deixa transparente
            color: "#000000",
            fontfile: bodyFontPath,
            width: Math.round(W * 0.6),
            height: Math.round(H * 0.08),
            wrap: "word",
            align: "center",
          },
        },
        left: Math.round(W * 0.20),
        top: Math.round(H * 0.46),
      },

      // Texto principal
      {
        input: {
          text: {
            text: textoPrincipal,
            font: "Roboto",
            fontfile: bodyFontPath,
            rgba: true,
            background: { r: 0, g: 0, b: 0, alpha: 0 }, // 👈 deixa transparente
            color: "#000000",
            width: Math.round(W * 0.6),
            height: Math.round(H * 0.18),
            wrap: "word",
            align: "left",
          },
        },
        left: Math.round(W * 0.20),
        top: Math.round(H * 0.54),
      },

      // Data de emissão
      {
        input: {
          text: {
            text: `Emitido em: ${issuedAt}`,
            font: "Roboto",
            fontfile: bodyFontPath,
            rgba: true,
            background: { r: 0, g: 0, b: 0, alpha: 0 }, // 👈 deixa transparente
            color: "#000000",
            width: Math.round(W * 0.25),
            height: Math.round(H * 0.03),
            wrap: "word",
            align: "left",
          },
        },
        left: Math.round(W * 0.56),
        top: Math.round(H * 0.12),
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
