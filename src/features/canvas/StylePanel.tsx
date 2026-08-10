'use client';

import { useBoardStore, type Style } from '@/store/useBoardStore';
import { useSyncStore } from '@/features/sync/useSyncStore';
import type { ElementType, Tool } from '@/types';
import { ROUGHNESS_PRESETS } from './lib/rough';
import { findBoundText } from './lib/boundText';
import {
  duplicateSelectionAndBroadcast,
  deleteSelectionAndBroadcast,
  reorderSelectionAndBroadcast,
} from './lib/elementActions';
import {
  StrokeWidthIcon,
  StrokeStyleIcon,
  SloppinessIcon,
  EdgesIcon,
  FillStyleIcon,
  TextAlignIcon,
  LayerIcon,
  DuplicateIcon,
  TrashIcon,
} from './styleIcons';

const STROKE_SWATCHES = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
const BG_SWATCHES = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];
const STROKE_WIDTHS: { label: string; value: number; weight: number }[] = [
  { label: 'Thin', value: 2, weight: 1.5 },
  { label: 'Bold', value: 4, weight: 3 },
  { label: 'Extra bold', value: 8, weight: 5 },
];
const STROKE_STYLES: { label: string; value: Style['strokeStyle']; dash?: string }[] = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed', dash: '5,4' },
  { label: 'Dotted', value: 'dotted', dash: '1.5,4' },
];
const SLOPPINESS: { label: string; value: number; amplitude: number }[] = [
  { label: 'Architect', value: ROUGHNESS_PRESETS.architect, amplitude: 1.5 },
  { label: 'Artist', value: ROUGHNESS_PRESETS.artist, amplitude: 3 },
  { label: 'Cartoonist', value: ROUGHNESS_PRESETS.cartoonist, amplitude: 5 },
];
const FILL_STYLES: { label: string; value: Style['fillStyle'] }[] = [
  { label: 'Hachure', value: 'hachure' },
  { label: 'Cross-hatch', value: 'cross-hatch' },
  { label: 'Solid', value: 'solid' },
];
const TEXT_ALIGNS: { label: string; value: Style['textAlign'] }[] = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
];
const FONT_SIZES: { label: string; value: number }[] = [
  { label: 'S', value: 16 },
  { label: 'M', value: 20 },
  { label: 'L', value: 28 },
  { label: 'XL', value: 36 },
];

const FILL_TYPES: (ElementType | Tool)[] = ['rect', 'diamond', 'ellipse', 'pen', 'path'];
const SHAPE_TYPES: (ElementType | Tool)[] = ['rect', 'diamond', 'ellipse'];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-neutral-500">{label}</span>
      {children}
    </div>
  );
}

function IconButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
        active
          ? 'border-violet-300 bg-violet-100 text-violet-700'
          : 'border-transparent text-neutral-500 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  );
}

