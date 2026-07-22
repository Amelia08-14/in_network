import { cn } from '@/lib/utils';

// Élément signature IN NETWORK : un graphe de nœuds reliés par des liens fins,
// qui incarne littéralement "le réseau" plutôt qu'une décoration abstraite.
// Utilisé à deux endroits seulement (Hero + bandeau CTA sombre) — un signature,
// pas une texture répétée partout.
const NODES = [
  { x: 40, y: 210, r: 3.5, hub: false },
  { x: 96, y: 96, r: 3, hub: false },
  { x: 88, y: 320, r: 3, hub: false },
  { x: 190, y: 40, r: 3, hub: false },
  { x: 210, y: 190, r: 6, hub: true },
  { x: 200, y: 300, r: 3, hub: false },
  { x: 240, y: 390, r: 3.5, hub: false },
  { x: 330, y: 100, r: 3, hub: false },
  { x: 350, y: 210, r: 3, hub: false },
  { x: 400, y: 300, r: 5, hub: true },
  { x: 470, y: 240, r: 3, hub: false },
  { x: 460, y: 350, r: 3, hub: false },
  { x: 500, y: 130, r: 3, hub: false },
  { x: 560, y: 190, r: 4, hub: false },
] as const;

const EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [1, 4],
  [2, 4],
  [2, 5],
  [3, 4],
  [4, 5],
  [4, 7],
  [4, 8],
  [5, 6],
  [6, 9],
  [7, 8],
  [7, 12],
  [8, 9],
  [9, 10],
  [9, 11],
  [10, 12],
  [10, 13],
  [12, 13],
];

export function NetworkMotif({
  className,
  tone = 'ink',
}: {
  className?: string;
  tone?: 'ink' | 'white';
}) {
  const lineClass = tone === 'white' ? 'stroke-white/20' : 'stroke-ink-900/10';
  const dotClass = tone === 'white' ? 'fill-white/50' : 'fill-ink-900/25';
  const hubClass = tone === 'white' ? 'fill-brand-orange/70' : 'fill-brand-orange/80';

  return (
    <svg
      aria-hidden
      viewBox="0 0 600 420"
      fill="none"
      className={cn('pointer-events-none select-none', className)}
    >
      <g strokeWidth="1" className={lineClass}>
        {EDGES.map(([a, b]) => {
          const p1 = NODES[a];
          const p2 = NODES[b];
          return <line key={`${a}-${b}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
        })}
      </g>
      <g>
        {NODES.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.r}
            className={cn(n.hub ? hubClass : dotClass, n.hub && 'motion-safe:animate-pulse')}
            style={n.hub ? { animationDelay: `${i * 250}ms`, transformOrigin: `${n.x}px ${n.y}px` } : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
