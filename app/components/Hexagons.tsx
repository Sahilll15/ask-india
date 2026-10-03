/** Soft line-hexagon field used as a corner decoration. */
export function Hexagons({ className = '' }: { className?: string }) {
  const r = 26;
  const w = Math.sqrt(3) * r;
  const cells: { x: number; y: number; o: number }[] = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0);
      const y = row * r * 1.5;
      const fade = 1 - (row + col) / 13;
      if (fade > 0.12) cells.push({ x, y, o: fade });
    }
  }
  const hex = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  return (
    <svg viewBox="-30 -30 360 300" className={className} aria-hidden>
      {cells.map((c) => (
        <polygon key={`${c.x}-${c.y}`} points={hex(c.x, c.y)} fill="none" stroke="var(--gold)" strokeWidth="1.4" opacity={c.o} />
      ))}
    </svg>
  );
}
