/** @type {import('tailwindcss').Config} */

// Los colores salen de las variables CSS de src/styles/tokens.css.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

// Escala verde institucional. `jal.blue` es un alias heredado: las pantallas antiguas usan
// `jal-blue-*` y ahora pintan en la misma escala que `brand-*`. Para código nuevo, usar `brand`.
const verde = {
  50: '#EEF3F0',
  100: '#DCE7E1',
  200: '#B9CEC3',
  300: '#8FAF9F',
  400: '#3F6B5D',
  500: '#264F47',
  600: '#193B35',
  700: '#12302A',
  800: '#0D2520',
  900: '#081A16',
};

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        sunken: token('surface-sunken'),
        ink: { DEFAULT: token('ink'), muted: token('ink-muted') },
        line: { DEFAULT: token('line'), strong: token('line-strong'), control: token('control-border') },
        brand: { DEFAULT: token('brand'), hover: token('brand-hover'), tint: token('brand-tint'), ...verde },
        accent: {
          DEFAULT: token('accent'),
          tint: token('accent-tint'),
          50: '#FAF0EC', 100: '#F3DED6', 200: '#E6BCAE', 400: '#B5604D', 500: '#9B4133', 600: '#84362A', 700: '#6B2B22',
        },
        success: { DEFAULT: token('success'), bg: token('success-bg'), fg: token('success-fg'), border: token('success-border') },
        warning: { DEFAULT: token('warning'), bg: token('warning-bg'), fg: token('warning-fg'), border: token('warning-border') },
        danger:  { DEFAULT: token('danger'),  bg: token('danger-bg'),  fg: token('danger-fg'),  border: token('danger-border') },
        info:    { DEFAULT: token('info'),    bg: token('info-bg'),    fg: token('info-fg'),    border: token('info-border') },
        // Gris cálido: reemplaza el gris frío de Tailwind en todas las pantallas.
        // 400 es el primer tono apto para texto (4.8:1 sobre blanco); 300 y menores, solo líneas y fondos.
        gray: {
          50: '#FAF8F3', 100: '#F1EDE4', 200: '#E3DED2', 300: '#CFC9BB', 400: '#6B746F',
          500: '#5B6560', 600: '#4A534F', 700: '#38403C', 800: '#2A322E', 900: '#222A27',
        },
        jal: {
          blue: verde,
          gold: { 50: '#FAF0EC', 100: '#F3DED6', 500: '#9B4133', 600: '#84362A', 700: '#6B2B22' },
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        serif: ['var(--font-serif)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        eyebrow: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.08em', fontWeight: '700' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        tab: 'var(--radius-tab)',
      },
      boxShadow: {
        card: 'none',
        sheet: 'var(--shadow-sheet)',
        float: 'var(--shadow-float)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        drawer: 'var(--ease-drawer)',
      },
      transitionDuration: {
        press: 'var(--dur-press)',
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
      },
      maxWidth: {
        prose: '68ch',
        page: '72rem',
      },
    },
  },
  plugins: [],
};
