'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType,
  BorderStyle, Header, Footer, ImageRun, PageNumber,
} = require('docx');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const mammoth = require('mammoth');
const os = require('os');

const execFileAsync = promisify(execFile);
const wordConverter = require('./wordConverter');
const libreOfficeConverter = require('./libreOfficeConverter');

const BASE_OUTPUT = path.resolve(process.env.STORAGE_PATH || path.join(__dirname, '..', '..', 'data', 'output'));
const BACKEND_ROOT = path.resolve(path.join(__dirname, '..', '..'));
const TEMPLATES_ROOT = path.resolve(process.env.TEMPLATES_PATH || path.join(BACKEND_ROOT, 'plantillas'));

// ─── Helpers ─────────────────────────────────────────────

function sanitizePath(str) {
  return String(str).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 80);
}

function buildOutputDir(jalId, docTypeName, beneficiaryId) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dir = path.join(
    BASE_OUTPUT,
    sanitizePath(jalId),
    sanitizePath(docTypeName),
    date,
    sanitizePath(beneficiaryId)
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildFilename(docTypeName, beneficiaryId) {
  const ts = Date.now();
  // El timestamp en ms no basta como componente de unicidad: dos solicitudes casi
  // simultáneas (doble clic, reintento de red) pueden caer en el mismo milisegundo y
  // pisarse el archivo la una a la otra en disco, aunque tengan registros Document
  // distintos en BD. Se agrega un sufijo aleatorio para garantizar unicidad real.
  const rand = crypto.randomBytes(4).toString('hex');
  const base = `${sanitizePath(docTypeName)}_${sanitizePath(beneficiaryId)}_${ts}_${rand}`;
  return { docx: `${base}.docx`, pdf: `${base}.pdf` };
}

// ─── Generación DOCX programática (sin template) ─────────

function buildDocxRows(fields, data) {
  return fields.map((f) => {
    const value = data[f.name] ?? '';
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: f.label + ':', bold: true, size: 22 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 65, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: String(value), size: 22 })],
            }),
          ],
        }),
      ],
    });
  });
}

