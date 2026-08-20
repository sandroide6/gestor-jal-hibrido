/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Colores institucionales JAL Comuna 12 — La América
        jal: {
          blue: {
            50: '#f0f7f1',
            100: '#d4ecda',
            200: '#a9d9b5',
            300: '#7ec590',
            400: '#53b16b',
            500: '#1e6b3a', // verde primario institucional
            600: '#196032',
            700: '#145429',
            800: '#0f4822',
            900: '#0a3c1a',
          },
          gold: {
            50: '#fffbeb',
            100: '#fef3c7',
            200: '#fde68a',
            300: '#fcd34d',
            400: '#fbbf24',
            500: '#d4a017', // dorado institucional
            600: '#b78400',
            700: '#956800',
            800: '#734f00',
            900: '#523800',
          },
          green: {
            500: '#16a34a', // estado: sincronizado
            600: '#15803d',
          },
          red: {
            500: '#dc2626', // estado: error
            600: '#b91c1c',
          },
          amber: {
            500: '#d97706', // estado: pendiente
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(30, 107, 58, 0.1), 0 1px 2px -1px rgba(30, 107, 58, 0.1)',
      },
    },
  },
  plugins: [],
};
