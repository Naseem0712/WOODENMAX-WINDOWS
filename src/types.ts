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

export interface HandleConfig {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  orientation: 'vertical' | 'horizontal';
  length?: number;
}

export type VentilatorCellType = 'glass' | 'louvers' | 'door' | 'exhaust_fan';

export interface VentilatorCell {
    type: VentilatorCellType;
    handle?: HandleConfig;
}

export type PartitionPanelType = 'fixed' | 'sliding' | 'hinged';

export interface PartitionPanelConfig {
    type: PartitionPanelType;
    handle?: HandleConfig;
    framing?: 'none' | 'full';
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
  };
  customer: {
    name: string;
    address: string;
    contactPerson: string;
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

export interface BOMSeries {
  seriesId: string;
  seriesName: string;
  profiles: BOMProfile[];
  hardware: BOMHardware[];
}

export type BOM = BOMSeries[];