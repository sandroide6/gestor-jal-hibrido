'use strict';
// Tests para wordConverter (services/wordConverter.js) — el servicio real depende de
// Word vía COM, orquestado por un subproceso PowerShell (scripts/word_server.ps1), que
// no está disponible en este entorno de test (ni conviene lanzarlo en CI). En vez de
// mockear child_process.spawn (que está desestructurado en el módulo — `const { spawn }
// = require('child_process')` — así que vi.spyOn sobre el módulo no interceptaría esa
// referencia ya capturada, igual que con syncController.processBatch), se testea la
// lógica de orquestación (convert/_ensureReady/shutdown) espiando los MÉTODOS DE LA
// INSTANCIA singleton (this._launch(), this._request()), que sí se resuelven por
// property-access en cada llamada y por tanto son interceptables con vi.spyOn.
process.env.NODE_ENV = 'test';

const fs = require('fs');

const wordConverter = require('../services/wordConverter');

function resetState() {
  wordConverter._proc = null;
  wordConverter._ready = false;
  wordConverter._startPromise = null;
  wordConverter._pending = new Map();
  wordConverter._nextId = 1;
}

beforeEach(resetState);
afterEach(() => {
  vi.restoreAllMocks();
  resetState();
});

describe('convert()', () => {
  it('escribe el buffer de entrada, delega en _ensureReady/_request y retorna el PDF generado', async () => {
    vi.spyOn(wordConverter, '_ensureReady').mockResolvedValue(undefined);
    vi.spyOn(wordConverter, '_request').mockImplementation(async (req) => {
      fs.writeFileSync(req.pdf, Buffer.from('FAKE_PDF_BYTES'));
    });

    const result = await wordConverter.convert(Buffer.from('FAKE_DOCX_BYTES'));

    expect(result).toEqual(Buffer.from('FAKE_PDF_BYTES'));
    expect(wordConverter._ensureReady).toHaveBeenCalledOnce();
    expect(wordConverter._request).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(Number),
        docx: expect.stringContaining('.docx'),
        pdf: expect.stringContaining('.pdf'),
      })
    );
  });

  it('incrementa _nextId en cada conversión para no reutilizar ids de request', async () => {
    vi.spyOn(wordConverter, '_ensureReady').mockResolvedValue(undefined);
    vi.spyOn(wordConverter, '_request').mockImplementation(async (req) => {
      fs.writeFileSync(req.pdf, Buffer.from('x'));
    });

    await wordConverter.convert(Buffer.from('a'));
    await wordConverter.convert(Buffer.from('b'));

    const ids = wordConverter._request.mock.calls.map(([req]) => req.id);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('limpia los archivos temporales (docx y pdf) incluso en el camino feliz', async () => {
    let capturedPaths;
    vi.spyOn(wordConverter, '_ensureReady').mockResolvedValue(undefined);
    vi.spyOn(wordConverter, '_request').mockImplementation(async (req) => {
      capturedPaths = { docx: req.docx, pdf: req.pdf };
      fs.writeFileSync(req.pdf, Buffer.from('x'));
    });

    await wordConverter.convert(Buffer.from('y'));

    expect(fs.existsSync(capturedPaths.docx)).toBe(false);
    expect(fs.existsSync(capturedPaths.pdf)).toBe(false);
  });

  it('limpia el archivo temporal e intenta limpiar el pdf aunque _ensureReady falle', async () => {
    vi.spyOn(wordConverter, '_ensureReady').mockRejectedValue(new Error('Word server: timeout al iniciar'));
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync');

    await expect(wordConverter.convert(Buffer.from('z'))).rejects.toThrow('Word server: timeout al iniciar');

    // finally intenta borrar ambos temporales; el .pdf nunca se creó pero el intento ocurre
    // (el propio código lo envuelve en try/catch, así que no revienta el test).
    expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('.docx'));
    expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('.pdf'));
  });

  it('propaga el error cuando _request falla (p. ej. el Word server terminó)', async () => {
    vi.spyOn(wordConverter, '_ensureReady').mockResolvedValue(undefined);
    vi.spyOn(wordConverter, '_request').mockRejectedValue(new Error('Conversión Word falló'));

    await expect(wordConverter.convert(Buffer.from('a'))).rejects.toThrow('Conversión Word falló');
  });
});

describe('_ensureReady()', () => {
  it('resuelve inmediatamente sin lanzar el proceso cuando ya está listo', async () => {
    wordConverter._ready = true;
    const launchSpy = vi.spyOn(wordConverter, '_launch');

    await expect(wordConverter._ensureReady()).resolves.toBeUndefined();
    expect(launchSpy).not.toHaveBeenCalled();
  });

  it('reutiliza la promesa de arranque en curso en vez de relanzar el proceso', () => {
    const launchSpy = vi.spyOn(wordConverter, '_launch');
    const pending = new Promise(() => {}); // nunca se resuelve; solo interesa la reutilización
    wordConverter._startPromise = pending;

    const result = wordConverter._ensureReady();

    expect(result).toBe(pending);
    expect(launchSpy).not.toHaveBeenCalled();
  });

  it('limpia _startPromise y propaga el error cuando _launch falla', async () => {
    vi.spyOn(wordConverter, '_launch').mockRejectedValue(new Error('Word server terminó con código 1'));

    await expect(wordConverter._ensureReady()).rejects.toThrow('Word server terminó con código 1');
    expect(wordConverter._startPromise).toBeNull();
  });
});

describe('shutdown()', () => {
  it('no lanza error cuando no hay proceso activo', () => {
    wordConverter._proc = null;
    expect(() => wordConverter.shutdown()).not.toThrow();
  });

  it('cierra stdin y limpia el estado cuando hay un proceso activo', () => {
    const end = vi.fn();
    wordConverter._proc = { stdin: { end } };
    wordConverter._ready = true;

    wordConverter.shutdown();

    expect(end).toHaveBeenCalledOnce();
    expect(wordConverter._proc).toBeNull();
    expect(wordConverter._ready).toBe(false);
  });

  it('no lanza error aunque stdin.end() falle', () => {
    wordConverter._proc = { stdin: { end: () => { throw new Error('stream ya cerrado'); } } };
    expect(() => wordConverter.shutdown()).not.toThrow();
    expect(wordConverter._proc).toBeNull();
  });
});