export function StylePanel() {
  const tool = useBoardStore((s) => s.tool);
  const style = useBoardStore((s) => s.style);
  const setStyle = useBoardStore((s) => s.setStyle);
  const applyStyleToSelection = useBoardStore((s) => s.applyStyleToSelection);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const elements = useBoardStore((s) => s.elements);
  const recentColors = useBoardStore((s) => s.recentColors);
  const addRecentColor = useBoardStore((s) => s.addRecentColor);

  const firstSelected = selectedIds.length > 0 ? elements[selectedIds[0]] : null;
  const primaryType: ElementType | Tool = firstSelected?.type ?? tool;

  const visible =
    selectedIds.length > 0 ||
    ['pen', 'rect', 'diamond', 'ellipse', 'line', 'arrow', 'text'].includes(tool);
  if (!visible) return null;

  const boundText = firstSelected ? findBoundText(elements, firstSelected.id) : undefined;
  const isStandaloneText = primaryType === 'text';
  const isLineArrow = primaryType === 'line' || primaryType === 'arrow';
  const isShape = SHAPE_TYPES.includes(primaryType);

  const showBackground = FILL_TYPES.includes(primaryType);
  const activeFill = firstSelected?.fill ?? style.fill;
  const showFillStyle = isShape && activeFill !== 'transparent';
  const showStrokeWidth = !isStandaloneText;
  const showStrokeStyle = isShape || isLineArrow;
  const showSloppiness = isShape || isLineArrow;
  const showEdges = primaryType === 'rect' || primaryType === 'diamond';
  // A selected container with a bound label also gets font-size/align
  // controls for that label, on top of its own shape-styling sections.
  const showTextControls = isStandaloneText || !!boundText;
  const showOpacity = true;
  const showLayers = selectedIds.length > 0;
  const showActions = selectedIds.length > 0;

  const activeStroke = firstSelected?.stroke ?? style.stroke;
  const activeStrokeWidth = firstSelected?.strokeWidth ?? style.strokeWidth;
  const activeStrokeStyle = firstSelected?.strokeStyle ?? style.strokeStyle;
  const activeRoughness = firstSelected?.roughness ?? style.roughness;
  const activeFillStyle = firstSelected?.fillStyle ?? style.fillStyle;
  const activeEdges = firstSelected?.edges ?? style.edges;
  const activeOpacity = firstSelected?.opacity ?? style.opacity;
  const activeTextAlign = boundText?.textAlign ?? firstSelected?.textAlign ?? style.textAlign;
  const activeFontSize = boundText?.fontSize ?? firstSelected?.fontSize ?? style.fontSize;

  // Updates the default style for new elements AND, if something is
  // already selected, restyles it live and broadcasts the change —
  // otherwise the panel would only ever affect shapes not drawn yet.
  // Also syncs a selected container's bound text label (font size/align
  // live on the label, not the container, but there's no separate way
  // to select the label directly).
  function applyAndBroadcast(patch: Partial<Style>) {
    setStyle(patch);
    const ids = useBoardStore.getState().selectedIds;
    if (ids.length === 0) return;
    applyStyleToSelection(patch);
    const updated = useBoardStore.getState().elements;
    for (const id of ids) {
      const el = updated[id];
      if (el) useSyncStore.getState().sendUpsert(el);
      const bound = findBoundText(updated, id);
      if (bound) useSyncStore.getState().sendUpsert(bound);
    }
  }

  function handleStrokeChange(color: string) {
    applyAndBroadcast({ stroke: color });
    addRecentColor(color);
  }

  return (
    <div
      role="group"
      aria-label="Style"
      className="pointer-events-auto flex max-h-full w-[210px] flex-col gap-4 overflow-y-auto rounded-2xl border border-neutral-200/80 bg-white/95 p-3 shadow-lg shadow-neutral-900/5 backdrop-blur"
    >
      <Section label="Stroke">
        <div className="flex flex-wrap items-center gap-1.5">
          {STROKE_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleStrokeChange(c)}
              aria-label={`Stroke ${c}`}
              aria-pressed={activeStroke === c}
              style={{ backgroundColor: c }}
              className={`h-6 w-6 shrink-0 rounded-lg ring-1 ring-inset ring-black/10 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                activeStroke === c ? 'ring-2 ring-violet-500' : ''
              }`}
            />
          ))}
          <label className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-neutral-300">
            <span className="sr-only">Custom stroke color</span>
            <input
              type="color"
              value={activeStroke}
              onChange={(e) => handleStrokeChange(e.target.value)}
              className="h-full w-full cursor-pointer opacity-0"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-5 w-5 rounded-md"
              style={{ backgroundColor: activeStroke }}
            />
          </label>
        </div>
        {recentColors.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {recentColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleStrokeChange(c)}
                aria-label={`Use recent color ${c}`}
                style={{ backgroundColor: c }}
                className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10 transition hover:scale-110"
              />
            ))}
          </div>
        )}
      </Section>

      {showBackground && (
        <Section label="Background">
          <div className="flex flex-wrap items-center gap-1.5">
            {BG_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => applyAndBroadcast({ fill: c })}
                aria-label={c === 'transparent' ? 'No fill' : `Background ${c}`}
                aria-pressed={activeFill === c}
                style={c === 'transparent' ? undefined : { backgroundColor: c }}
                className={`relative h-6 w-6 shrink-0 rounded-lg ring-1 ring-inset ring-black/10 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                  c === 'transparent' ? 'bg-[linear-gradient(45deg,#e5e5e5_25%,transparent_25%,transparent_75%,#e5e5e5_75%),linear-gradient(45deg,#e5e5e5_25%,#fff_25%,#fff_75%,#e5e5e5_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px]' : ''
                } ${activeFill === c ? 'ring-2 ring-violet-500' : ''}`}
              />
            ))}
            <label className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-neutral-300">
              <span className="sr-only">Custom background color</span>
              <input
                type="color"
                value={activeFill === 'transparent' ? '#ffffff' : activeFill}
                onChange={(e) => applyAndBroadcast({ fill: e.target.value })}
                className="h-full w-full cursor-pointer opacity-0"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute h-5 w-5 rounded-md"
                style={{ backgroundColor: activeFill === 'transparent' ? '#ffffff' : activeFill }}
              />
            </label>
          </div>
        </Section>
      )}

      {showFillStyle && (
        <Section label="Fill style">
          <div className="flex items-center gap-1">
            {FILL_STYLES.map(({ label, value }) => (
              <IconButton
                key={value}
                active={activeFillStyle === value}
                onClick={() => applyAndBroadcast({ fillStyle: value })}
                label={label}
              >
                <FillStyleIcon style={value!} />
              </IconButton>
            ))}
          </div>
        </Section>
      )}

      {showStrokeWidth && (
        <Section label="Stroke width">
          <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map(({ label, value, weight }) => (
              <IconButton
                key={value}
                active={activeStrokeWidth === value}
                onClick={() => applyAndBroadcast({ strokeWidth: value })}
                label={label}
              >
                <StrokeWidthIcon weight={weight} />
              </IconButton>
            ))}
          </div>
        </Section>
      )}

      {showStrokeStyle && (
        <Section label="Stroke style">
          <div className="flex items-center gap-1">
            {STROKE_STYLES.map(({ label, value, dash }) => (
              <IconButton
                key={value}
                active={activeStrokeStyle === value}
                onClick={() => applyAndBroadcast({ strokeStyle: value })}
                label={label}
              >
                <StrokeStyleIcon dash={dash} />
              </IconButton>
            ))}
          </div>
        </Section>
      )}

      {showSloppiness && (
        <Section label="Sloppiness">
          <div className="flex items-center gap-1">
            {SLOPPINESS.map(({ label, value, amplitude }) => (
              <IconButton
                key={label}
                active={Math.abs(activeRoughness - value) < 0.05}
                onClick={() => applyAndBroadcast({ roughness: value })}
                label={label}
              >
                <SloppinessIcon amplitude={amplitude} />
              </IconButton>
            ))}
          </div>
        </Section>
      )}

      {showEdges && (
        <Section label="Edges">
          <div className="flex items-center gap-1">
            <IconButton
              active={activeEdges === 'sharp'}
              onClick={() => applyAndBroadcast({ edges: 'sharp' })}
              label="Sharp"
            >
              <EdgesIcon round={false} />
            </IconButton>
            <IconButton
              active={activeEdges === 'round'}
              onClick={() => applyAndBroadcast({ edges: 'round' })}
              label="Round"
            >
              <EdgesIcon round />
            </IconButton>
          </div>
        </Section>
      )}

      {showTextControls && (
        <>
          <Section label="Font size">
            <div className="flex items-center gap-1">
              {FONT_SIZES.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyAndBroadcast({ fontSize: value })}
                  aria-pressed={activeFontSize === value}
                  aria-label={`Font size ${label}`}
                  title={`Font size ${label}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                    activeFontSize === value
                      ? 'bg-violet-600 text-white'
                      : 'text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>
          <Section label="Text align">
            <div className="flex items-center gap-1">
              {TEXT_ALIGNS.map(({ label, value }) => (
                <IconButton
                  key={value}
                  active={activeTextAlign === value}
                  onClick={() => applyAndBroadcast({ textAlign: value })}
                  label={label}
                >
                  <TextAlignIcon align={value!} />
                </IconButton>
              ))}
            </div>
          </Section>
        </>
      )}

      {showOpacity && (
        <Section label="Opacity">
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={activeOpacity}
            onChange={(e) => applyAndBroadcast({ opacity: Number(e.target.value) })}
            aria-label="Opacity"
            className="w-full cursor-pointer accent-violet-600"
          />
        </Section>
      )}

      {showLayers && (
        <Section label="Layers">
          <div className="flex items-center gap-1">
            <IconButton active={false} onClick={() => reorderSelectionAndBroadcast('back')} label="Send to back">
              <LayerIcon variant="back" />
            </IconButton>
            <IconButton active={false} onClick={() => reorderSelectionAndBroadcast('front')} label="Bring to front">
              <LayerIcon variant="front" />
            </IconButton>
          </div>
        </Section>
      )}

      {showActions && (
        <Section label="Actions">
          <div className="flex items-center gap-1">
            <IconButton active={false} onClick={duplicateSelectionAndBroadcast} label="Duplicate (Ctrl+D)">
              <DuplicateIcon />
            </IconButton>
            <IconButton
              active={false}
              onClick={() => deleteSelectionAndBroadcast(selectedIds)}
              label="Delete"
            >
              <TrashIcon />
            </IconButton>
          </div>
        </Section>
      )}
    </div>
  );
}
