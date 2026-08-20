// PT-16: Utilidades — formatDate, formatDateTime, formatDateLong
import { formatDate, formatDateTime, formatDateLong } from '../utils/format';

describe('formatDate', () => {
  it('formatea una fecha ISO válida', () => {
    const result = formatDate('2026-05-14T00:00:00.000Z');
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('devuelve "—" para null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('devuelve "—" para string vacío', () => {
    expect(formatDate('')).toBe('—');
  });

  it('devuelve "—" para fecha inválida', () => {
    expect(formatDate('no-es-fecha')).toBe('—');
  });

  it('acepta opciones de formato personalizadas', () => {
    const result = formatDate('2026-06-15', { year: 'numeric' });
    expect(result).toContain('2026');
  });
});

describe('formatDateTime', () => {
  it('formatea fecha y hora', () => {
    const result = formatDateTime('2026-05-14T15:30:00.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(5);
  });

  it('devuelve "—" para null', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('devuelve "—" para fecha inválida', () => {
    expect(formatDateTime('invalido')).toBe('—');
  });
});

describe('formatDateLong', () => {
  it('formatea fecha en formato largo', () => {
    const result = formatDateLong('2026-05-14T00:00:00.000Z');
    expect(result).toMatch(/2026/);
  });

  it('devuelve "—" para undefined', () => {
    expect(formatDateLong(undefined)).toBe('—');
  });
});
