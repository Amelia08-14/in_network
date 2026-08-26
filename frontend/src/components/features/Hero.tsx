'use client';

import Link from 'next/link';

const cities = [
  { name: 'Alger', x: 310, y: 86 },
  { name: 'Oran', x: 120, y: 185 },
  { name: 'Constantine', x: 500, y: 175 },
  { name: 'Sétif', x: 455, y: 300 },
  { name: 'Ouargla', x: 330, y: 430 },
  { name: 'Annaba', x: 535, y: 95 },
  { name: 'Tlemcen', x: 95, y: 325 },
];

// V4 — nouvelle direction fournie directement par la cliente (code complet),
// registre plus doux/chaleureux qu'un simple fond navy : diagramme réseau
// schématique (pas une carte géographique précise, un diagramme de villes)
// dans un panneau "verre dépoli", fond clair. Choix explicite de la cliente
// suite à un point de friction avec le retour antérieur "le 100% clair c'est
// pas assez moderne" : ici on assume le fond clair pour le Hero et on garde
// la touche sombre structurelle uniquement sur la section témoignages plus
// bas sur la page.
//
// Retiré du code fourni : la ligne de stats "180+ Membres / 48 Wilayas / 12
// Secteurs" — vérifié en base, il y a réellement 3 membres (pas 180+) et
// l'Algérie compte 58 wilayas depuis 2019 (pas 48). Choix cliente : pas de
// chiffre de taille de réseau tant que ce n'est pas flatteur.
//
// La bascule à deux colonnes n'arrive qu'à `lg` (1024px) et pas avant :
// à `md` (768px) la colonne de texte ne fait que ~336px, trop étroite pour
// un H1 aussi grand (bug de mise en page déjà rencontré une fois ici).
export function Hero() {
  return (
    <section className="relative isolate -mt-24 min-h-screen overflow-hidden bg-brand-paper md:-mt-28">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15,27,46,0.08) 1px, transparent 0)',
          backgroundSize: '34px 34px',
        }}
      />
      <div aria-hidden="true" className="absolute -left-40 top-32 h-[440px] w-[440px] rounded-full bg-brand-orange/5 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-40 bottom-0 h-[520px] w-[520px] rounded-full bg-ink-900/5 blur-3xl" />

      <div className="relative mx-auto grid min-h-screen max-w-[1380px] grid-cols-1 items-center gap-14 px-6 pb-20 pt-32 md:pt-40 lg:grid-cols-[0.95fr_1.05fr] lg:px-12">
        <div className="max-w-[650px]">
          <div className="hero-reveal flex items-center gap-3">
            <span className="h-px w-9 bg-brand-orange" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-600">
              Le réseau entrepreneurial algérien
            </p>
          </div>

          <h1 className="hero-reveal hero-delay-1 mt-7 font-heading text-[clamp(2.25rem,3.6vw,3.75rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink-900">
            Les bonnes
            <br />
            connexions font
            <br />
            avancer les
            <br />
            <span className="text-brand-orange">bonnes entreprises.</span>
          </h1>

          <p className="hero-reveal hero-delay-2 mt-8 max-w-[560px] text-base leading-8 text-ink-600 md:text-lg">
            IN NETWORK réunit entrepreneurs, experts, partenaires et opportunités professionnelles au sein
            d&apos;un réseau structuré, accessible et ancré en Algérie.
          </p>

          <div className="hero-reveal hero-delay-3 mt-9 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-brand-orange px-8 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-brand-orange/90 hover:shadow-[0_18px_40px_rgba(212,72,53,0.22)]"
            >
              Rejoindre le réseau
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/annuaire"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-ink-900/15 bg-white/50 px-8 text-sm font-semibold text-ink-900 transition duration-300 hover:border-ink-900 hover:bg-white"
            >
              Explorer l&apos;annuaire
            </Link>
          </div>
        </div>

        <div className="hero-reveal hero-delay-2 relative mx-auto w-full max-w-[720px]">
          <div className="relative overflow-hidden rounded-[40px] border border-white/80 bg-white/55 p-4 shadow-soft-lg backdrop-blur-xl md:p-8">
            <div className="absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-brand-orange/50 to-transparent" />

            <div className="mb-3 flex items-center justify-between px-3 pt-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">Réseau actif</p>
                <p className="mt-1 text-sm font-medium text-ink-900">Connexions à travers l&apos;Algérie</p>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-ink-900/10 bg-white px-3 py-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-40" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-green" />
                </span>
                <span className="text-xs font-medium text-ink-600">En ligne</span>
              </div>
            </div>

            <svg
              viewBox="0 0 620 520"
              className="h-auto w-full"
              role="img"
              aria-label="Réseau entrepreneurial reliant plusieurs villes algériennes"
            >
              <defs>
                <radialGradient id="hubGradient">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#F5F0EB" />
                </radialGradient>
                <filter id="softShadow">
                  <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#0F1B2E" floodOpacity="0.12" />
                </filter>
              </defs>

              <circle cx="310" cy="260" r="202" fill="none" stroke="#D8DEE4" strokeWidth="1" strokeDasharray="4 11" />
              <circle cx="310" cy="260" r="145" fill="none" stroke="#E3E7EB" strokeWidth="1" />

              {cities.map((city, index) => (
                <line
                  key={`line-${city.name}`}
                  x1="310"
                  y1="260"
                  x2={city.x}
                  y2={city.y}
                  className="network-line"
                  style={{ animationDelay: `${index * 180}ms` }}
                />
              ))}

              <line x1="120" y1="185" x2="95" y2="325" className="network-line secondary-line" />
              <line x1="500" y1="175" x2="535" y2="95" className="network-line secondary-line" />
              <line x1="500" y1="175" x2="455" y2="300" className="network-line secondary-line" />
              <line x1="455" y1="300" x2="330" y2="430" className="network-line secondary-line" />

              <g className="network-hub" filter="url(#softShadow)">
                <circle cx="310" cy="260" r="77" fill="url(#hubGradient)" stroke="#FFFFFF" strokeWidth="4" />
                <circle cx="310" cy="260" r="58" fill="#0F1B2E" />
                <text x="310" y="248" textAnchor="middle" className="fill-white text-[15px] font-bold tracking-wide">
                  IN
                </text>
                <text x="310" y="265" textAnchor="middle" className="fill-white text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Network
                </text>
                <text x="310" y="284" textAnchor="middle" className="fill-brand-orange text-[13px] font-bold">
                  DZ
                </text>
              </g>

              {cities.map((city, index) => (
                <g key={city.name} className="network-node" style={{ animationDelay: `${index * 240}ms` }}>
                  <circle cx={city.x} cy={city.y} r="22" fill="#FFFFFF" stroke="#D8DEE4" strokeWidth="1.5" />
                  <circle cx={city.x} cy={city.y} r="7" fill={index % 3 === 0 ? '#D44835' : '#0F1B2E'} />
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r="12"
                    fill="none"
                    stroke={index % 3 === 0 ? '#D44835' : '#0F1B2E'}
                    strokeOpacity="0.18"
                    className="node-ring"
                  />
                  <text x={city.x} y={city.y + 40} textAnchor="middle" className="fill-ink-600 text-[13px] font-semibold">
                    {city.name}
                  </text>
                </g>
              ))}

              <circle r="4" fill="#D44835" className="network-particle">
                <animateMotion dur="4.8s" repeatCount="indefinite" path="M310 260 L120 185" />
              </circle>
              <circle r="3.5" fill="#0F1B2E" className="network-particle">
                <animateMotion dur="5.5s" begin="1.2s" repeatCount="indefinite" path="M310 260 L500 175" />
              </circle>
              <circle r="3.5" fill="#D44835" className="network-particle">
                <animateMotion dur="6s" begin="2s" repeatCount="indefinite" path="M310 260 L330 430" />
              </circle>
            </svg>

            <div className="grid grid-cols-3 gap-2 border-t border-ink-900/6 pt-5">
              <NetworkType value="Entreprises" />
              <NetworkType value="Experts" />
              <NetworkType value="Partenaires" />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero-reveal {
          opacity: 0;
          transform: translateY(22px);
          animation: reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .hero-delay-1 {
          animation-delay: 100ms;
        }
        .hero-delay-2 {
          animation-delay: 200ms;
        }
        .hero-delay-3 {
          animation-delay: 300ms;
        }

        :global(.network-line) {
          stroke: #bcc5cd;
          stroke-width: 1.5;
          stroke-dasharray: 7 9;
          stroke-linecap: round;
          animation: line-flow 9s linear infinite;
        }
        :global(.secondary-line) {
          stroke: #d5dbe0;
          stroke-width: 1;
        }
        :global(.network-node) {
          transform-origin: center;
          animation: node-float 5s ease-in-out infinite;
        }
        :global(.network-hub) {
          transform-origin: 310px 260px;
          animation: hub-float 5.5s ease-in-out infinite;
        }
        :global(.node-ring) {
          transform-box: fill-box;
          transform-origin: center;
          animation: node-pulse 2.6s ease-out infinite;
        }
        :global(.network-particle) {
          filter: drop-shadow(0 0 5px rgba(212, 72, 53, 0.35));
        }

        @keyframes reveal {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes line-flow {
          to {
            stroke-dashoffset: -96;
          }
        }
        @keyframes node-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes hub-float {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-4px) scale(1.015);
          }
        }
        @keyframes node-pulse {
          0% {
            opacity: 0.45;
            transform: scale(0.75);
          }
          80%,
          100% {
            opacity: 0;
            transform: scale(1.8);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-reveal,
          :global(.network-line),
          :global(.network-node),
          :global(.network-hub),
          :global(.node-ring) {
            animation: none;
            opacity: 1;
            transform: none;
          }
          :global(.network-particle) {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}

function NetworkType({ value }: { value: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-full bg-brand-paper px-3 py-3">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
      <span className="truncate text-[11px] font-semibold text-ink-600 sm:text-xs">{value}</span>
    </div>
  );
}
