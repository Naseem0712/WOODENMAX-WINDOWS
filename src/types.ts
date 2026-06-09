export interface BatchAddItem {
  id: string;
  title: string;
  width: number | '';
  height: number | '';
  quantity: number | '';
  rate: number | '';
}

export enum WindowType {
  SLIDING = 'sliding',
  CASEMENT = 'casement',
  VENTILATOR = 'ventilator',
  GLASS_PARTITION = 'glass_partition',
  CORNER = 'corner',
  MIRROR = 'mirror',
  LOUVERS = 'louvers',
}

export enum MirrorShape {
  RECTANGLE = 'rectangle',
  ROUNDED_RECTANGLE = 'rounded_rectangle',
  CAPSULE = 'capsule',
  OVAL = 'oval',
}

/** Opening silhouette — arch-top, rounded corners, etc. (casement / ventilator). */
export type CasementOutlineShape =
  | 'rect'
  | 'arch_top'
  | 'rounded_rect'
  | 'rounded_top'
  | 'rounded_bottom';

export interface CasementOutlineConfig {
  shape: CasementOutlineShape;
  /** True when user explicitly chose arch/rounded opening shape in controls (not auto-restored). */
  openingShapeUserSet?: boolean;
  cornerRadiusMm: number | '';
  /** Straight rectangular zone height from bottom of inner opening (mm). Spring transom sits on top of this. */
  archStraightBottomMm: number | '';
  /** Relative height (0–1) where arch meets horizontal transom when archStraightBottomMm is not set. */
  archSpringRatio: number;
  /** Auto evenly-spaced fanlight mullions when archMullionAngles is empty. */
  archRadialMullions: number;
  /** Custom fanlight mullion angles in degrees (180=left, 90=top, 0=right). Overrides count when set. */
  archMullionAngles?: number[];
  /** Concentric semicircular profile rings inside the arch (0, 1, or 2). */
  archInnerRingCount: number;
  /** Clear gap between inner arch rings (mm). */
  archInnerRingGapMm: number | '';
}

export interface SavedColor {
  id: string;
  name: string;
  value: string; // Can be hex code or base64 data URI
  type: 'color' | 'texture';
}

export interface HardwareItem {
  id:string;
  name: string;
  qtyPerShutter: number | '';
  rate: number | '';
  unit: 'per_shutter_or_door' | 'per_window';
}

export type GlassSpecialType = 'none' | 'laminated' | 'dgu';

export interface GlassOptions {
    thicknesses: number[];
    customThicknessAllowed: boolean;
    specialTypes: Exclude<GlassSpecialType, 'none'>[];
}

export interface ProfileDimensions {
  // Shared
  outerFrame: number | '';
  outerFrameVertical?: number | '';
  fixedFrame: number | '';

  // Sliding
  shutterHandle: number | '';
  shutterInterlock: number | '';
  shutterTop: number | '';
  shutterBottom: number | '';
  shutterMeeting: number | '';
  /** Sliding 2-track outer frame (top + bottom horizontals). Falls back to
   *  `outerFrame` if not set. Physical extrusion differs from 3-track. */
  track2T?: number | '';
  /** Sliding 3-track outer frame (top + bottom horizontals). Falls back to
   *  `outerFrame` if not set. Usually wider / heavier than 2-track. */
  track3T?: number | '';
  /** 2-track windows only: vertical L+R jamb. Same section as 3T in shop but stock/wastage must not mix with 3T outer. */
  jamb2T?: number | '';
  /** 3-track windows only: vertical L+R jamb. Falls back to outerFrameVertical. */
  jamb3T?: number | '';
  
  // Casement / Ventilator / Partition (hinged)
  casementShutter: number | '';
  mullion: number | '';

  // Ventilator
  louverBlade: number | '';

  // Louvers
  louverProfile: number | '';

  // Glass Partition
  topTrack: number | '';
  bottomTrack: number | '';
  
  glassGridProfile: number | '';
}

export type ProfileDetails = {
    [K in keyof ProfileDimensions]?: number | '';
}

