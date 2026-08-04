'use client';

import { useEffect, useState } from 'react';

// La règle globale prefers-reduced-motion (globals.css) écrase les
// animations/transitions CSS, mais ne peut rien sur l'autoplay natif d'un
// <video> — sans ce composant, les vidéos de couverture/vignettes tournent
// en boucle en continu quel que soit le réglage du visiteur. Ici : lecture
// automatique en boucle seulement si le mouvement est autorisé, sinon
// première image fixe + contrôles natifs pour que le contenu reste
// accessible sur demande.
// showControlsOnReducedMotion: false quand la vidéo est une simple vignette
// cliquable vers un lecteur complet ailleurs (ex. lightbox) — des contrôles
// natifs dans une vignette qui ouvre déjà un lecteur créent un conflit de clic.
export function MotionSafeVideo({
  showControlsOnReducedMotion = true,
  ...props
}: React.VideoHTMLAttributes<HTMLVideoElement> & { showControlsOnReducedMotion?: boolean }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return reducedMotion ? (
    <video {...props} autoPlay={false} loop={false} controls={showControlsOnReducedMotion} preload="metadata" />
  ) : (
    <video {...props} autoPlay loop muted preload="auto" />
  );
}
