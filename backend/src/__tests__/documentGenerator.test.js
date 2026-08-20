'use strict';
// PT-01: Generación offline — genera .docx y .pdf con datos de prueba

const fs      = require('fs');
const os      = require('os');
const path    = require('path');
const mammoth = require('mammoth');

// Redirigir output y plantillas a directorios temporales antes de cargar el servicio
const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'jal-docgen-'));
const tmpTemplates = fs.mkdtempSync(path.join(os.tmpdir(), 'jal-docgen-tpl-'));
process.env.STORAGE_PATH   = tmpOut;
process.env.TEMPLATES_PATH = tmpTemplates;

const { generateDocuments } = require('../services/documentGeneratorService');

afterAll(() => {
  try { fs.rmSync(tmpOut, { recursive: true, force: true }); } catch { /* noop */ }
  try { fs.rmSync(tmpTemplates, { recursive: true, force: true }); } catch { /* noop */ }
});

const JAL_ID   = '00000000-0000-0000-0000-000000000001';
const DOC_TYPE = {
  id:            '11111111-1111-1111-1111-111111111111',
  name:          'Constancia de Residencia',
  fields:        [
    { name: 'barrio',            label: 'Barrio',              required: true },
    { name: 'tiempo_residencia', label: 'Tiempo de residencia', required: true },
  ],
  template_path: null, // tipo programático
};
const DATA = {
  beneficiary_name:   'Juan Pérez',
  beneficiary_id:     '1234567890',
  barrio:             'El Poblado',
  tiempo_residencia:  '5 años',
  jal_name:           'JAL El Poblado',
  doc_type_name:      DOC_TYPE.name,
  fecha_expedicion:   '10 de mayo de 2026',
  nombre_encargado:   'María García',
  cargo:              'Auxiliar de Gestión',
  firma_img:          '',
};

