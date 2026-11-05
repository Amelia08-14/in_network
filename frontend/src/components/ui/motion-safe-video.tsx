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
// playOn="hover" (vignettes : cartes d'événements, témoignages) : pas de lecture
// automatique ni de préchargement complet — seule la première image est
// chargée, la vidéo démarre au survol. En lecture automatique, chaque vignette
// téléchargeait sa vidéo entière dès l'ouverture de la page (≈ 40 Mo sur
// l'accueil, audit de performance du 05/11/2026).
export function MotionSafeVideo({
  showControlsOnReducedMotion = true,
  playOn = 'auto',
  ...props
}: React.VideoHTMLAttributes<HTMLVideoElement> & { showControlsOnReducedMotion?: boolean; playOn?: 'auto' | 'hover' }) {
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
    if (reducedMotion || playOn === 'hover') return;
    const el = ref.current;
    if (!el) return;
    const tryPlay = () => el.play().catch(() => undefined);
    tryPlay();
    document.addEventListener('visibilitychange', tryPlay);
    return () => document.removeEventListener('visibilitychange', tryPlay);
  }, [reducedMotion]);

  if (playOn === 'hover') {
    return (
      <video
        ref={ref}
        {...props}
        muted
        loop
        playsInline
        preload="metadata"
        onMouseEnter={() => !reducedMotion && ref.current?.play().catch(() => undefined)}
        onMouseLeave={() => ref.current?.pause()}
      />
    );
  }

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
