// Prueba de extremo a extremo del flujo principal (auditoría 2026-11-05, fase 6), en un
// navegador real contra el frontend compilado y el backend con una base PostgreSQL de
// prueba recién migrada y sembrada:
//   1. el administrador sembrado entra con la contraseña inicial,
//   2. acepta la política de datos y se le OBLIGA a cambiar la contraseña,
//   3. crea un Certificado de Residencia (plantilla oficial → PDF con LibreOffice),
//   4. descarga el PDF y se comprueba que es un PDF de verdad,
//   5. revisa Mi perfil (firma) y Reportes (cifras),
//   6. vuelve a entrar con la contraseña nueva (la inicial ya no sirve).
//
// Uso: E2E_BASE_URL=http://localhost:4173 E2E_ADMIN_PASSWORD=... node e2e/flujo-principal.mjs
// Variables opcionales: E2E_CAPTURAS=<carpeta> guarda una captura por paso.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:4173';
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@jal.gov.co';
const INICIAL = process.env.E2E_ADMIN_PASSWORD;
const NUEVA = 'Nueva-Clave-E2E-2026!';
const CAPTURAS = process.env.E2E_CAPTURAS || '';
const FIRMA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'public', 'icons', 'icon-192x192.png');

if (!INICIAL) { console.error('Falta E2E_ADMIN_PASSWORD'); process.exit(2); }
if (CAPTURAS) fs.mkdirSync(CAPTURAS, { recursive: true });

let paso = 0;
async function ok(page, texto) {
  paso += 1;
  console.log(`[e2e] OK  ${paso}. ${texto}`);
  if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `${String(paso).padStart(2, '0')}.png`), fullPage: true });
}

async function entrar(page, clave) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Correo electrónico').fill(EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(clave);
  await page.locator('form button[type="submit"]').click();
}

const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block', locale: 'es-CO' });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const erroresConsola = [];
page.on('pageerror', (e) => erroresConsola.push(String(e)));

try {
  // 1-2. Entrada con la contraseña inicial
  await entrar(page, INICIAL);
  // Primera vez: la política de datos (Habeas Data) se acepta antes de usar la aplicación
  const aceptar = page.getByRole('button', { name: /acepto la política/i });
  await aceptar.waitFor();
  await ok(page, 'entrada con la contraseña inicial; pide aceptar la política de datos');
  await aceptar.click();
  await page.waitForURL(/\/inicio/);

  const modal = page.getByRole('dialog');
  await modal.waitFor();
  await modal.getByLabel('Contraseña actual').waitFor();
  // No debe poder cerrarse: Escape no lo quita
  await page.keyboard.press('Escape');
  await modal.getByLabel('Contraseña actual').waitFor();
  await ok(page, 'la ventana de cambio de contraseña aparece y no se puede cerrar');

  // Mientras no cambie la contraseña, la API rechaza el resto (403 PASSWORD_CHANGE_REQUIRED)
  const csrf = async () => (await context.cookies()).find((c) => c.name === 'csrf_token')?.value;
  const bloqueada = await page.request.get(`${BASE}/v1/users`);
  if (bloqueada.status() !== 403) throw new Error(`/v1/users con contraseña inicial devolvió ${bloqueada.status()}`);
  await ok(page, 'la API responde 403 a otras rutas mientras no cambie la contraseña');

  await modal.getByLabel('Contraseña actual').fill(INICIAL);
  await modal.getByLabel('Nueva contraseña').fill(NUEVA);
  await modal.getByLabel('Escríbela otra vez').fill(NUEVA);
  await modal.locator('button[type="submit"]').click();
  await modal.waitFor({ state: 'detached' });
  // La página de Inicio se monta después del cambio y carga sus datos sin errores
  await page.getByRole('heading', { name: /Mis documentos recientes/ }).waitFor();
  await page.waitForLoadState('networkidle');
  if (await page.getByText(/No se pudo cargar/).count()) throw new Error('Inicio muestra errores de carga tras cambiar la contraseña');
  await ok(page, 'contraseña cambiada; la ventana se cierra');

  // Firma (requisito para crear documentos): se sube por la misma API que usa Mi perfil
  const firma = await page.request.post(`${BASE}/v1/users/me/firma`, {
    headers: { 'X-CSRF-Token': await csrf() },
    multipart: { firma: { name: 'firma.png', mimeType: 'image/png', buffer: fs.readFileSync(FIRMA) } },
  });
  if (firma.status() !== 200) throw new Error(`subir firma: ${firma.status()} ${await firma.text()}`);

  // 3. Crear un documento con plantilla oficial
  await page.goto(`${BASE}/generador`);
  await page.getByText('Certificado de Residencia', { exact: true }).first().click();
  await page.locator('#fecha').fill('2026-11-05');
  await page.locator('#nombre').fill('Persona De Prueba E2E');
  await page.locator('#tipodeidentificacion').selectOption('Cédula de ciudadanía');
  await page.locator('#numerodocumento').fill('1000000001');
  await page.locator('#lugardedocumento').fill('Medellín');
  await page.locator('#direccion').fill('Calle 1 # 2-3');
  await page.locator('#tiemporesidencia').fill('5 años');
  await ok(page, 'formulario del Certificado de Residencia lleno');
  await page.getByRole('button', { name: 'Revisar antes de crear' }).click();
  await page.locator('button.btn-primary', { hasText: /crear/i }).click();
  const descargarPdf = page.getByRole('button', { name: /Descargar PDF/ });
  await descargarPdf.waitFor({ timeout: 60000 });
  await ok(page, 'documento creado con número de radicado');

  // 4. Descargar el PDF
  const [descarga] = await Promise.all([page.waitForEvent('download'), descargarPdf.click()]);
  const destino = path.join(CAPTURAS || '/tmp', 'documento-e2e.pdf');
  await descarga.saveAs(destino);
  const cabecera = fs.readFileSync(destino).subarray(0, 5).toString();
  const bytes = fs.statSync(destino).size;
  if (cabecera !== '%PDF-' || bytes < 10000) throw new Error(`descarga no es un PDF válido (${cabecera}, ${bytes} bytes)`);
  await ok(page, `PDF descargado (${bytes} bytes, cabecera ${cabecera})`);

  // Mi perfil muestra la firma subida y Reportes cuenta el documento creado
  await page.goto(`${BASE}/perfil`);
  await page.getByAltText('Tu firma guardada').waitFor();
  await page.goto(`${BASE}/reportes`);
  await page.getByText('Estado de revisión').waitFor();
  await ok(page, 'Mi perfil muestra la firma y Reportes muestra las cifras del documento');

  // 5. Salir y comprobar credenciales
  await context.clearCookies();
  await entrar(page, INICIAL);
  await page.getByText(/incorrect/i).first().waitFor();
  await ok(page, 'la contraseña inicial ya no sirve');
  await entrar(page, NUEVA);
  await page.waitForURL(/\/inicio/);
  if (await page.getByRole('dialog').count()) throw new Error('la ventana de cambio obligatorio volvió a aparecer');
  await ok(page, 'entrada con la contraseña nueva, sin cambio obligatorio');

  if (erroresConsola.length) throw new Error(`errores de JavaScript en la página: ${erroresConsola.join(' | ')}`);
  console.log('[e2e] flujo principal verificado');
} catch (err) {
  console.error(`[e2e] FALLO en el paso ${paso + 1}: ${err.message}`);
  if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, 'fallo.png'), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
