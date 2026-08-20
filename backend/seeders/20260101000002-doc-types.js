'use strict';

const JAL_ID  = '00000000-0000-0000-0000-000000000001';

const DOC_TYPES = [
  // ── Tipos programáticos (sin plantilla) ─────────────────
  {
    id: '00000000-0000-0000-0000-000000000011',
    name: 'Constancia de Residencia',
    template_path: null,
    fields: [
      { name: 'cedula',           label: 'Número de cédula',       type: 'text',   required: true },
      { name: 'nombre_completo',  label: 'Nombre completo',         type: 'text',   required: true },
      { name: 'direccion',        label: 'Dirección de residencia', type: 'text',   required: true },
      { name: 'barrio',           label: 'Barrio',                  type: 'text',   required: true },
      { name: 'tiempo_residencia',label: 'Tiempo de residencia',    type: 'text',   required: true },
      { name: 'motivo',           label: 'Para qué se expide',      type: 'text',   required: true },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    name: 'Certificado de Servicio Social',
    template_path: null,
    fields: [
      { name: 'cedula',          label: 'Número de cédula',        type: 'text',   required: true },
      { name: 'nombre_completo', label: 'Nombre completo',          type: 'text',   required: true },
      { name: 'institucion',     label: 'Institución educativa',    type: 'text',   required: true },
      { name: 'horas',           label: 'Horas cumplidas',          type: 'number', required: true },
      { name: 'fecha_inicio',    label: 'Fecha de inicio',          type: 'date',   required: true },
      { name: 'fecha_fin',       label: 'Fecha de finalización',    type: 'date',   required: true },
      { name: 'periodo',         label: 'Periodo académico',        type: 'text',   required: true },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000013',
    name: 'Constancia de Convivencia',
    template_path: null,
    fields: [
      { name: 'cedula',            label: 'Número de cédula',        type: 'text', required: true },
      { name: 'nombre_completo',   label: 'Nombre completo',          type: 'text', required: true },
      { name: 'cedula_pareja',     label: 'Cédula de la pareja',      type: 'text', required: true },
      { name: 'nombre_pareja',     label: 'Nombre de la pareja',      type: 'text', required: true },
      { name: 'direccion',         label: 'Dirección de convivencia', type: 'text', required: true },
      { name: 'tiempo_convivencia',label: 'Tiempo de convivencia',    type: 'text', required: true },
      { name: 'motivo',            label: 'Para qué se expide',       type: 'text', required: true },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000014',
    name: 'Constancia de Estrato',
    template_path: null,
    fields: [
      { name: 'cedula',          label: 'Número de cédula',      type: 'text',   required: true },
      { name: 'nombre_completo', label: 'Nombre completo',        type: 'text',   required: true },
      { name: 'direccion',       label: 'Dirección del predio',   type: 'text',   required: true },
      { name: 'barrio',          label: 'Barrio',                 type: 'text',   required: true },
      { name: 'estrato',         label: 'Estrato socioeconómico', type: 'select', required: true, options: ['1','2','3','4','5','6'] },
      { name: 'motivo',          label: 'Para qué se expide',     type: 'text',   required: true },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000015',
    name: 'Constancia de Buenos Antecedentes',
    template_path: null,
    fields: [
      { name: 'cedula',          label: 'Número de cédula',       type: 'text', required: true },
      { name: 'nombre_completo', label: 'Nombre completo',         type: 'text', required: true },
      { name: 'direccion',       label: 'Dirección de residencia', type: 'text', required: true },
      { name: 'barrio',          label: 'Barrio',                  type: 'text', required: true },
      { name: 'motivo',          label: 'Para qué se expide',      type: 'text', required: true },
    ],
  },

  // ── Tipos con plantilla .docx real ──────────────────────
  {
    id: '00000000-0000-0000-0000-000000000021',
    name: 'Comunicado Oficial',
    template_path: 'plantillas/Comunicado Oficial.docx',
    fields: [
      { name: 'fecha',        label: 'Fecha',                     type: 'date',     required: true },
      { name: 'destinatario', label: 'Destinatario',              type: 'text',     required: true },
      { name: 'asunto',       label: 'Asunto',                    type: 'text',     required: true },
      { name: 'contenido',    label: 'Contenido del comunicado',  type: 'textarea', required: true },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000022',
    name: 'Citación a Sesión',
    template_path: 'plantillas/Citaciones Sesiones.docx',
    fields: [
      { name: 'nombre_directivo',   label: 'Nombre del citado',          type: 'text',     required: true },
      { name: 'nombre_entidad',     label: 'Entidad',                    type: 'text',     required: true },
      { name: 'direccion_entidad',  label: 'Dirección de la entidad',    type: 'text',     required: true },
      { name: 'tema',               label: 'Tema/Asunto',                type: 'text',     required: true },
      { name: 'lugar',              label: 'Lugar de la sesión',         type: 'text',     required: true },
      { name: 'fecha',              label: 'Fecha de la citación',       type: 'date',     required: true },
      { name: 'hora',               label: 'Hora',                       type: 'text',     required: true },
      { name: 'nombre_comuna',      label: 'Nombre de la comuna',        type: 'text',     required: true },
      { name: 'motivo',             label: 'Motivo adicional',           type: 'textarea', required: false },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000023',
    name: 'Certificado de Residencia',
    template_path: 'plantillas/Certificado de Residencia.docx',
    fields: [
      { name: 'fecha',             label: 'Fecha de expedición',              type: 'date', required: true },
      { name: 'numerodocumento',   label: 'Número de documento',              type: 'text', required: true },
      { name: 'lugardedocumento',  label: 'Lugar de expedición del documento',type: 'text', required: true },
      { name: 'dirección',         label: 'Dirección de residencia',          type: 'text', required: true },
      { name: 'tiemporesidencia',  label: 'Tiempo de residencia',             type: 'text', required: true },
      { name: 'telefono',          label: 'Teléfono',                         type: 'text', required: false },
      { name: 'correo',            label: 'Correo electrónico',               type: 'text', required: false },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000024',
    name: 'Certificado de Liderazgo',
    template_path: 'plantillas/Certificado Liderazgo.docx',
    fields: [
      { name: 'fecha',          label: 'Fecha de expedición', type: 'date',   required: true },
      { name: 'nombre',         label: 'Nombre completo',     type: 'text',   required: true },
      { name: 'tipodocumento',  label: 'Tipo de documento',   type: 'select', required: true, options: ['Cédula de ciudadanía','Tarjeta de identidad','Cédula de extranjería','Pasaporte'] },
      { name: 'numerodocumento',label: 'Número de documento', type: 'text',   required: true },
      { name: 'direccion',      label: 'Dirección',           type: 'text',   required: true },
      { name: 'tiempo',         label: 'Tiempo de liderazgo', type: 'text',   required: true },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000025',
    name: 'Carta Labor Social',
    template_path: 'plantillas/Carta Labor Social.docx',
    fields: [
      { name: 'fecha',          label: 'Fecha',                         type: 'date',   required: true },
      { name: 'universidad',    label: 'Universidad/Institución',        type: 'text',   required: true },
      { name: 'nombre',         label: 'Nombre del estudiante',          type: 'text',   required: true },
      { name: 'tipodocumento',  label: 'Tipo de documento',              type: 'select', required: true, options: ['Cédula de ciudadanía','Tarjeta de identidad','Cédula de extranjería','Pasaporte'] },
      { name: 'numerodocumento',label: 'Número de documento',            type: 'text',   required: true },
      { name: 'lugardocumento', label: 'Lugar de expedición',            type: 'text',   required: true },
      { name: 'direccion',      label: 'Dirección de residencia',        type: 'text',   required: true },
      { name: 'celular',        label: 'Celular',                        type: 'text',   required: true },
      { name: 'correo',         label: 'Correo electrónico',             type: 'text',   required: true },
      { name: 'programa',       label: 'Programa académico',             type: 'text',   required: true },
      { name: 'numerohoras',    label: 'Número de horas',                type: 'number', required: true },
      { name: 'lugarservicio',  label: 'Lugar del servicio social',      type: 'text',   required: true },
      { name: 'fechainicial',   label: 'Fecha inicial',                  type: 'date',   required: true },
      { name: 'fechafinal',     label: 'Fecha final',                    type: 'date',   required: true },
      { name: 'numeroperiodo',  label: 'Periodo académico',              type: 'text',   required: true },
    ],
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = DOC_TYPES.map((dt) => ({
      id:            dt.id,
      jal_id:        JAL_ID,
      name:          dt.name,
      fields:        JSON.stringify(dt.fields),
      template_path: dt.template_path,
      active:        true,
      created_at:    now,
      updated_at:    now,
    }));

    await queryInterface.bulkInsert('doc_types', rows, { ignoreDuplicates: true });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('doc_types', { jal_id: JAL_ID });
  },
};
