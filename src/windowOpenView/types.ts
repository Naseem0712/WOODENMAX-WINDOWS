import type { HandleConfig, WindowConfig } from '../types';
import type { DoorSwingLayout } from './doorHingeLayout';

export type OpenViewKind =
  | 'sliding'
  | 'casement'
  | 'ventilator'
  | 'partition_sliding'
  | 'partition_fold'
  | 'partition_hinged'
  | 'unsupported';

export interface OpenViewPanelSpec {
  id: string;
  /** Customer label e.g. A1, S1 */
  label: string;
  /** Position mm from outer frame top-left */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  zIndex: number;
  /** Additional X offset at full open (mm) */
  slideOffsetXMm?: number;
  /** Hinge pivot X from panel left (mm) */
  hingeXMm?: number;
  /** Hinge pivot Y from panel top (mm) */
  hingeYMm?: number;
  /** @deprecated use doorSwing — kept for plan fallback */
  openRotateDeg?: number;
  skewYDeg?: number;
  slideDirection?: 'left' | 'right' | 'none';
  trackLane?: 1 | 2 | 3;
  isMesh?: boolean;
  isFixed?: boolean;
  handle?: HandleConfig | null;
  /** Correct hinge pair + open geometry (side / top / bottom hung) */
  doorSwing?: DoorSwingLayout;
  /** Bi-fold / casement plan segment (top-down schematic) */
  planSegment?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    pivot?: { x: number; y: number };
  };
  /** Full bi-fold group plan (when multiple leaves share one opening) */
  bifoldPlan?: {
    path: { x: number; y: number }[];
    pivots: { x: number; y: number }[];
    segments: { x1: number; y1: number; x2: number; y2: number; label: string; pivot?: { x: number; y: number } }[];
  };
}

export interface OpenViewSpec {
  kind: OpenViewKind;
  config: WindowConfig;
  totalWidthMm: number;
  totalHeightMm: number;
  outerFrameMm: number;
  innerOriginMm: { x: number; y: number };
  innerWidthMm: number;
  innerHeightMm: number;
  profileColor: string;
  trackCount?: 2 | 3;
  panels: OpenViewPanelSpec[];
  /** Human-readable operation summary */
  operationLabel: string;
  /** Glass partition: tracks, mullions, profile depth for open-view chrome */
  partitionChrome?: {
    hasTopChannel: boolean;
    topTrackMm: number;
    bottomTrackMm: number;
    shutterProfileMm: number;
    mullions: { xMm: number; yMm: number; heightMm: number; widthMm: number }[];
  };
}

export type OpenViewVariant = 'canvas' | 'print';

export interface OpenViewOptions {
  swingSide?: import('./doorHingeLayout').DoorSwingSide;
}
