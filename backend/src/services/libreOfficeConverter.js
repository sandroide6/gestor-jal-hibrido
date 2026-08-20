'use strict';
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Conversión DOCX → PDF vía LibreOffice headless — usada en Linux (Render), donde
// Word COM (wordConverter.js) no existe. A diferencia de Word, LibreOffice no ofrece
// un modo servidor persistente sencillo: se lanza un proceso `soffice` por conversión.
// Cada invocación recibe su propio `-env:UserInstallation` porque LibreOffice falla o
// se cuelga si dos procesos headless comparten el mismo perfil de usuario en paralelo
// — con hasta 7 usuarios concurrentes generando documentos, esto puede pasar.
class LibreOfficeConverter {
  async convert(docxBuffer) {
    const id = `loconv_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const workDir = path.join(os.tmpdir(), id);
    const profileDir = path.join(os.tmpdir(), `${id}_profile`);
    const docxPath = path.join(workDir, 'input.docx');
    const pdfPath = path.join(workDir, 'input.pdf');

    fs.mkdirSync(workDir, { recursive: true });
    fs.writeFileSync(docxPath, docxBuffer);

    try {
      await this._run(docxPath, workDir, profileDir);
      if (!fs.existsSync(pdfPath)) {
        throw new Error('LibreOffice no generó el PDF esperado');
      }
      return fs.readFileSync(pdfPath);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  }

  _run(docxPath, outDir, profileDir) {
    return new Promise((resolve, reject) => {
      const proc = spawn('soffice', [
        '--headless',
        '--norestore',
        `-env:UserInstallation=file://${profileDir}`,
        '--convert-to', 'pdf',
        '--outdir', outDir,
        docxPath,
      ]);

      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('LibreOffice: timeout de conversión'));
      }, 60_000);

      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`LibreOffice no se pudo iniciar: ${err.message}`));
      });

      proc.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`LibreOffice terminó con código ${code}: ${stderr.trim()}`));
      });
    });
  }
}

module.exports = new LibreOfficeConverter();
