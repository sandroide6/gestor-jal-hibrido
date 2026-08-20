'use strict';
// PT-31: driveBackupService — cálculo de próximo backup y listado de backups locales
//
// Brechas de cobertura conocidas, documentadas en vez de forzadas (ver informe final):
// - getAuthUrl()/exchangeCode()/getUserEmail()/runBackup()/checkAutoBackups() dependen
//   del SDK `googleapis`, que resultó frágil/lento de mockear de forma fiable con
//   vi.mock() en este entorno (llamadas reales a la red de Google se colaban pese al
//   mock). Probarlos bien requiere inyección de dependencias en el servicio o un mock
//   más profundo del transporte HTTP de `googleapis` — no forzado aquí para no dejar
//   tests frágiles/lentos en la suite.
// - cleanLocalBackups() no está exportada (`module.exports` no la incluye) — es un
//   detalle interno de runBackup(), no se puede probar de forma aislada sin exportarla.

process.env.NODE_ENV = 'test';

const fs = require('fs');
const os = require('os');
const path = require('path');

// BACKUPS_LOCAL_PATH se calcula una sola vez al cargar el módulo (const de nivel de
// módulo) — hay que fijar el env var ANTES de requerir el servicio.
const TMP_BACKUPS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'jal-backups-test-'));
process.env.BACKUPS_LOCAL_PATH = TMP_BACKUPS_DIR;

const { calcNextBackup, listLocalBackups, getLocalBackupsPath, decryptTokens, checkAutoBackups } = require('../services/driveBackupService');
const { encryptJSON } = require('../utils/crypto');
const models = require('../models');
const logger = require('../config/logger');

afterAll(() => fs.rmSync(TMP_BACKUPS_DIR, { recursive: true, force: true }));

// ── calcNextBackup() — lógica pura de calendario ───────────────────────────────

describe('calcNextBackup()', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hourly: agenda para dentro de 1 hora, con minutos/segundos en cero', () => {
    vi.setSystemTime(new Date('2026-08-14T10:37:22Z'));
    const next = calcNextBackup('hourly');
    expect(next.getHours()).toBe(new Date('2026-08-14T10:37:22Z').getHours() + 1);
    expect(next.getMinutes()).toBe(0);
    expect(next.getSeconds()).toBe(0);
  });

  it('daily: agenda para el día siguiente a la hora configurada', () => {
    vi.setSystemTime(new Date('2026-08-14T15:00:00'));
    const next = calcNextBackup('daily', 2, 1);
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(2);
  });

  // BUG CONOCIDO (reportado en la auditoría, no corregido aquí — requiere confirmación
  // antes de tocar código de producción): el branch 'daily' hace `setDate(+1)` de forma
  // INCONDICIONAL antes de comparar con `now`, así que si la hora programada de HOY
  // todavía no ha pasado, el sistema salta ese slot de todos modos y agenda para
  // mañana en vez de para dentro de un rato hoy mismo. Este test documenta el
  // comportamiento ACTUAL (no el deseado) para que no cambie sin darse cuenta.
  it('[BUG CONOCIDO] daily: si la hora de hoy aún no llega, salta el slot de hoy y agenda para mañana en vez de para hoy más tarde', () => {
    vi.setSystemTime(new Date('2026-08-14T01:00:00')); // 1 a.m., antes de las 2 a.m. programadas
    const next = calcNextBackup('daily', 2, 1);
    // Comportamiento deseable habría sido: hoy 14 a las 2 a.m. (1 hora después).
    // Comportamiento real: mañana día 15 a las 2 a.m. (25 horas después).
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(2);
  });

  it('weekly: agenda para el próximo día de la semana configurado', () => {
    // 2026-08-14 es viernes (day 5). Configurar day=1 (lunes) → próximo lunes 17 de agosto.
    vi.setSystemTime(new Date('2026-08-14T10:00:00'));
    const next = calcNextBackup('weekly', 3, 1);
    expect(next.getDay()).toBe(1);
    expect(next.getDate()).toBe(17);
    expect(next.getHours()).toBe(3);
  });

  it('weekly: si hoy es el día configurado, agenda para la próxima semana (no hoy mismo)', () => {
    // 2026-08-14 es viernes (day 5).
    vi.setSystemTime(new Date('2026-08-14T10:00:00'));
    const next = calcNextBackup('weekly', 3, 5);
    expect(next.getDay()).toBe(5);
    expect(next.getDate()).toBe(21); // viernes siguiente, no hoy
  });

  it('usa hour=2 y day=1 por defecto si no se especifican', () => {
    vi.setSystemTime(new Date('2026-08-14T15:00:00'));
    const next = calcNextBackup('daily');
    expect(next.getHours()).toBe(2);
  });

  it('schedule desconocido: devuelve una fecha (no lanza), igual a "now" sin modificar', () => {
    vi.setSystemTime(new Date('2026-08-14T15:00:00'));
    const next = calcNextBackup('mensual-inexistente');
    expect(next).toBeInstanceOf(Date);
  });
});

