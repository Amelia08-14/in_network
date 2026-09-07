'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ReactLenis, type LenisRef } from 'lenis/react';
import { prefersReducedMotion } from '@/lib/gsap';

// Défilement lissé (inertie douce) sur les pages publiques — le scroll devient
// continu au lieu de sauter cran par cran. Lenis pilote sa propre boucle rAF
// (fiable) ; on se contente de rafraîchir GSAP ScrollTrigger à sa cadence pour
// que les révélations/parallaxes suivent la position lissée. Désactivé si
// `prefers-reduced-motion` : scroll natif du navigateur.
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);
  const pathname = usePathname();
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  // Synchro GSAP ScrollTrigger sur les évènements de scroll Lenis.
  useEffect(() => {
    if (reduced !== false) return;
    let detach: (() => void) | undefined;
    let cancelled = false;

    import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
      if (cancelled) return;
      const lenis = lenisRef.current?.lenis;
      if (!lenis) return;
      const update = () => ScrollTrigger.update();
      lenis.on('scroll', update);
      detach = () => lenis.off('scroll', update);
    });

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [reduced]);

  // Retour en haut à chaque changement de page (Lenis ignore le window.scrollTo
  // que fait le routeur Next).
  useEffect(() => {
    lenisRef.current?.lenis?.scrollTo(0, { immediate: true });
  }, [pathname]);

  if (reduced !== false) return <>{children}</>;

  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{
        lerp: 0.09,
        wheelMultiplier: 1,
        smoothWheel: true,
        // Le lissage est agréable à la souris/pavé mais pénible au doigt :
        // sur écran tactile on garde le scroll natif du mobile.
        syncTouch: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}
