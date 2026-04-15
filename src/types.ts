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

export type HandleVariant = 'sliding' | 'casement';

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
  doorPositions: { row: number; col: number; handle?: HandleConfig }[];

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

export interface QuotationItem {
  id: string;
  title: string;
  config: WindowConfig;
  quantity: number;
  areaType: AreaType;
  rate: number;
  hardwareCost: number;
  hardwareItems: HardwareItem[];
  profileColorName?: string;
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

export interface BOMMesh {
    totalAreaSqFt: number;
    totalAreaSqMt: number;
}

export interface BOMSeries {
  seriesId: string;
  seriesName: string;
  profiles: BOMProfile[];
  hardware: BOMHardware[];
  glass: BOMGlass[];
  mesh?: BOMMesh;
}

export type BOM = BOMSeries[];