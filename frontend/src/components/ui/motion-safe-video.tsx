'use client';

import { useEffect, useRef, useState } from 'react';

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
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  // Relance explicite : certains navigateurs (Safari iOS notamment, ou un
  // onglet momentanément en arrière-plan au montage) ne déclenchent pas
  // l'autoplay `muted` tout seuls. `playsInline` évite le passage en
  // plein écran sur iOS qui bloquerait la lecture inline.
  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const tryPlay = () => el.play().catch(() => undefined);
    tryPlay();
    document.addEventListener('visibilitychange', tryPlay);
    return () => document.removeEventListener('visibilitychange', tryPlay);
  }, [reducedMotion]);

  return reducedMotion ? (
    <video
      ref={ref}
      {...props}
      autoPlay={false}
      loop={false}
      playsInline
      controls={showControlsOnReducedMotion}
      preload="metadata"
    />
  ) : (
    <video ref={ref} {...props} autoPlay loop muted playsInline preload="auto" />
  );
}