export interface ProfileSeries {
  id: string;
  name: string;
  type: WindowType;
  dimensions: ProfileDimensions;
  /**
   * Sliding only. When not `false` (default): outer top, bottom, and L/R vertical
   * are the same extrusion (typical 25/27/28/29 mm) — one stock pool per 2T/3T and
   * vertical off-cuts can serve horizontal cuts. Set `false` when track rail and
   * jamb are different sections (e.g. 35mm heavy outer).
   */
  slidingOuterUnifiedPerimeter?: boolean;
  /** Extra profile dimension fields shown in Configure (beyond defaults for `type`). */
  extraDimensionKeys?: (keyof ProfileDimensions)[];
  weights?: ProfileDetails;
  lengths?: ProfileDetails;
  hardwareItems: HardwareItem[];
  glassOptions: GlassOptions;
}

export enum TrackType {
  TWO_TRACK = 2,
  THREE_TRACK = 3,
}

export enum ShutterConfigType {
  TWO_GLASS = '2G',
  THREE_GLASS = '3G',
  TWO_GLASS_ONE_MESH = '2G1M',
  FOUR_GLASS = '4G',
  FOUR_GLASS_TWO_MESH = '4G2M',
}

export enum FixedPanelPosition {
  TOP = 'top',
  BOTTOM = 'bottom',
  LEFT = 'left',
  RIGHT = 'right',
}

export interface FixedPanel {
  id: string;
  position: FixedPanelPosition;
  size: number;
}

export enum GlassType {
  CLEAR = 'clear',
  FROSTED = 'frosted',
  TINTED_BLUE = 'tinted-blue',
  CLEAR_SAPPHIRE = 'clear-sapphire',
  BROWN_TINTED = 'brown-tinted',
  BLACK_TINTED = 'black-tinted',
  TINTED_GREY = 'tinted-grey',
  VERTICAL_FLUTED = 'vertical-fluted',
}

export enum AreaType {
    SQFT = 'sqft',
    SQMT = 'sqmt',
}

/** casement = lever + mortice euro style (glass); sliding = flush pull bar; mesh_touch = recessed touch lock (mesh) */
export type HandleVariant = 'sliding' | 'casement' | 'mesh_touch';

export interface HandleConfig {
  x: number; // 0-100 percentage (of panel width)
  y: number; // 0-100 percentage (of panel height)
  orientation: 'vertical' | 'horizontal';
  length?: number;
  /** Visual style; sliding = pull bar, casement = lever — set by recommended defaults */
  variant?: HandleVariant;
}

export type VentilatorCellType = 'glass' | 'louvers' | 'door' | 'exhaust_fan';

export interface VentilatorCell {
    type: VentilatorCellType;
    handle?: HandleConfig;
}

export type PartitionPanelType = 'fixed' | 'sliding' | 'hinged' | 'fold';

export interface PartitionPanelConfig {
    type: PartitionPanelType;
    handle?: HandleConfig;
    framing?: 'none' | 'full';
    /** Optional column width in mm (glass partition). When set, overrides widthFractions for this panel. */
    widthMm?: number | '';
    /** Optional panel height in mm (≤ row height). */
    heightMm?: number | '';
    /** When height is less than the opening: align glass to top or bottom. Default bottom. */
    heightAlign?: 'top' | 'bottom';
    /** Folding leaves inside a Bi-fold panel (1–12). Visual / spec only. */
    foldLeafCount?: number;
    /** Framed Bi-fold: optional outer frame depth per edge (mm). Empty = series casement section. */
    foldFrameTopMm?: number | '';
    foldFrameBottomMm?: number | '';
    /** Shared width for left + right stiles when set. */
    foldFrameSideMm?: number | '';
    /** Override left / right stile (mm); falls back to Sides then series default. */
    foldFrameLeftMm?: number | '';
    foldFrameRightMm?: number | '';
}

export interface CornerSideConfig {
  windowType: WindowType.SLIDING | WindowType.CASEMENT | WindowType.VENTILATOR;
  trackType: TrackType;
  shutterConfig: ShutterConfigType;
  fixedShutters: boolean[];
  slidingHandles: (HandleConfig | null)[];
  verticalDividers: number[];
  horizontalDividers: number[];
  doorPositions: { row: number; col: number; handle?: HandleConfig }[];
  ventilatorGrid: VentilatorCell[][];
}

