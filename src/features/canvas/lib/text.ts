// The app's actual body font (see globals.css) — Konva draws text via a
// canvas 2D context, whose `font` property does NOT resolve CSS custom
// properties (`var(--font-geist-sans)` is invalid there and silently
// rejected, leaving whatever font the canvas last had set). Using the
// same literal, valid font stack here, in the Konva Text props, and in
// the editing textarea keeps size/wrapping identical in all three
// places — previously the mismatch was the root cause of font-size
// changes not visibly taking effect.
export const TEXT_FONT_FAMILY = 'Arial, Helvetica, sans-serif';
export const LINE_HEIGHT_RATIO = 1.25;

export function getLineHeight(fontSize: number): number {
  return fontSize * LINE_HEIGHT_RATIO;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  if (typeof document === 'undefined') {
    measureCtx = null;
    return measureCtx;
  }
  measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

export function measureTextWidth(text: string, fontSize: number): number {
  const ctx = getMeasureContext();
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `${fontSize}px ${TEXT_FONT_FAMILY}`;
  return ctx.measureText(text).width;
}

export function widestLineWidth(text: string, fontSize: number): number {
  const lines = text.length ? text.split('\n') : [''];
  return Math.max(measureTextWidth(' ', fontSize), ...lines.map((l) => measureTextWidth(l, fontSize)));
}

/** Word-wraps `text` (respecting explicit newlines) to fit within `maxWidth` at `fontSize`. */
export function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureTextWidth(candidate, fontSize) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
        current = '';
      }
      if (measureTextWidth(word, fontSize) <= maxWidth) {
        current = word;
        continue;
      }
      // Single word longer than maxWidth on its own: break it by character.
      let chunk = '';
      for (const ch of word) {
        const test = chunk + ch;
        if (measureTextWidth(test, fontSize) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = test;
        }
      }
      current = chunk;
    }
    lines.push(current);
  }
  return lines;
}

export function measureWrappedText(text: string, fontSize: number, maxWidth: number) {
  const lines = wrapText(text, fontSize, maxWidth);
  const lineHeight = getLineHeight(fontSize);
  return { lines, height: Math.max(lineHeight, lines.length * lineHeight), lineHeight };
}
