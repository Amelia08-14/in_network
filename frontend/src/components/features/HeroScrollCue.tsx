'use client';

// Incitation au scroll du hero — beaucoup de visiteurs ne devinent pas que la
// page continue sous la ligne de flottaison (hero plein écran en desktop,
// hero haut en mobile). Repère visible + animé, centré en bas du hero, sur
// desktop comme sur mobile. Cliquable : fait défiler jusqu'à la section
// suivante. `aria-hidden` retiré volontairement — c'est un contrôle utile,
// mais purement complémentaire (le contenu reste accessible au scroll normal).
export function HeroScrollCue() {
  function scrollToContent(event: React.MouseEvent<HTMLButtonElement>) {
    const hero = event.currentTarget.closest('section');
    const next = hero?.nextElementSibling as HTMLElement | null;
    if (next) {
      next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
    }
  }

  return (
    <button
      type="button"
      onClick={scrollToContent}
      aria-label="Faire défiler pour découvrir la suite"
      className="hero-in hero-d3 hero-scroll-cue absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 rounded-full text-ink-500 transition-colors duration-300 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-4 focus-visible:ring-offset-brand-paper md:bottom-8"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.3em]">Défiler</span>
      <span className="relative flex h-10 w-[22px] items-start justify-center rounded-full border border-ink-900/25 p-1.5">
        <span className="hero-scroll-dot h-1.5 w-1.5 rounded-full bg-brand-orange" />
      </span>
    </button>
  );
}
