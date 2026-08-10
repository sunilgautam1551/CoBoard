'use client';

import type { ReactNode } from 'react';
import { DuplicateIcon, TrashIcon, LayerIcon } from './styleIcons';

type Props = {
  x: number;
  y: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onClose: () => void;
};

export function ContextMenu({ x, y, onDuplicate, onDelete, onBringToFront, onSendToBack, onClose }: Props) {
  return (
    <div
      role="menu"
      aria-label="Element actions"
      style={{ left: x, top: y }}
      className="absolute z-20 w-52 overflow-hidden rounded-xl border border-neutral-200/80 bg-white/95 py-1 shadow-lg shadow-neutral-900/10 backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItem
        icon={<DuplicateIcon />}
        label="Duplicate"
        shortcut="Ctrl+D"
        onClick={() => {
          onDuplicate();
          onClose();
        }}
      />
      <MenuItem
        icon={<LayerIcon variant="front" />}
        label="Bring to front"
        onClick={() => {
          onBringToFront();
          onClose();
        }}
      />
      <MenuItem
        icon={<LayerIcon variant="back" />}
        label="Send to back"
        onClick={() => {
          onSendToBack();
          onClose();
        }}
      />
      <div className="my-1 h-px bg-neutral-200" />
      <MenuItem
        icon={<TrashIcon />}
        label="Delete"
        shortcut="Del"
        danger
        onClick={() => {
          onDelete();
          onClose();
        }}
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  shortcut,
  danger,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none ${
        danger ? 'text-red-600' : 'text-neutral-700'
      }`}
    >
      <span aria-hidden="true" className={danger ? 'text-red-500' : 'text-neutral-500'}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-xs text-neutral-400">{shortcut}</span>}
    </button>
  );
}
