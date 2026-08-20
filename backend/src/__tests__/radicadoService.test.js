'use strict';
// PT-30: radicadoService — formato del número de radicado y contrato del consecutivo atómico
//
// No se conecta a una BD real: Document.sequelize.query se mockea para devolver el
// last_value que el UPSERT (INSERT ... ON CONFLICT DO UPDATE ... RETURNING) habría
// devuelto en cada escenario. La atomicidad real del UPSERT es una garantía de Postgres,
// no algo que un test unitario en memoria pueda demostrar — eso se verificó por separado
// con generaciones concurrentes reales contra la BD (ver sesión de implementación).
// Lo que sí se puede y se debe garantizar aquí es el CONTRATO: qué reemplazos se pasan
// a la query, dentro de qué transacción, y cómo se arma el string final.

process.env.NODE_ENV = 'test';

const models = require('../models');
const { assignNumeroRadicado } = require('../services/radicadoService');

const FAKE_TRANSACTION = { id: 'fake-tx' };

function mockCounterRow(lastValue) {
  models.Document.sequelize.query.mockResolvedValue([{ last_value: lastValue }]);
}

beforeEach(() => {
  vi.spyOn(models.Jal, 'findByPk');
  vi.spyOn(models.Document.sequelize, 'query');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('assignNumeroRadicado()', () => {

  it('arma el número con el formato AÑO-CODIGO-TIPO-CONSECUTIVO(6 dígitos)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'));
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: { codigo_dependencia: 'JALC12' } });
    mockCounterRow(45);

    const result = await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });

    expect(result).toBe('2026-JALC12-SAL-000045');
  });

  it('usa el año actual del sistema, no un valor fijo', async () => {
    vi.useFakeTimers();
    // Mediodía (no medianoche) para que el resultado sea estable sin importar la
    // zona horaria local del entorno donde corra el test.
    vi.setSystemTime(new Date('2031-06-15T12:00:00Z'));
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: { codigo_dependencia: 'ABC' } });
    mockCounterRow(1);

    const result = await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });

    expect(result).toBe('2031-ABC-SAL-000001');
  });

  it('rellena el consecutivo con ceros a la izquierda hasta 6 dígitos', async () => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: { codigo_dependencia: 'ABC' } });
    mockCounterRow(1);
    expect(await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION }))
      .toMatch(/-000001$/);

    mockCounterRow(999);
    expect(await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION }))
      .toMatch(/-000999$/);
  });

  it('no trunca el consecutivo si supera 6 dígitos (999999 documentos en un año)', async () => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: { codigo_dependencia: 'ABC' } });
    mockCounterRow(1000000);
    const result = await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });
    expect(result).toMatch(/-1000000$/);
  });

  it.each([
    ['entrada', 'ENT'],
    ['salida', 'SAL'],
    ['interno', 'INT'],
  ])('usa la abreviatura %s → %s para tipo_tramite', async (tipo, abbr) => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: { codigo_dependencia: 'ABC' } });
    mockCounterRow(1);
    const result = await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: tipo, transaction: FAKE_TRANSACTION });
    expect(result).toContain(`-${abbr}-`);
  });

  it('usa INT como abreviatura de respaldo si tipo_tramite es inválido o desconocido', async () => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: { codigo_dependencia: 'ABC' } });
    mockCounterRow(1);
    const result = await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'algo-invalido', transaction: FAKE_TRANSACTION });
    expect(result).toContain('-INT-');
  });

  // ── Código de dependencia: saneamiento y fallback ──────────────────────────

  it('convierte el código de dependencia a mayúsculas', async () => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: { codigo_dependencia: 'jalc12' } });
    mockCounterRow(1);
    const result = await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });
    expect(result).toContain('-JALC12-');
  });

  it('elimina caracteres no alfanuméricos del código de dependencia', async () => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: { codigo_dependencia: 'JAL-C 12!' } });
    mockCounterRow(1);
    const result = await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });
    expect(result).toContain('-JALC12-');
  });

  it('usa JAL como código por defecto cuando la JAL no tiene codigo_dependencia configurado', async () => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: {} });
    mockCounterRow(1);
    const result = await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });
    expect(result).toContain('-JAL-');
  });

  it('usa JAL como código por defecto cuando jal.config es null', async () => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: null });
    mockCounterRow(1);
    const result = await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });
    expect(result).toContain('-JAL-');
  });

  it('usa JAL como código por defecto cuando Jal.findByPk devuelve null (JAL no encontrada)', async () => {
    models.Jal.findByPk.mockResolvedValue(null);
    mockCounterRow(1);
    const result = await assignNumeroRadicado({ jalId: 'jal-inexistente', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });
    expect(result).toContain('-JAL-');
  });

  it('usa JAL como código por defecto cuando codigo_dependencia queda vacío tras sanear (solo símbolos)', async () => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: { codigo_dependencia: '!!!---' } });
    mockCounterRow(1);
    const result = await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });
    expect(result).toContain('-JAL-');
  });

  // ── Contrato de la query atómica ────────────────────────────────────────────

  it('consulta el JAL dentro de la misma transacción recibida', async () => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: {} });
    mockCounterRow(1);
    await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });
    expect(models.Jal.findByPk).toHaveBeenCalledWith('jal-1', { transaction: FAKE_TRANSACTION });
  });

  it('pasa jalId, year y tipoTramite como replacements nombrados a la query del contador', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: {} });
    mockCounterRow(1);

    await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'entrada', transaction: FAKE_TRANSACTION });

    const [, options] = models.Document.sequelize.query.mock.calls[0];
    expect(options.replacements).toEqual({ jalId: 'jal-1', year: 2026, tipoTramite: 'entrada' });
  });

  it('ejecuta la query del contador dentro de la misma transacción recibida', async () => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: {} });
    mockCounterRow(1);
    await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });
    const [, options] = models.Document.sequelize.query.mock.calls[0];
    expect(options.transaction).toBe(FAKE_TRANSACTION);
  });

  it('la query usa INSERT ... ON CONFLICT ... DO UPDATE (UPSERT atómico, no lectura+escritura separadas)', async () => {
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: {} });
    mockCounterRow(1);
    await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });
    const [sql] = models.Document.sequelize.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO radicado_counters/i);
    expect(sql).toMatch(/ON CONFLICT \(jal_id, year, tipo_tramite\)/i);
    expect(sql).toMatch(/DO UPDATE SET last_value = radicado_counters\.last_value \+ 1/i);
    expect(sql).toMatch(/RETURNING last_value/i);
  });

  it('dos llamadas con distinto tipo_tramite generan claves de contador independientes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    models.Jal.findByPk.mockResolvedValue({ id: 'jal-1', config: {} });

    mockCounterRow(1);
    await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'entrada', transaction: FAKE_TRANSACTION });
    mockCounterRow(1);
    await assignNumeroRadicado({ jalId: 'jal-1', tipoTramite: 'salida', transaction: FAKE_TRANSACTION });

    const [, opts1] = models.Document.sequelize.query.mock.calls[0];
    const [, opts2] = models.Document.sequelize.query.mock.calls[1];
    expect(opts1.replacements.tipoTramite).toBe('entrada');
    expect(opts2.replacements.tipoTramite).toBe('salida');
  });
});
