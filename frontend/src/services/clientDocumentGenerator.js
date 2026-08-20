import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType,
} from 'docx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// ── DOCX desde plantilla cacheada (modo offline con template) ─

export async function generateDocxBlobFromTemplate({ templateBuffer, data, signatureBuffer, signatureMime }) {
  // templateBuffer: ArrayBuffer guardado en IndexedDB
  const zip = new PizZip(templateBuffer);

  // Si el template tiene {{firma_img}}, sustituirlo por cadena vacía offline
  // (el ImageModule necesita un entorno Node — en browser se omite la imagen)
  let docXml = zip.file('word/document.xml')?.asText() || '';
  if (docXml.includes('{{firma_img}}') || docXml.includes('{{%firma_img}}')) {
    docXml = docXml
      .replace(/\{\{%firma_img\}\}/g, '{{firma_img}}') // normalizar
      .replace(/\{\{firma_img\}\}/g, '');              // limpiar placeholder
    zip.file('word/document.xml', docXml);
  }

  const tpl = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // nullGetter: campos ausentes se reemplazan con cadena vacía en vez de error
    nullGetter() { return ''; },
  });

  tpl.render({ ...data, firma_img: '' });

  const outputBuffer = tpl.getZip().generate({
    type: 'arraybuffer',
    compression: 'DEFLATE',
  });

  return new Blob([outputBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

// ── DOCX programático (sin plantilla) ────────────────────

function buildDocxRows(fields, data) {
  return fields.map((f) => {
    const value = data[f.name] ?? '';
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: f.label + ':', bold: true, size: 22 })] })],
        }),
        new TableCell({
          width: { size: 65, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: String(value), size: 22 })] })],
        }),
      ],
    });
  });
}

export async function generateDocxBlob({ jalName, docTypeName, fields, data }) {
  const today = new Date().toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const doc = new Document({
    sections: [{
      children: [
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
        new Paragraph({
          children: [new TextRun({ text: docTypeName.toUpperCase(), bold: true, size: 28, underline: {} })],
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
          children: [new TextRun({ text: `Medellín, ${today}`, size: 22, italics: true })],
          alignment: AlignmentType.RIGHT,
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '_______________________________', alignment: AlignmentType.CENTER }),
        new Paragraph({
          children: [new TextRun({ text: 'Firma del(la) Edil(a)', bold: true, size: 20 })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }],
  });

  return Packer.toBlob(doc);
}

// ── PDF (siempre con pdf-lib — Word COM no está disponible en el browser) ─

export async function generatePdfBlob({ jalName, docTypeName, fields, data, signatureBuffer, signatureMime }) {
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const blue  = rgb(0.118, 0.420, 0.227);
  const black = rgb(0, 0, 0);
  const gray  = rgb(0.4, 0.4, 0.4);

  const marginX = 60;
  let y = height - 60;

  // Encabezado
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: blue });
  page.drawText(jalName.toUpperCase(), {
    x: marginX, y: height - 38, size: 14, font: fontBold, color: rgb(1, 1, 1),
  });
  page.drawText('JUNTA ADMINISTRADORA LOCAL — MEDELLÍN', {
    x: marginX, y: height - 58, size: 9, font: fontReg, color: rgb(0.8, 0.85, 0.95),
  });
  y -= 50;

  // Título
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

  // Campos
  const valueX = marginX + 185;
  for (const field of fields) {
    if (y < 120) break;
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

  y -= 70;

  // Firma (imagen si está cacheada)
  if (signatureBuffer) {
    try {
      const sigBytes = new Uint8Array(signatureBuffer);
      const isPng = !signatureMime || signatureMime.includes('png');
      const embeddedImg = isPng
        ? await pdfDoc.embedPng(sigBytes)
        : await pdfDoc.embedJpg(sigBytes);
      const { width: imgW, height: imgH } = embeddedImg.scaleToFit(150, 60);
      page.drawImage(embeddedImg, {
        x: (width - imgW) / 2, y, width: imgW, height: imgH,
      });
      y -= imgH + 5;
    } catch {
      // Si la imagen falla, continuar sin ella
    }
  }

  // Línea de firma
  const lineX1 = (width - 200) / 2;
  page.drawLine({
    start: { x: lineX1, y }, end: { x: lineX1 + 200, y },
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

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ── Descarga de blob ──────────────────────────────────────

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
