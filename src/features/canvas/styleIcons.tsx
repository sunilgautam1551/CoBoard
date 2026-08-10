// Small inline SVG icons for the style panel — kept as plain functions
// (not full components) since they're purely decorative glyphs picked
// by label/value, never independently re-rendered.

/** Single horizontal line whose thickness previews a stroke-width option. */
export function StrokeWidthIcon({ weight }: { weight: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" />
    </svg>
  );
}

/** Horizontal line previewing solid/dashed/dotted via an optional SVG dash pattern. */
export function StrokeStyleIcon({ dash }: { dash?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <line
        x1="2"
        y1="8"
        x2="14"
        y2="8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  );
}

/** Wavy line whose curve height previews a "sloppiness"/roughness preset. */
export function SloppinessIcon({ amplitude }: { amplitude: number }) {
  const d = `M1,8 Q4,${8 - amplitude} 8,8 T15,8`;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Square with either sharp or rounded corners, previewing the edges option. */
export function EdgesIcon({ round }: { round: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="12"
        height="12"
        rx={round ? 4 : 0}
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

/** Square filled solid, or hatched/cross-hatched, previewing a fill-style option. */
export function FillStyleIcon({ style }: { style: 'hachure' | 'cross-hatch' | 'solid' }) {
  if (style === 'solid') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="currentColor" />
      </svg>
    );
  }
  const lines = [3, 7, 11];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1" fill="none" />
      {lines.map((n) => (
        <line key={n} x1={n - 4 < 1 ? 1 : n - 4} y1={n + 4 > 15 ? 15 : n + 4} x2={n + 4 > 15 ? 15 : n + 4} y2={n - 4 < 1 ? 1 : n - 4} stroke="currentColor" strokeWidth="1" />
      ))}
      {style === 'cross-hatch' &&
        lines.map((n) => (
          <line key={`x${n}`} x1={n - 4 < 1 ? 1 : n - 4} y1={n - 4 < 1 ? 1 : n - 4} x2={n + 4 > 15 ? 15 : n + 4} y2={n + 4 > 15 ? 15 : n + 4} stroke="currentColor" strokeWidth="1" />
        ))}
    </svg>
  );
}

/** Three ragged lines aligned left/center/right, previewing a text-align option. */
export function TextAlignIcon({ align }: { align: 'left' | 'center' | 'right' }) {
  const widths = [10, 7, 12];
  const xFor = (w: number) => (align === 'left' ? 2 : align === 'center' ? 8 - w / 2 : 14 - w);
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {[3, 8, 13].map((y, i) => (
        <line key={y} x1={xFor(widths[i])} y1={y} x2={xFor(widths[i]) + widths[i]} y2={y} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/** Two overlapping squares indicating "bring to front" or "send to back". */
export function LayerIcon({ variant }: { variant: 'front' | 'back' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x={variant === 'front' ? 5 : 2} y={variant === 'front' ? 5 : 2} width="9" height="9" rx="1.5" fill="currentColor" opacity="0.35" />
      <rect x={variant === 'front' ? 2 : 5} y={variant === 'front' ? 2 : 5} width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

/** Two overlapping squares with an open corner — the "duplicate" action icon. */
export function DuplicateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M3 11V3a1 1 0 0 1 1-1h8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Trash-can glyph — the "delete" action icon. */
export function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Short line ending in the given arrowhead marker — previews a start/end arrowhead option. */
export function ArrowheadIcon({ style }: { style: 'none' | 'triangle' | 'triangle_outline' | 'bar' | 'dot' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <line x1="1" y1="8" x2={style === 'none' ? 14 : 10} y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {style === 'triangle' && <path d="M15 8 L9.5 5.3 L9.5 10.7 Z" fill="currentColor" />}
      {style === 'triangle_outline' && (
        <path d="M15 8 L9.5 5.3 L9.5 10.7 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      )}
      {style === 'bar' && <line x1="11" y1="4.5" x2="11" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
      {style === 'dot' && <circle cx="12.5" cy="8" r="2.5" fill="currentColor" />}
    </svg>
  );
}