describe('generateDocuments — PT-01: Generación de documentos', () => {
  it('genera archivos .docx y .pdf para tipo programático', async () => {
    const r = await generateDocuments({ jalId: JAL_ID, jalName: 'JAL El Poblado', docType: DOC_TYPE, data: DATA });
    expect(fs.existsSync(r.docxPath)).toBe(true);
    expect(fs.existsSync(r.pdfPath)).toBe(true);
    expect(fs.statSync(r.docxPath).size).toBeGreaterThan(500);
    expect(fs.statSync(r.pdfPath).size).toBeGreaterThan(500);
  });

  it('retorna nombres de archivo con extensión correcta', async () => {
    const r = await generateDocuments({ jalId: JAL_ID, jalName: 'JAL El Poblado', docType: DOC_TYPE, data: DATA });
    expect(r.docxName).toMatch(/\.docx$/);
    expect(r.pdfName).toMatch(/\.pdf$/);
  });

  it('funciona sin firma (signaturePath y signatureBuffer nulos)', async () => {
    const r = await generateDocuments({
      jalId: JAL_ID, jalName: 'JAL El Poblado', docType: DOC_TYPE, data: DATA,
      signaturePath: null, signatureBuffer: null,
    });
    expect(fs.existsSync(r.docxPath)).toBe(true);
    expect(fs.existsSync(r.pdfPath)).toBe(true);
  });

  it('no colisiona archivos para beneficiarios distintos', async () => {
    const [r1, r2] = await Promise.all([
      generateDocuments({ jalId: JAL_ID, jalName: 'JAL', docType: DOC_TYPE, data: { ...DATA, beneficiary_id: 'A001' } }),
      generateDocuments({ jalId: JAL_ID, jalName: 'JAL', docType: DOC_TYPE, data: { ...DATA, beneficiary_id: 'A002' } }),
    ]);
    expect(r1.docxPath).not.toBe(r2.docxPath);
    expect(fs.existsSync(r1.pdfPath)).toBe(true);
    expect(fs.existsSync(r2.pdfPath)).toBe(true);
  });

  // Fix: el nombre de archivo solo usaba Date.now() (ms) como componente de unicidad —
  // dos solicitudes para el MISMO beneficiario que caigan en el mismo milisegundo
  // (doble clic, reintento) generaban la misma ruta y el segundo escribía encima del
  // primero en disco, aunque ambas tuvieran registros Document distintos en BD.
  it('no colisiona archivos para el MISMO beneficiario aunque caigan en el mismo milisegundo', async () => {
    const fixedNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const [r1, r2] = await Promise.all([
      generateDocuments({ jalId: JAL_ID, jalName: 'JAL', docType: DOC_TYPE, data: { ...DATA, beneficiary_id: 'MISMO-ID' } }),
      generateDocuments({ jalId: JAL_ID, jalName: 'JAL', docType: DOC_TYPE, data: { ...DATA, beneficiary_id: 'MISMO-ID' } }),
    ]);

    vi.restoreAllMocks();

    expect(r1.docxPath).not.toBe(r2.docxPath);
    // Ambos archivos deben existir de forma independiente — ninguno sobrescribió al otro
    expect(fs.existsSync(r1.docxPath)).toBe(true);
    expect(fs.existsSync(r2.docxPath)).toBe(true);
    expect(fs.statSync(r1.docxPath).size).toBeGreaterThan(0);
    expect(fs.statSync(r2.docxPath).size).toBeGreaterThan(0);
  });

  it('genera con signatureBuffer (firma base64 decodificada)', async () => {
    // PNG 1×1 blanco mínimo válido
    const minPng = Buffer.from(
      '89504e470d0a1a0a0000000d494844520000000100000001080200000090' +
      '7753de0000000c4944415408d763f8cfffff00000005000127e553470000' +
      '0000049454e44ae426082', 'hex'
    );
    const r = await generateDocuments({
      jalId: JAL_ID, jalName: 'JAL', docType: DOC_TYPE, data: DATA,
      signatureBuffer: minPng, signatureMime: 'image/png',
    });
    expect(fs.existsSync(r.pdfPath)).toBe(true);
  });

  // ── Radicado embebido en el archivo generado ──────────────────────────────
  // (funcionalidad agregada en esta sesión — se verifica el archivo real, no un mock)

  it('incluye "Radicado No. <numero>" en el texto del .docx cuando data.numero_radicado está presente', async () => {
    const r = await generateDocuments({
      jalId: JAL_ID, jalName: 'JAL El Poblado', docType: DOC_TYPE,
      data: { ...DATA, numero_radicado: '2026-JALC12-SAL-000045' },
    });
    const { value: text } = await mammoth.extractRawText({ path: r.docxPath });
    expect(text).toContain('Radicado No. 2026-JALC12-SAL-000045');
  });

  it('no muestra la línea de radicado cuando data.numero_radicado no está presente (no rompe el layout)', async () => {
    const r = await generateDocuments({ jalId: JAL_ID, jalName: 'JAL', docType: DOC_TYPE, data: DATA });
    const { value: text } = await mammoth.extractRawText({ path: r.docxPath });
    expect(text).not.toContain('Radicado No.');
  });

  // ── Protección contra path traversal en template_path ─────────────────────
  // resolveTemplatePath() no está exportada — se prueba indirectamente vía generateDocuments.

  it('un template_path con intento de path traversal no escapa TEMPLATES_PATH ni lanza sin control', async () => {
    // path.basename() en resolveTemplatePath() descarta cualquier componente de directorio,
    // así que esto NUNCA debería leer un archivo fuera de TEMPLATES_PATH. Como el archivo
    // resultante ("passwd") no existe dentro de TEMPLATES_PATH, el código cae al generador
    // programático (sin plantilla) en vez de lanzar — se verifica que efectivamente genera
    // un documento válido y no un error ni una lectura fuera del directorio permitido.
    const maliciousDocType = { ...DOC_TYPE, template_path: '../../../../../../etc/passwd' };
    const r = await generateDocuments({ jalId: JAL_ID, jalName: 'JAL', docType: maliciousDocType, data: DATA });
    expect(fs.existsSync(r.docxPath)).toBe(true);
    const { value: text } = await mammoth.extractRawText({ path: r.docxPath });
    // Debe ser el documento programático normal (contiene el título del tipo de documento),
    // no contenido arbitrario de un archivo del sistema.
    expect(text).toContain('CONSTANCIA DE RESIDENCIA');
  });

  it('un template_path que sí existe dentro de TEMPLATES_PATH se resuelve y se usa', async () => {
    // Plantilla mínima válida: un .docx real generado con la propia librería `docx`,
    // sin placeholders — solo para confirmar que resolveTemplatePath() encuentra y usa
    // un archivo legítimo dentro de TEMPLATES_PATH (contraparte del test de traversal).
    const { Document: DocxDocument, Packer, Paragraph } = require('docx');
    const simpleDoc = new DocxDocument({ sections: [{ children: [new Paragraph('PLANTILLA FIJA DE PRUEBA')] }] });
    const buffer = await Packer.toBuffer(simpleDoc);
    fs.writeFileSync(path.join(tmpTemplates, 'plantilla_valida.docx'), buffer);

    const docTypeConTemplate = { ...DOC_TYPE, template_path: 'plantilla_valida.docx' };
    const r = await generateDocuments({ jalId: JAL_ID, jalName: 'JAL', docType: docTypeConTemplate, data: DATA });
    const { value: text } = await mammoth.extractRawText({ path: r.docxPath });
    expect(text).toContain('PLANTILLA FIJA DE PRUEBA');
    // Word COM es una instancia única compartida por todo el proceso (ver wordConverter.js) —
    // bajo la suite completa (30+ archivos en paralelo) puede tardar más que el timeout
    // por defecto de 20s solo por contención, sin que sea un fallo real.
  }, 45000);
});
