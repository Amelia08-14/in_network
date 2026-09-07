'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Enregistrement unique du plugin ScrollTrigger pour toute l'app (les modules
// ES sont mis en cache : ce fichier n'exécute `registerPlugin` qu'une fois).
// Motion "léger" : révélations et parallaxe discrètes, jamais de scène lourde.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export { gsap, ScrollTrigger };
