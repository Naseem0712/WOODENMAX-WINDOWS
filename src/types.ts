
export enum WindowType {
  SLIDING = 'sliding',
  CASEMENT = 'casement',
  VENTILATOR = 'ventilator',
  GLASS_PARTITION = 'glass_partition',
  CORNER = 'corner',
}

export interface SavedColor {
  id: string;
  name: string;
  hex: string;
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
  // FIX: Corrected typo from 'black-tinded' to 'black-tinted'.
  BLACK_TINTED = 'black-tinted',
}

export enum AreaType {
    SQFT = 'sqft',
    SQMT = 'sqmt',
}

export interface HandleConfig {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  orientation: 'vertical' | 'horizontal';
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

export interface WindowConfig {
  width: number | '';
  height: number | '';
  series: ProfileSeries;
  fixedPanels: FixedPanel[];
  glassType: GlassType;
  glassThickness: number | '';
  customGlassName: string;
  glassSpecialType: GlassSpecialType;
  profileColor: string;
  glassGrid: { rows: number, cols: number };
  
  // Type discriminator
  windowType: WindowType;

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
  
  // Corner specific
  cornerSubType?: WindowType;
  leftWidth?: number | '';
  rightWidth?: number | '';
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