'use strict';
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const PS_SERVER = path.join(__dirname, '..', '..', 'scripts', 'word_server.ps1');

class WordConverter {
  constructor() {
    this._proc = null;
    this._ready = false;
    this._startPromise = null;
    this._pending = new Map();
    this._nextId = 1;
  }

  async convert(docxBuffer) {
    const tmpId  = `wconv_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tmpIn  = path.join(os.tmpdir(), `${tmpId}.docx`);
    const tmpOut = path.join(os.tmpdir(), `${tmpId}.pdf`);

    fs.writeFileSync(tmpIn, docxBuffer);
    try {
      await this._ensureReady();
      const id = this._nextId++;
      await this._request({ id, docx: tmpIn, pdf: tmpOut });
      return fs.readFileSync(tmpOut);
    } finally {
      try { fs.unlinkSync(tmpIn);  } catch {}
      try { fs.unlinkSync(tmpOut); } catch {}
    }
  }

  _ensureReady() {
    if (this._ready) return Promise.resolve();
    if (this._startPromise) return this._startPromise;
    this._startPromise = this._launch().catch((err) => {
      this._startPromise = null;
      throw err;
    });
    return this._startPromise;
  }

  _launch() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Word server: timeout al iniciar')), 40_000);

      this._proc = spawn('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', PS_SERVER,
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      let buf = '';
      this._proc.stdout.on('data', (chunk) => {
        buf += chunk.toString();
        let nl;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.ready) {
              clearTimeout(timer);
              this._ready = true;
              resolve();
            } else if (msg.id !== undefined) {
              const cb = this._pending.get(msg.id);
              if (cb) { this._pending.delete(msg.id); cb(msg); }
            }
          } catch {}
        }
      });

      this._proc.stderr.on('data', (d) => {
        const txt = d.toString().trim();
        if (txt) console.warn('[wordConverter] stderr:', txt);
      });

      this._proc.on('exit', (code) => {
        this._ready = false;
        this._proc = null;
        this._startPromise = null;
        // Rechazar pendientes si el proceso muere inesperadamente
        for (const [, cb] of this._pending) cb({ ok: false, error: `Word server terminó (código ${code})` });
        this._pending.clear();
        clearTimeout(timer);
        if (!this._ready) reject(new Error(`Word server terminó con código ${code}`));
      });
    });
  }

  _request(req) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(req.id);
        reject(new Error('Word server: timeout de conversión'));
      }, 60_000);

      this._pending.set(req.id, (msg) => {
        clearTimeout(timer);
        if (msg.ok) resolve();
        else reject(new Error(msg.error || 'Conversión Word falló'));
      });

      this._proc.stdin.write(JSON.stringify(req) + '\n');
    });
  }

  shutdown() {
    if (this._proc) {
      try { this._proc.stdin.end(); } catch {}
      this._proc = null;
      this._ready = false;
    }
  }
}

module.exports = new WordConverter();