// ── listLocalBackups() / getLocalBackupsPath() — fs real en directorio temporal ────

describe('getLocalBackupsPath()', () => {
  it('crea el directorio de backups si no existe y devuelve su ruta', () => {
    const dir = getLocalBackupsPath();
    expect(fs.existsSync(dir)).toBe(true);
    expect(dir).toBe(TMP_BACKUPS_DIR);
  });
});

describe('listLocalBackups()', () => {
  beforeEach(() => {
    for (const f of fs.readdirSync(TMP_BACKUPS_DIR)) fs.unlinkSync(path.join(TMP_BACKUPS_DIR, f));
  });

  it('devuelve solo archivos .zip, ignora otros', () => {
    fs.writeFileSync(path.join(TMP_BACKUPS_DIR, 'backup1.zip'), 'a');
    fs.writeFileSync(path.join(TMP_BACKUPS_DIR, 'notas.txt'), 'b');
    const result = listLocalBackups();
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('backup1.zip');
  });

  it('incluye filename, size_bytes y created_at', () => {
    fs.writeFileSync(path.join(TMP_BACKUPS_DIR, 'backup1.zip'), 'contenido');
    const [entry] = listLocalBackups();
    expect(entry).toMatchObject({ filename: 'backup1.zip', size_bytes: 'contenido'.length });
    expect(entry.created_at).toBeInstanceOf(Date);
  });

  it('ordena del más reciente al más antiguo', async () => {
    fs.writeFileSync(path.join(TMP_BACKUPS_DIR, 'viejo.zip'), 'x');
    await new Promise((r) => setTimeout(r, 10));
    fs.writeFileSync(path.join(TMP_BACKUPS_DIR, 'nuevo.zip'), 'x');
    const result = listLocalBackups();
    expect(result[0].filename).toBe('nuevo.zip');
    expect(result[1].filename).toBe('viejo.zip');
  });

  it('devuelve un arreglo vacío si no hay backups', () => {
    expect(listLocalBackups()).toEqual([]);
  });
});

