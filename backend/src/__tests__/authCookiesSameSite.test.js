'use strict';
// Cookies de sesión (auditoría 2026-11-05, P0-3): con HTTPS salían SameSite=None, lo
// que permite que el navegador las adjunte en peticiones iniciadas por otros sitios.
// El frontend llama a la API a través del reenvío de Vercel (mismo origen), así que
// basta Lax. COOKIE_SAMESITE permite volver a None solo si se despliega cross-site.
const { setAuthCookies } = require('../utils/authCookies');

function fakeRes() {
  const cookies = {};
  return { cookies, cookie: (name, _v, opts) => { cookies[name] = opts; } };
}
const httpsReq = { secure: true, headers: {} };

afterEach(() => { delete process.env.COOKIE_SAMESITE; });

describe('setAuthCookies — SameSite', () => {
  it('con HTTPS usa SameSite=Lax por defecto en las tres cookies', () => {
    const res = fakeRes();
    setAuthCookies(httpsReq, res, { accessToken: 'a', refreshToken: 'r' });
    for (const name of ['access_token', 'refresh_token', 'csrf_token']) {
      expect(res.cookies[name].sameSite).toBe('lax');
      expect(res.cookies[name].secure).toBe(true);
    }
  });

  it('sin HTTPS (desarrollo local) usa Strict', () => {
    const res = fakeRes();
    setAuthCookies({ secure: false, headers: {} }, res, { accessToken: 'a', refreshToken: 'r' });
    expect(res.cookies.access_token.sameSite).toBe('strict');
  });

  it('COOKIE_SAMESITE=none se respeta solo con HTTPS', () => {
    process.env.COOKIE_SAMESITE = 'none';
    const res = fakeRes();
    setAuthCookies(httpsReq, res, { accessToken: 'a', refreshToken: 'r' });
    expect(res.cookies.access_token.sameSite).toBe('none');

    const res2 = fakeRes();
    setAuthCookies({ secure: false, headers: {} }, res2, { accessToken: 'a', refreshToken: 'r' });
    expect(res2.cookies.access_token.sameSite).toBe('strict');
  });

  it('un valor inválido de COOKIE_SAMESITE se ignora', () => {
    process.env.COOKIE_SAMESITE = 'cualquiera';
    const res = fakeRes();
    setAuthCookies(httpsReq, res, { accessToken: 'a', refreshToken: 'r' });
    expect(res.cookies.access_token.sameSite).toBe('lax');
  });
});
