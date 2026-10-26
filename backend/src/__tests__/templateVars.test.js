'use strict';
const fs = require('fs');
const path = require('path');
const { validateTemplateVars } = require('../controllers/docTypesController');
const seeder = require('../../seeders/20260101000002-doc-types');

const tpl = (name) => fs.readFileSync(path.join(__dirname, '../../plantillas', name));

describe('validateTemplateVars() con las plantillas reales ({variable})', () => {
  it('avisa cuando la plantilla usa variables sin campo definido', () => {
    const [warning] = validateTemplateVars(tpl('Certificado de Residencia.docx'), ['fecha']);
    expect(warning).toMatch(/Nombre/);
    expect(warning).toMatch(/tipodeidentificacion/);
    expect(warning).not.toMatch(/firma_img|nombre_encargado|cargo\b/);
  });

  it('no avisa cuando todos los campos existen', () => {
    const fields = ['fecha', 'destinatario', 'asunto', 'contenido'];
    expect(validateTemplateVars(tpl('Comunicado Oficial.docx'), fields)).toEqual([]);
  });

  it('cada tipo sembrado con plantilla tiene un campo para cada variable', async () => {
    let rows = [];
    await seeder.up({ bulkInsert: async (_t, r) => { rows = r; } });
    const withTemplate = rows.filter((r) => r.template_path);
    expect(withTemplate.length).toBeGreaterThan(0);
    for (const r of withTemplate) {
      const names = JSON.parse(r.fields).map((f) => f.name);
      expect(validateTemplateVars(tpl(path.basename(r.template_path)), names), r.name).toEqual([]);
    }
  });
});
