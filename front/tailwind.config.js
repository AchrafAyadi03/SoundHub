/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  corePlugins: {
    preflight: false, // coexistence avec styles.css existant pendant la migration
  },
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0F0F0F',
        'bg-surface': '#181818',
        'bg-elevated': '#282828',
        accent: '#6EE7B7',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(110,231,183,0.25), 0 8px 24px rgba(110,231,183,0.30)',
      },
      fontFamily: {
        heading: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        smooth: 'ease-in-out',
      },
      transitionDuration: {
        200: '200ms',
      },
    },
  },
  plugins: [],
};
