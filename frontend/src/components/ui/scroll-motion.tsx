'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsap';
import { cn } from '@/lib/utils';

/**
 * Révélation au scroll (fondu + translation) via IntersectionObserver natif —
 * robuste (le contenu reste visible si JS tarde) et sans dépendance lourde.
 * `stagger` (en ms) décale l'apparition des enfants directs en cascade.
 * Neutralisé par la règle globale prefers-reduced-motion de globals.css.
 */
export function ScrollReveal({
  children,
  className,
  as: Tag = 'div',
  stagger,
  threshold = 0.15,
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** délai entre enfants, en ms */
  stagger?: number;
  threshold?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    // Filet de sécurité : si l'observer ne s'est jamais déclenché (onglet
    // masqué au chargement, calcul d'intersection retardé…), on révèle quand
    // même après un court délai — le contenu ne doit jamais rester invisible.
    const fallback = window.setTimeout(() => setShown(true), 1400);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [threshold]);

  if (stagger) {
    return (
      <Tag ref={ref} className={className} data-shown={shown}>
        {Array.isArray(children)
          ? children.map((child, i) => (
              <div
                key={i}
                className="h-full transition-all duration-700 ease-out data-[on=false]:translate-y-6 data-[on=false]:opacity-0"
                data-on={shown}
                style={{ transitionDelay: shown ? `${i * stagger}ms` : '0ms' }}
              >
                {child}
              </div>
            ))
          : children}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Parallaxe verticale douce au scroll (scrub GSAP). `speed` négatif = monte
 * plus vite que la page. Statique sous prefers-reduced-motion.
 */
export function Parallax({
  children,
  className,
  speed = -60,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let killed = false;

    import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
      if (killed) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        gsap.to(el, {
          y: speed,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        });
      }, el);
      // stocke pour cleanup
      (el as HTMLElement & { _pCtx?: gsap.Context })._pCtx = ctx;
    });

    return () => {
      killed = true;
      (el as HTMLElement & { _pCtx?: gsap.Context })._pCtx?.revert();
    };
  }, [speed]);

  return <div ref={ref} className={cn('will-change-transform', className)}>{children}</div>;
}
