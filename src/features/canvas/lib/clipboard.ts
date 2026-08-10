import type { Element } from '@/types';

// Plain in-memory (not OS) clipboard — copy/paste only needs to round-trip
// within this app, and skipping the browser Clipboard API sidesteps its
// permission prompts and async-only reads.
let clipboard: Element[] = [];

export function setClipboard(elements: Element[]) {
  clipboard = elements;
}

export function getClipboard(): Element[] {
  return clipboard;
}