export interface LaminatedGlassConfig {
  glass1Thickness: number | '';
  glass1Type: GlassType;
  pvbThickness: number | '';
  pvbType: 'clear' | 'milky_white';
  glass2Thickness: number | '';
  glass2Type: GlassType;
  isToughened: boolean;
}

export interface DguGlassConfig {
  glass1Thickness: number | '';
  glass1Type: GlassType;
  airGap: number | '';
  glass2Thickness: number | '';
  glass2Type: GlassType;
  isToughened: boolean;
}

export interface GlassGridPattern {
    count: number;
    offset: number; // mm
    gap: number; // mm
}

export interface GlassGridConfig {
    applyToAll: boolean;
    barThickness: number;
    // panelId is 'default' or a specific panel ID like 'sliding-0', 'casement-0-1', 'fixed-top'
    patterns: Record<string, {
        horizontal: GlassGridPattern;
        vertical: GlassGridPattern;
    }>;
}

export interface LouverPatternItem {
  id: string;
  type: 'profile' | 'gap';
  size: number | '';
}

/** Cross-axis placement of a bay inside the outer module (horizontal row → vertical align; vertical stack → horizontal align). */
export type LouverBayCrossAlign = 'top' | 'center' | 'bottom';

/** One physical louver bay in a compound (joint) façade module — up to 5 bays. Empty list = legacy single opening using width×height only. */
export interface LouverBaySegment {
  id: string;
  width: number | '';
  height: number | '';
  /** top = flush to top/left edge; bottom = flush to bottom/right; center = centred on cross axis. */
  crossAlign?: LouverBayCrossAlign;
  /** Optional mm from top (horizontal row) or from left (vertical stack). Overrides crossAlign when set. */
  offsetMm?: number | '';
}


export interface WindowConfig {
  width: number | '';
  height: number | '';
  series: ProfileSeries;
  fixedPanels: FixedPanel[];
  glassType: GlassType;
  glassTexture?: string;
  glassThickness: number | '';
  customGlassName: string;
  profileColor: string;
  /** Optional wood-grain / finish image layered over `profileColor` (hex) with multiply blend. */
  profileTexture?: string;
  /** Optional site photo / sketch — replaces canvas elevation in print/PDF only. */
  printElevationPhoto?: string;
  glassGrid: GlassGridConfig;
  legacyGlassGrid?: { rows: number, cols: number }; // For migration
  
  // Type discriminator
  windowType: WindowType;
  
  // Special Glass Config
  glassSpecialType: GlassSpecialType;
  laminatedGlassConfig: LaminatedGlassConfig;
  dguGlassConfig: DguGlassConfig;

  // Sliding specific
  trackType: TrackType;
  shutterConfig: ShutterConfigType;
  fixedShutters: boolean[];
  slidingHandles: (HandleConfig | null)[];

  // Casement & Ventilator specific
  verticalDividers: number[]; // Relative positions (0-1)
  horizontalDividers: number[]; // Relative positions (0-1)
  /** Per-segment hidden mullions at grid junctions (not full lines). Keys: h "dividerIdx-col", v "dividerIdx-row". */
  hiddenMullionSegments?: { horizontal: string[]; vertical: string[] };
  doorPositions: { row: number; col: number; handle?: HandleConfig }[];
  /** Arch-top / rounded casement outline (visual + layout helper). */
  casementOutline?: CasementOutlineConfig;

  // Ventilator specific
  ventilatorGrid: VentilatorCell[][];
  
  // Glass Partition specific
  partitionPanels: {
    count: number;
    types: PartitionPanelConfig[];
    hasTopChannel: boolean;
    /** Relative widths per panel (e.g. [7, 3] ≈ 70% / 30% for door + sidelight). Omitted = equal split. */
    widthFractions?: number[];
  };

  // Louvers specific
  louverPattern: LouverPatternItem[];
  orientation: 'vertical' | 'horizontal';
  /** Multi-size joint module: stacked or side‑by‑side bays; quotation area = sum of bay areas (see utils/louverBays). */
  louverBays?: LouverBaySegment[];
  /** How bays abut inside the outer module bbox. */
  louverBayLayout?: 'vertical' | 'horizontal';

  // Mirror specific
  mirrorConfig: {
    shape: MirrorShape;
    isFrameless: boolean;
    cornerRadius: number | '';
  };
  
