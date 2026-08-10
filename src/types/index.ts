/**
 * Shared types for canvas elements, sync operations, and presence.
 * Used by both the broadcast layer and the local store so client and
 * network representations never drift apart.
 */

export type ElementType =
  | 'path'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text';

export type Element = {
  id: string;
  type: ElementType;
  points?: number[]; // for path/line/arrow, flat [x0,y0,x1,y1,...]
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  text?: string;
  fontSize?: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
  updatedAt: number; // ms epoch, Lamport-ish clock
  updatedBy: string; // clientId
  deleted?: boolean;
};

export type ElementUpsertOp = {
  type: 'element:upsert';
  payload: { element: Element };
};

export type ElementDeleteOp = {
  type: 'element:delete';
  payload: { id: string; updatedAt: number; updatedBy: string };
};

export type SyncOp = ElementUpsertOp | ElementDeleteOp;

export type Presence = {
  clientId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
};

export type Tool =
  | 'select'
  | 'pen'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text'
  | 'eraser';

export type BoardRow = {
  id: string;
  snapshot: Element[];
  created_at: string;
  updated_at: string;
};
