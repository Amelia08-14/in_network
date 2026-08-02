import { cn } from '@/lib/utils';

// Élément signature IN NETWORK : un graphe de nœuds reliés par des liens fins,
// qui incarne littéralement "le réseau" plutôt qu'une décoration abstraite.
// Trois variantes (densité/orientation différentes) pour que le motif reste
// reconnaissable sans être un copier-coller identique à chaque usage
// (Hero, bandeau CTA, footer, section galerie...).
type NodeDef = { x: number; y: number; r: number; hub: boolean };

const VARIANTS: Record<'default' | 'dense' | 'sparse', { nodes: NodeDef[]; edges: Array<[number, number]> }> = {
  default: {
    nodes: [
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
    ],
    edges: [
      [0, 1], [0, 2], [1, 4], [2, 4], [2, 5], [3, 4], [4, 5], [4, 7], [4, 8],
      [5, 6], [6, 9], [7, 8], [7, 12], [8, 9], [9, 10], [9, 11], [10, 12], [10, 13], [12, 13],
    ],
  },
  dense: {
    nodes: [
      { x: 30, y: 60, r: 3, hub: false },
      { x: 110, y: 30, r: 3, hub: false },
      { x: 60, y: 150, r: 5.5, hub: true },
      { x: 150, y: 110, r: 3, hub: false },
      { x: 180, y: 220, r: 3, hub: false },
      { x: 100, y: 260, r: 3.5, hub: false },
      { x: 260, y: 60, r: 3, hub: false },
      { x: 300, y: 160, r: 6, hub: true },
      { x: 240, y: 250, r: 3, hub: false },
      { x: 340, y: 260, r: 3, hub: false },
      { x: 400, y: 100, r: 3, hub: false },
      { x: 430, y: 210, r: 5, hub: true },
      { x: 500, y: 60, r: 3, hub: false },
      { x: 520, y: 180, r: 3.5, hub: false },
      { x: 480, y: 300, r: 3, hub: false },
      { x: 560, y: 260, r: 3, hub: false },
    ],
    edges: [
      [0, 1], [0, 2], [1, 3], [2, 3], [2, 5], [3, 4], [4, 5], [3, 6], [3, 7],
      [4, 7], [4, 8], [7, 8], [7, 9], [7, 10], [7, 11], [8, 9], [9, 11],
      [10, 11], [10, 12], [11, 13], [11, 14], [12, 13], [13, 14], [13, 15], [14, 15],
    ],
  },
  sparse: {
    nodes: [
      { x: 50, y: 100, r: 3.5, hub: false },
      { x: 150, y: 60, r: 3, hub: false },
      { x: 220, y: 180, r: 6, hub: true },
      { x: 130, y: 260, r: 3, hub: false },
      { x: 320, y: 90, r: 3, hub: false },
      { x: 400, y: 220, r: 5, hub: true },
      { x: 480, y: 120, r: 3, hub: false },
      { x: 540, y: 260, r: 3.5, hub: false },
    ],
    edges: [
      [0, 1], [0, 3], [1, 2], [2, 3], [2, 4], [4, 5], [2, 5], [5, 6], [5, 7], [6, 7],
    ],
  },
};

export function NetworkMotif({
  className,
  tone = 'ink',
  variant = 'default',
}: {
  className?: string;
  tone?: 'ink' | 'white';
  variant?: 'default' | 'dense' | 'sparse';
}) {
  const lineClass = tone === 'white' ? 'stroke-white/20' : 'stroke-ink-900/10';
  const dotClass = tone === 'white' ? 'fill-white/50' : 'fill-ink-900/25';
  const hubClass = tone === 'white' ? 'fill-brand-orange/70' : 'fill-brand-orange/80';
  const { nodes, edges } = VARIANTS[variant];

  return (
    <svg
      aria-hidden
      viewBox="0 0 600 420"
      fill="none"
      className={cn('pointer-events-none select-none', className)}
    >
      <g strokeWidth="1" className={lineClass}>
        {edges.map(([a, b]) => {
          const p1 = nodes[a];
          const p2 = nodes[b];
          return <line key={`${a}-${b}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
        })}
      </g>
      <g>
        {nodes.map((n, i) => (
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
