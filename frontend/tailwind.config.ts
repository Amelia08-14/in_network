import type { Config } from 'tailwindcss';

// Charte IN NETWORK — cf. Brand Guideline + CDC Technique §3.2-3.4
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Direction "Corporate épuré" — l'identité repose désormais sur un
        // navy sobre + un accent orange rare. Les tokens `brand-*` sont
        // repointés vers cette palette pour que tout le site bascule sans
        // édition page par page (le logo garde ses couleurs propres).
        brand: {
          violet: '#334155', // ancien accent violet → ardoise neutre (slate-700)
          orange: '#D44835', // accent unique (CTA, highlights rares)
          blue: '#1D4ED8', // liens / accent froid corporate
          'violet-dark': '#0F1B2E', // surface sombre & texte titres → navy profond
          paper: '#F5F0EB', // fond global premium minimaliste — beige chaud clair
          'paper-deep': '#ECE3D6', // variante plus soutenue pour l'alternance de sections
        },
        // Échelle d'encre navy pour le nouveau système
        ink: {
          DEFAULT: '#0F1B2E',
          900: '#0F1B2E',
          800: '#1B2A41',
          700: '#2B3B54',
          600: '#475569',
          500: '#64748B',
        },
        accent: {
          green: { light: '#C0D5A9', DEFAULT: '#73B866' },
          yellow: '#FFC25A',
          gray: '#64748B',
        },
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: [
          'var(--font-body)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '1rem',
        pill: '9999px',
      },
      spacing: {
        'section-desktop': '4rem', // py-16
        'section-mobile': '2.5rem', // py-10
      },
      boxShadow: {
        // Ombres "premium" — diffuses et teintées navy plutôt que noir pur,
        // pour un rendu corporate plus doux qu'un shadow-md générique.
        soft: '0 1px 2px rgba(15, 27, 46, 0.04), 0 6px 20px -6px rgba(15, 27, 46, 0.10)',
        'soft-lg': '0 4px 10px rgba(15, 27, 46, 0.04), 0 16px 40px -12px rgba(15, 27, 46, 0.16)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-in-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
