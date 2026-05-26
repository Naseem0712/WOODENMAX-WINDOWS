export type DesignType =
  | 'straight'
  | 'u-type'
  | 'o-type'
  | 'l-type'
  | 'zigzag-type'
  | 'staircase'
  | 'balcony'
  | 'custom'

export type HeightMode = 'uniform' | 'per-segment'
/** Quotation-wide: normal wall railing vs staircase hardware set. */
export type HardwareMode = 'normal' | 'staircase'
export type BottomFixing = 'continuous-rail' | 'pillars'
export type PillarsPerGlass = 2 | 3 | 4

export type SegmentBendMode =
  | 'none'
  | 'left-90'
  | 'right-90'
  | 'depth-in'
  | 'depth-out'
  | 'front-90'
  | 'back-90'
  | 'left-side-90'
  | 'right-side-90'
  | 'custom'

export interface SegmentDim {
  key: string
  label: string
  labelHi: string
  unit: 'mm' | 'deg'
  value: number
  /** Turn before this leg runs (custom / path designs) */
  bendMode?: SegmentBendMode
  bendBeforeDeg?: number
}

export interface SegmentHeight {
  key: string
  label: string
  value: number
}

export interface SegmentGlassConfig {
  key: string
  label: string
  glassCount: number
  gapMm: number
  pillarsPerGlass: PillarsPerGlass
  pillarInsetMm: number
  /** Handrail profile on this leg (defaults from design finish). */
  handrailProfile: string
  /** Bottom rail / channel on this leg (defaults from design finish). */
  bottomRailProfile: string
}

export interface GlassOption {
  id: string
  name: string
  nameHi: string
  composition: string
  thicknessMm: number
}

export interface CalculatedGlass {
  segmentKey: string
  segmentLabel: string
  panelIndex: number
  widthMm: number
  heightMm: number
  pillarPositionsMm: number[]
}

export interface CalculatedSegment {
  key: string
  label: string
  runLengthMm: number
  glassCount: number
  gapMm: number
  totalGapMm: number
  glassWidthMm: number
  heightMm: number
  glasses: CalculatedGlass[]
  pillarsInSegment: number
}

export interface RailStockPlanSummary {
  totalBars: number
  requiredFt: number
  wasteFt: number
  joints180: number
  barSizes: string
}

export interface HardwareCounts {
  connector90: number
  connector180: number
  wallConnectors: number
  bottomRailMm: number
  handrailMm: number
  bottomRailRft: number
  handrailRft: number
  bottomRailStock: RailStockPlanSummary
  handrailStock: RailStockPlanSummary
  totalPillars: number
  totalAnchors: number
}

export type RateDisplayUnit = 'rmt' | 'rft' | 'sft'
export type RailRateMode = 'rft' | 'kg'

export interface CostingRates {
  glassPerSft: number
  pillarPerPcs: number
  connector90PerPcs: number
  connector180PerPcs: number
  wallConnectorPerPcs: number
  bottomRailRate: number
  bottomRailRateMode: RailRateMode
  bottomRailKgPerRft: number
  handrailRate: number
  handrailRateMode: RailRateMode
  handrailKgPerRft: number
  anchorPerPcs: number
  quoteDisplayUnit: RateDisplayUnit
  referenceGlassPerSft: number
  referenceBottomRailPerRft: number
  referenceHandrailPerRft: number
  referencePillarPerPcs: number
  referenceConnector90: number
  referenceConnector180: number
  referenceWallConnector: number
  referenceAnchor: number
}

export type CostRateField =
  | 'glassPerSft'
  | 'pillarPerPcs'
  | 'connector90PerPcs'
  | 'connector180PerPcs'
  | 'wallConnectorPerPcs'
  | 'bottomRailRate'
  | 'handrailRate'
  | 'anchorPerPcs'

export interface CostLineItem {
  label: string
  qty: number
  unit: string
  rate: number
  amount: number
  rateField?: CostRateField
  referenceAmount?: number
  note?: string
}

/** Subtotal ÷ glass area / rail length / perimeter — per 1 set */
export interface SetRatesPerUnit {
  perSft: number | null
  perRft: number | null
  perRmt: number | null
  railRftBasis: number
}

export interface CostBreakdown {
  items: CostLineItem[]
  subtotal: number
  referenceSubtotal: number
  glassAreaSft: number
  bottomRailRft: number
  handrailRft: number
  perimeterRmt: number
  totalAnchors: number
  displayUnit: RateDisplayUnit
  setRates: SetRatesPerUnit
  design: DesignCalculation
}

export interface BomLine {
  category: 'glass' | 'rail' | 'hardware'
  item: string
  specification: string
  qty: number
  unit: string
}

export interface DesignCalculation {
  segments: CalculatedSegment[]
  hardware: HardwareCounts
  bom: BomLine[]
  totalGlassPanels: number
  totalGlassAreaSqm: number
  totalGlassAreaSft: number
  perimeterRunMm: number
}

export interface FinishSpecs {
  glassColor: string
  hardwareColor: string
  anchorSize: string
  bottomRailProfile: string
  handrailProfile: string
}

/** Editable package rates in Add to quote (per SFT / RFT / RMT) */
export interface PackageRates {
  perSft: number
  perRft: number
  perRmt: number
}

/** Locked package line used on quotation & PDF */
/** Extra charges per line (farma, chemical, etc.) */
export interface CustomCharge {
  label: string
  amount: number
}

export interface PackageQuote {
  unit: RateDisplayUnit
  rate: number
  basisQty: number
  basisLabel: string
  amountPerSet: number
}

export interface DesignDraft {
  designName: string
  designType: DesignType
  dimensions: SegmentDim[]
  heightMode: HeightMode
  uniformHeight: number
  segmentHeights: SegmentHeight[]
  segmentConfigs: SegmentGlassConfig[]
  bottomFixing: BottomFixing
  includeHandrail: boolean
  glassId: string
  customGlassComposition: string
  finish: FinishSpecs
  hardwareMode: HardwareMode
  quantity: number
  notes: string
  packageRates: PackageRates
  packageQuoteUnit: RateDisplayUnit
  customCharges: CustomCharge[]
  /** When saved presets exist: show per-item hardware/glass overrides without changing presets. */
  customizeHardware?: boolean
}

export interface QuotationLine {
  id: string
  designName: string
  designType: DesignType
  designLabel: string
  summary: string
  glassLabel: string
  hardwareLabel: string
  dimensionsText: string
  heightText: string
  draftSnapshot: DesignDraft
  finish: FinishSpecs
  calculation: DesignCalculation
  costing: CostBreakdown
  bomText: string
  quantity: number
  amount: number
  notes: string
  customCharges: CustomCharge[]
  createdAt: string
  /** When set, quotation & PDF use package rate × area (not itemized BOM) */
  packageQuote: PackageQuote | null
  /** Material + installation cost (before package quote) */
  internalCosting?: CostBreakdown
}

export interface QuotationMeta {
  clientName: string
  clientPhone: string
  clientAddress: string
  projectName: string
  quoteNumber: string
  date: string
  /** Opening paragraph on printed quotation */
  introText?: string
  /** Terms & conditions (one line per bullet) */
  termsText?: string
}
