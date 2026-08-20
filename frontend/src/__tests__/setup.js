import '@testing-library/jest-dom';

// Setup global para jsdom: simular navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  configurable: true,
  value: true,
});