async function generateDocxProgrammatic({ jalName, docTypeName, fields, data, signaturePath, signatureBuffer, signatureMime }) {
  const today = new Date().toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const children = [
    new Paragraph({
      text: jalName.toUpperCase(),
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'JUNTA ADMINISTRADORA LOCAL', bold: true, size: 24 })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' }),
    ...(data.numero_radicado ? [
      new Paragraph({
        children: [new TextRun({ text: `Radicado No. ${data.numero_radicado}`, bold: true, size: 20 })],
        alignment: AlignmentType.RIGHT,
      }),
    ] : []),
    new Paragraph({
      children: [
        new TextRun({ text: docTypeName.toUpperCase(), bold: true, size: 28, underline: {} }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: buildDocxRows(fields, data),
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Medellín, ${today}`,
          size: 22,
          italics: true,
        }),
      ],
      alignment: AlignmentType.RIGHT,
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
    new Paragraph({
      children: [new TextRun({ text: 'Firma del(la) Edil(a)', bold: true, size: 20 })],
      alignment: AlignmentType.CENTER,
    }),
  ];

  // Insertar imagen de firma si existe (buffer en memoria o archivo)
  let sigData = null;
  let sigType = 'png';
  if (signatureBuffer) {
    sigData = signatureBuffer;
    sigType = signatureMime?.includes('png') ? 'png' : 'jpg';
  } else if (signaturePath && fs.existsSync(signaturePath)) {
    sigData = fs.readFileSync(signaturePath);
    sigType = path.extname(signaturePath).toLowerCase() === '.png' ? 'png' : 'jpg';
  }
  if (sigData) {
    children.splice(
      children.length - 2,
      0,
      new Paragraph({
        children: [
          new ImageRun({ data: sigData, transformation: { width: 200, height: 80 }, type: sigType }),
        ],
        alignment: AlignmentType.LEFT,
      })
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

// ─── Generación DOCX desde plantilla ─────────────────────

function resolveTemplatePath(templatePath) {
  const resolved = path.resolve(TEMPLATES_ROOT, path.basename(templatePath));
  if (!resolved.startsWith(TEMPLATES_ROOT + path.sep) && resolved !== TEMPLATES_ROOT) {
    throw Object.assign(new Error('Ruta de plantilla no permitida'), { status: 400 });
  }
  return resolved;
}

async function generateDocxFromTemplate({ templatePath, templateData, data, signatureBuffer, signatureMime, signaturePath }) {
  let content;
  if (templateData) {
    const b64 = templateData.includes(',') ? templateData.split(',')[1] : templateData;
    content = Buffer.from(b64, 'base64').toString('binary');
  } else {
    const fullPath = resolveTemplatePath(templatePath);
    content = fs.readFileSync(fullPath, 'binary');
  }

  // Convertir signaturePath a buffer si no viene buffer directo
  if (!signatureBuffer && signaturePath && fs.existsSync(signaturePath)) {
    signatureBuffer = fs.readFileSync(signaturePath);
    signatureMime = path.extname(signaturePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  }

  const zip = new PizZip(content);
  const modules = [];
  let renderData = { ...data };

  if (signatureBuffer) {
    // Reemplazar {firma_img} por {%firma_img} para que ImageModule lo procese como imagen
    let docXml = zip.file('word/document.xml').asText();
    if (docXml.includes('{firma_img}')) {
      docXml = docXml.replace(/\{firma_img\}/g, '{%firma_img}');
      zip.file('word/document.xml', docXml);
      modules.push(new ImageModule({
        centered: false,
        getImage: () => signatureBuffer,
        getSize: () => [200, 80],
      }));
      renderData.firma_img = 'firma';
    }
  }

  // Los templates usan delimitadores simples {variable} — configurar docxtemplater igual
  const tpl = new Docxtemplater(zip, {
    modules,
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });
  tpl.render(renderData);
  return tpl.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ─── Generación PDF con pdf-lib (fallback sin Word) ──────

async function generatePdf({ jalName, docTypeName, fields, data, signaturePath, signatureBuffer, signatureMime }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const blue = rgb(0.118, 0.227, 0.373); // #1e3a5f
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);

  let y = height - 60;
  const marginX = 60;

  // Encabezado
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: blue });
  page.drawText(jalName.toUpperCase(), {
    x: marginX, y: height - 38, size: 14, font: fontBold, color: rgb(1, 1, 1),
  });
  page.drawText('JUNTA ADMINISTRADORA LOCAL — MEDELLÍN', {
    x: marginX, y: height - 58, size: 9, font: fontReg, color: rgb(0.8, 0.85, 0.95),
  });

  y -= 50;

  // Número de radicado
  if (data.numero_radicado) {
    const radicadoText = `Radicado No. ${data.numero_radicado}`;
    const radicadoW = fontBold.widthOfTextAtSize(radicadoText, 9);
    page.drawText(radicadoText, {
      x: width - marginX - radicadoW, y, size: 9, font: fontBold, color: blue,
    });
    y -= 16;
  }

  // Título del documento
  const titleSize = 15;
  const titleW = fontBold.widthOfTextAtSize(docTypeName.toUpperCase(), titleSize);
  page.drawText(docTypeName.toUpperCase(), {
    x: (width - titleW) / 2, y, size: titleSize, font: fontBold, color: blue,
  });

  y -= 8;
  page.drawLine({
    start: { x: marginX + 30, y }, end: { x: width - marginX - 30, y },
    thickness: 1.5, color: blue,
  });

  y -= 24;

  // Campos del formulario
  const labelW = 180;
  const valueX = marginX + labelW + 10;

  for (const field of fields) {
    if (y < 120) {
      const newPage = pdfDoc.addPage([612, 792]);
      y = newPage.getSize().height - 60;
    }

    const label = field.label + ':';
    const value = String(data[field.name] ?? '—');

    page.drawText(label, { x: marginX, y, size: 10, font: fontBold, color: black });
    page.drawText(value, { x: valueX, y, size: 10, font: fontReg, color: black });

    y -= 4;
    page.drawLine({
      start: { x: marginX, y }, end: { x: width - marginX, y },
      thickness: 0.3, color: rgb(0.85, 0.85, 0.85),
    });
    y -= 18;
  }

  y -= 20;

  // Fecha
  const today = new Date().toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const dateText = `Medellín, ${today}`;
  const dateW = fontReg.widthOfTextAtSize(dateText, 9);
  page.drawText(dateText, {
    x: width - marginX - dateW, y, size: 9, font: fontReg, color: gray,
  });

  y -= 60;

  // Firma
  let sigBuf = null;
  let sigIsPng = true;
  if (signatureBuffer) {
    sigBuf = signatureBuffer;
    sigIsPng = !signatureMime || signatureMime.includes('png');
  } else if (signaturePath && fs.existsSync(signaturePath)) {
    sigBuf = fs.readFileSync(signaturePath);
    sigIsPng = path.extname(signaturePath).toLowerCase() === '.png';
  }
  if (sigBuf) {
    const embeddedImg = sigIsPng
      ? await pdfDoc.embedPng(sigBuf)
      : await pdfDoc.embedJpg(sigBuf);
    const { width: imgW, height: imgH } = embeddedImg.scaleToFit(200, 80);
    page.drawImage(embeddedImg, {
      x: marginX, y, width: imgW, height: imgH,
    });
    y -= imgH + 5;
  }

  // Línea de firma
  const lineX1 = (width - 200) / 2;
  const lineX2 = lineX1 + 200;
  page.drawLine({
    start: { x: lineX1, y }, end: { x: lineX2, y },
    thickness: 1, color: black,
  });
  y -= 12;
  const signLabel = 'Firma del(la) Edil(a)';
  const signLabelW = fontBold.widthOfTextAtSize(signLabel, 9);
  page.drawText(signLabel, {
    x: (width - signLabelW) / 2, y, size: 9, font: fontBold, color: black,
  });

  // Pie de página
  page.drawRectangle({ x: 0, y: 0, width, height: 28, color: blue });
  page.drawText('Documento generado por el Sistema de Gestión JAL — Medellín', {
    x: marginX, y: 10, size: 7, font: fontReg, color: rgb(0.8, 0.85, 0.95),
  });

  return Buffer.from(await pdfDoc.save());
}

// ─── Convertir DOCX → PDF ─────────────────────────────────
// Orden de preferencia por fidelidad de formato (fuentes, imágenes, tablas,
// encabezados/pies, colores):
//   1. Word COM (solo Windows, requiere MS Word instalado — PC local)
//   2. LibreOffice headless (Linux — backend en Render, sin Word)
//   3. mammoth + pdf-lib (último recurso, pierde estilos)
// En Linux no tiene sentido intentar Word COM primero: `wordConverter` lanza
// PowerShell, que ahí no existe, y solo desperdiciaría su timeout de 40 s.

async function docxBufferToPdf(docxBuffer) {
  if (process.platform === 'win32') {
    try {
      // Usar Word persistente (instancia única, ~1 s por conversión tras el primer arranque)
      return await wordConverter.convert(docxBuffer);
    } catch (wordErr) {
      console.warn('[documentGenerator] Word persistente falló, probando LibreOffice:', wordErr.message);
    }
  }

  try {
    return await libreOfficeConverter.convert(docxBuffer);
  } catch (loErr) {
    console.warn('[documentGenerator] LibreOffice falló, usando mammoth fallback:', loErr.message);
    return docxBufferToPdfFallback(docxBuffer);
  }
}

// ─── Fallback: mammoth + pdf-lib (pierde estilos) ────────
// Solo se usa si Word y LibreOffice no están disponibles.

async function docxBufferToPdfFallback(docxBuffer) {
  const { value: html } = await mammoth.convertToHtml({ buffer: docxBuffer });

  const blocks = [];
  const tagRe = /<(h[1-4]|p|li|td|th)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = tagRe.exec(html)) !== null) {
    const tag  = match[1].toLowerCase();
    const text = match[3].replace(/<[^>]+>/g, ' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
    if (text) blocks.push({ tag, text });
  }

  const pdfDoc  = await PDFDocument.create();
  const fontB   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontR   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const blue    = rgb(0.118, 0.227, 0.373);
  const black   = rgb(0, 0, 0);
  const W       = 595, H = 842;
  const marginX = 56, marginY = 56;
  const maxW    = W - marginX * 2;

  let page = pdfDoc.addPage([W, H]);
  let y    = H - marginY;

  function newPageIfNeeded(needed) {
    if (y - needed < marginY) {
      page = pdfDoc.addPage([W, H]);
      y    = H - marginY;
    }
  }

  function drawWrapped(text, font, size, color, indent = 0) {
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxW - indent) {
        if (line) {
          newPageIfNeeded(size + 4);
          page.drawText(line, { x: marginX + indent, y, size, font, color });
          y -= size + 4;
          line = word;
        } else {
          line = word;
        }
      } else {
        line = test;
      }
    }
    if (line) {
      newPageIfNeeded(size + 4);
      page.drawText(line, { x: marginX + indent, y, size, font, color });
      y -= size + 4;
    }
  }

  for (const { tag, text } of blocks) {
    if (tag === 'h1') {
      y -= 8;
      newPageIfNeeded(18);
      drawWrapped(text, fontB, 15, blue);
      y -= 4;
    } else if (tag === 'h2') {
      y -= 6;
      drawWrapped(text, fontB, 13, blue);
      y -= 3;
    } else if (tag === 'h3' || tag === 'h4') {
      y -= 4;
      drawWrapped(text, fontB, 11, black);
      y -= 2;
    } else if (tag === 'td' || tag === 'th') {
      drawWrapped(text, tag === 'th' ? fontB : fontR, 10, black, 10);
    } else {
      drawWrapped(text, fontR, 10, black);
      y -= 3;
    }
  }

  return Buffer.from(await pdfDoc.save());
}

// ─── Función principal ────────────────────────────────────

async function generateDocuments({
  jalId,
  jalName,
  docType, // { id, name, fields, template_path }
  data,
  signaturePath = null,
  signatureBuffer = null,
  signatureMime = null,
}) {
  const outDir = buildOutputDir(jalId, docType.name, data.beneficiary_id || 'sin_cedula');
  const { docx: docxName, pdf: pdfName } = buildFilename(docType.name, data.beneficiary_id || 'doc');

  const docxPath = path.join(outDir, docxName);

  // Generar DOCX
  let docxBuffer;
  const hasTemplateData = !!docType.template_data;
  const resolvedTplPath = docType.template_path ? resolveTemplatePath(docType.template_path) : null;
  if (hasTemplateData) {
    docxBuffer = await generateDocxFromTemplate({
      templateData: docType.template_data, data, signatureBuffer, signatureMime, signaturePath,
    });
  } else if (resolvedTplPath && fs.existsSync(resolvedTplPath)) {
    docxBuffer = await generateDocxFromTemplate({
      templatePath: docType.template_path, data, signatureBuffer, signatureMime, signaturePath,
    });
  } else {
    docxBuffer = await generateDocxProgrammatic({
      jalName,
      docTypeName: docType.name,
      fields: docType.fields,
      data,
      signaturePath,
      signatureBuffer,
      signatureMime,
    });
  }
  fs.writeFileSync(docxPath, docxBuffer);

  // Generar PDF
  const pdfPath = path.join(outDir, pdfName);
  const usesTemplate = hasTemplateData || (resolvedTplPath && fs.existsSync(resolvedTplPath));
  let pdfBuffer;
  if (usesTemplate) {
    // Convertir DOCX renderizado → PDF preservando el layout exacto del template
    pdfBuffer = await docxBufferToPdf(docxBuffer);
  } else {
    pdfBuffer = await generatePdf({ jalName, docTypeName: docType.name, fields: docType.fields, data, signaturePath, signatureBuffer, signatureMime });
  }
  fs.writeFileSync(pdfPath, pdfBuffer);

  // docxBuffer/pdfBuffer también se devuelven (no solo las rutas de disco) para que
  // documentService.js pueda guardarlos en Postgres (columnas file_docx/file_pdf) —
  // necesario porque el disco de un backend en Render (free tier) es efímero y no
  // sobrevive a un redeploy o reinicio del contenedor.
  return { docxPath, pdfPath, docxName, pdfName, docxBuffer, pdfBuffer };
}

module.exports = { generateDocuments };