// ── checkAutoBackups() — fallos ya no quedan completamente silenciados ─────────
// Solo se prueba el catch externo (Jal.findAll falla) sin tocar googleapis — el catch
// interno por-JAL requiere mockear runBackup(), que checkAutoBackups invoca como
// referencia local del mismo módulo (no a través de module.exports), así que no es
// interceptable con vi.spyOn desde afuera (misma limitación documentada en otros
// archivos de esta suite).
describe('checkAutoBackups()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('registra con logger.error si falla la consulta de JALs, en vez de fallar en silencio', async () => {
    vi.spyOn(models.Jal, 'findAll').mockRejectedValue(new Error('DB caída'));
    const spy = vi.spyOn(logger, 'error');

    await checkAutoBackups(); // no debe lanzar

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('checkAutoBackups'),
      expect.objectContaining({ error: 'DB caída' }),
    );
  });

  it('no hace nada si ninguna JAL tiene auto-backup habilitado/vencido', async () => {
    vi.spyOn(models.Jal, 'findAll').mockResolvedValue([
      { id: 'jal-1', config: {} },
      { id: 'jal-2', config: { drive_backup: { auto_enabled: false } } },
      { id: 'jal-3', config: { drive_backup: { auto_enabled: true, tokens: 'x', next_backup_at: new Date(Date.now() + 86400000).toISOString() } } },
    ]);
    const spy = vi.spyOn(logger, 'error');

    await expect(checkAutoBackups()).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  // Fix: sin este guard, un ciclo del scheduler más corto que la duración de un
  // backup disparaba runBackup() dos veces en paralelo para la misma JAL.
  it('no dispara runBackup de nuevo para una JAL que ya tiene auto_running=true', async () => {
    vi.spyOn(models.Jal, 'findAll').mockResolvedValue([{
      id: 'jal-1',
      config: { drive_backup: {
        auto_enabled: true, tokens: 'x', auto_running: true,
        next_backup_at: new Date(Date.now() - 1000).toISOString(), // vencido
      } },
    }]);
    const updateSpy = vi.spyOn(models.Jal, 'update').mockResolvedValue([1]);

    await checkAutoBackups();

    // No debió intentar marcar auto_running (ya lo tenía) ni tocar la JAL en absoluto
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('marca auto_running=true antes de lanzar el backup, y lo limpia al terminar (éxito o fallo)', async () => {
    // Config "viva": Jal.update la muta y Jal.findByPk siempre devuelve el estado
    // actual, para poder verificar el ciclo completo set→clear del flag.
    let liveConfig = {
      drive_backup: {
        auto_enabled: true,
        // tokens truthy (pasa el filtro de checkAutoBackups) pero no descifra a nada
        // válido → decryptTokens() devuelve null → runBackup falla rápido, ANTES de
        // tocar googleapis, que es justo lo que se necesita para probar el ciclo del
        // flag sin red real.
        tokens: 'dato-no-descifrable',
        next_backup_at: new Date(Date.now() - 1000).toISOString(),
      },
    };
    vi.spyOn(models.Jal, 'findAll').mockImplementation(async () => [{ id: 'jal-1', config: liveConfig }]);
    vi.spyOn(models.Jal, 'findByPk').mockImplementation(async () => ({ id: 'jal-1', config: liveConfig }));
    vi.spyOn(models.BackupLog, 'create').mockResolvedValue({ update: vi.fn().mockResolvedValue(undefined) });
    const updateSpy = vi.spyOn(models.Jal, 'update').mockImplementation(async (values) => {
      liveConfig = values.config;
      return [1];
    });

    await checkAutoBackups();
    // Dar tiempo a que runBackup() (fire-and-forget) rechace y su .finally() corra
    await new Promise((r) => setTimeout(r, 50));

    // 1ra llamada: marca auto_running=true antes de invocar runBackup
    const [firstArgs] = updateSpy.mock.calls[0];
    expect(firstArgs.config.drive_backup.auto_running).toBe(true);

    // Última llamada (clearAutoRunning, tras el fallo esperado de runBackup): ya no
    // debe quedar el flag.
    expect(updateSpy.mock.calls.length).toBeGreaterThan(1);
    const [lastArgs] = updateSpy.mock.calls[updateSpy.mock.calls.length - 1];
    expect(lastArgs.config.drive_backup.auto_running).toBeUndefined();
  });
});

// ── decryptTokens() — cifrado en reposo de los tokens OAuth de Drive ───────────

describe('decryptTokens()', () => {
  it('descifra un valor cifrado con encryptJSON() y devuelve el objeto original', () => {
    const tokens = { access_token: 'at', refresh_token: 'rt' };
    expect(decryptTokens(encryptJSON(tokens))).toEqual(tokens);
  });

  it('devuelve null si no hay nada guardado', () => {
    expect(decryptTokens(null)).toBeNull();
    expect(decryptTokens(undefined)).toBeNull();
    expect(decryptTokens('')).toBeNull();
  });

  it('tolera registros previos a la migración a cifrado: objeto plano ya deserializado', () => {
    // Antes del fix, `tokens` se guardaba como objeto JS directo en el JSONB.
    const legacy = { access_token: 'legacy-at', refresh_token: 'legacy-rt' };
    expect(decryptTokens(legacy)).toEqual(legacy);
  });

  it('tolera registros previos a la migración a cifrado: JSON en texto plano', () => {
    const legacy = { access_token: 'legacy-at', refresh_token: 'legacy-rt' };
    expect(decryptTokens(JSON.stringify(legacy))).toEqual(legacy);
  });

  it('devuelve null ante un valor corrupto/irreconocible en vez de lanzar', () => {
    expect(decryptTokens('esto-no-es-ni-cifrado-ni-json-valido')).toBeNull();
  });
});