  // Corner specific
  leftWidth?: number | '';
  rightWidth?: number | '';
  leftConfig?: CornerSideConfig;
  rightConfig?: CornerSideConfig;
  cornerPostWidth: number | '';
}

import type { QuotationLine } from './railing/types';

/** Window catalogue line (existing behaviour). `kind` omitted in older saved data = window. */
export interface WindowQuotationItem {
  kind?: 'window';
  id: string;
  title: string;
  config: WindowConfig;
  quantity: number;
  areaType: AreaType;
  rate: number;
  hardwareCost: number;
  hardwareItems: HardwareItem[];
  profileColorName?: string;
  /** Replaces rendered elevation in print when set. */
  printElevationPhoto?: string;
}

/** Glass railing line merged into the same View Quotation / PDF as windows. */
export interface RailingQuotationItem {
  kind: 'railing';
  id: string;
  title: string;
  railingLine: QuotationLine;
}

/** One unit inside a multi-window façade package quotation line. */
export interface WindowPackageUnitLine {
  id: string;
  title: string;
  config: WindowConfig;
  rate: number;
  hardwareCost: number;
  hardwareItems: HardwareItem[];
  profileColorName?: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

/** Combined façade — one print / quotation line with per-unit breakdown + package total. */
export interface WindowPackageQuotationItem {
  kind: 'window_package';
  id: string;
  title: string;
  quantity: number;
  areaType: AreaType;
  units: WindowPackageUnitLine[];
  layoutMinXMm: number;
  layoutMinYMm: number;
  layoutWidthMm: number;
  layoutHeightMm: number;
  /** Replaces combined layout elevation in print when set. */
  printElevationPhoto?: string;
}

export type QuotationItem = WindowQuotationItem | RailingQuotationItem | WindowPackageQuotationItem;

export interface MaterialRateSettings {
  aluminiumProfilePerKg: number;
  makingChargePerSqFt: number;
  meshPerSqFt: number;
  meshShutterOptions: {
    separateSections: boolean;
    meshClipPerMeshShutter: number;
    meshClipLengthFt: number;
    meshClipWeightKgPerPc: number;
    meshClipPowderRatePerRft: number;
  };
  profit: {
    mode: 'percentage' | 'per_sqft';
    value: number;
  };
  wastageCartagePerSqFt: number;
  powderCoatingPerRft: {
    track: number;
    shutterSections: number;
    slimInterlock: number;
    /** Bottom track clips only (2-track → 2 pcs, 3-track → 3 pcs), ₹/rft — separate from main track powder. */
    trackClip?: number;
  };
  glassPerSqFt: {
    clear: {
      '5': number;
      '6': number;
      '8': number;
      '10': number;
      '12': number;
    };
    /** Tinted glasses (brown/grey/black etc.) — used by Homeowner quick pricing. */
    tinted?: Record<string, number>;
    /** Reflective glasses — used by Homeowner quick pricing. */
    reflective?: Record<string, number>;
    laminated: {
      '5+5': number;
      '6+6': number;
    };
    dgu: {
      '6+12+6': number;
      '5+12+5': number;
    };
    /** Extra per-sqft charges layered on top of base glass pricing. */
    extras?: {
      laminatedChargePerSqFt?: number;
      dguChargePerSqFt?: number;
      frostingExtraPerSqFt?: number;
    };
  };
  /** Hardware/lock rates (₹ per piece) — used by Homeowner quick pricing. */
  lockRates?: {
    multipoint?: number;
    touch?: number;
    mortice?: number;
  };
  /** Fabrication charge per profile band (arch band, inner ring, casement door sides). */
  profileBandChargePerBand?: number;
}

export interface QuotationSettings {
  company: {
    logo: string;
    name: string;
    address: string;
    email: string;
    website: string;
    gstNumber: string;
  };
  customer: {
    name: string;
    address: string;
    contactPerson: string;
    email: string;
    website: string;
    gstNumber: string;
    architectName?: string;
  };
  financials: {
    gstPercentage: number | '';
    discount: number | '';
    discountType: 'percentage' | 'fixed';
  };
  bankDetails: {
    name: string;
    accountNumber: string;
    ifsc: string;
    branch: string;
    accountType: 'savings' | 'current';
  };
  title: string;
  terms: string;
  description: string;
  materialRates: MaterialRateSettings;
}

// Bill of Materials Types
export interface BOMProfile {
  profileKey: keyof ProfileDimensions | 'glassGridProfile';
  totalLength: number;
  standardLength: number;
  weightPerMeter?: number;
  pieces: number[];
  requiredBars: number;
  totalWeight: number;
}

export interface BOMHardware {
  name: string;
  totalQuantity: number;
}

export interface BOMGlass {
    description: string;
    totalAreaSqFt: number;
    totalAreaSqMt: number;
}

/** One rectangular cut line (merged across quotation qty) for roll planning. */
export interface BOMGlassCutRow {
  description: string;
  widthMm: number;
  heightMm: number;
  totalPanels: number;
  areaSqFt: number;
  /** Quotation line this row applies to (per-line BOM keys include item id). */
  lineTitle?: string;
  windowWidthMm?: number;
  windowHeightMm?: number;
  quotationItemId?: string;
}

export interface BOMMesh {
    totalAreaSqFt: number;
    totalAreaSqMt: number;
}

export interface BOMMeshCutRow {
  widthMm: number;
  heightMm: number;
  totalPanels: number;
  areaSqFt: number;
  lineTitle?: string;
  windowWidthMm?: number;
  windowHeightMm?: number;
  quotationItemId?: string;
}

export interface BOMSeries {
  seriesId: string;
  seriesName: string;
  profiles: BOMProfile[];
  hardware: BOMHardware[];
  glass: BOMGlass[];
  mesh?: BOMMesh;
  /** Per-size glass cuts with qty — for roll length / width planning */
  glassCutsFlat?: BOMGlassCutRow[];
  /** Per-size mesh cuts with qty */
  meshCutsFlat?: BOMMeshCutRow[];
}

export type BOM = BOMSeries[];

// ─────────────────────────────────────────────────────────────
// Role-based modes (Homeowner / Architect / Manufacturer)
// ─────────────────────────────────────────────────────────────

export type UserMode = 'homeowner' | 'architect' | 'manufacturer';

/** Details required to unlock full Manufacturer access on this device. */
export interface ManufacturerProfile {
  shopName: string;
  gstNumber: string;
  phone: string;
  address: string;
}

/** Minimal details required before downloading/printing a quotation. */
export interface ExportContactProfile {
  name: string;
  city: string;
  pinCode: string;
  phone: string;
}

export interface UserModeState {
  version: 1;
  mode: UserMode;
  manufacturer?: ManufacturerProfile;
  exportContact?: ExportContactProfile;
  /** For one-time actions per mode, e.g. architect rate auto-fill. */
  flags?: Record<string, boolean>;
}

export type DesignLayoutSide = 'right' | 'left' | 'top' | 'bottom';

/** Cross-axis alignment when attaching beside (left/right) or above/below another unit. */
export type DesignLayoutCrossAlign = 'top' | 'center' | 'bottom';

/** Extra window unit in a multi-window façade layout (session design). */
export interface DesignLayoutUnit {
  id: string;
  title: string;
  config: WindowConfig;
  /** Anchor unit — primary or an earlier companion in the list. */
  anchorUnitId: DesignLayoutActiveUnit;
  /** Which side of the anchor this unit attaches to. */
  side: DesignLayoutSide;
  /** Clear gap along the attachment axis (mm). */
  gapMm: number;
  /** Cross-axis alignment vs anchor (top/center/bottom). */
  crossAlign: DesignLayoutCrossAlign;
  /** Optional cross-axis offset (mm) — overrides crossAlign when set. */
  crossOffsetMm?: number | '';
  /** Per-unit base rate (₹/area unit). Empty = use quotation panel global rate. */
  rate?: number | '';
  /** @deprecated use gapMm — migrated on load */
  gapFromPrevMm?: number;
  /** @deprecated use crossOffsetMm — migrated on load */
  offsetTopFromPrimaryMm?: number;
}

export type DesignLayoutActiveUnit = 'primary' | string;

export interface DesignLayoutSession {
  companions: DesignLayoutUnit[];
  activeUnitId: DesignLayoutActiveUnit;
}