import { DEFAULT_FINISH } from './constants'
import { DEFAULT_PACKAGE_RATES } from './packagePricing'
import type {
  BottomFixing,
  CustomCharge,
  FinishSpecs,
  HeightMode,
  PackageRates,
  PillarsPerGlass,
  RateDisplayUnit,
} from './types'

export interface ModePreset {
  glassId: string
  customGlassComposition: string
  bottomFixing: BottomFixing
  includeHandrail: boolean
  finish: FinishSpecs
  defaultGlassCount: number
  defaultGapMm: number
  defaultPillarsPerGlass: PillarsPerGlass
  defaultPillarInsetMm: number
  uniformHeight: number
  heightMode: HeightMode
  packageRates: PackageRates
  packageQuoteUnit: RateDisplayUnit
  customCharges: CustomCharge[]
}

export interface QuotationPresets {
  normal: ModePreset
  staircase: ModePreset
}

export const DEFAULT_MODE_PRESET: ModePreset = {
  glassId: 'lam-13.52',
  customGlassComposition: '',
  bottomFixing: 'continuous-rail',
  includeHandrail: true,
  finish: { ...DEFAULT_FINISH },
  defaultGlassCount: 2,
  defaultGapMm: 12,
  defaultPillarsPerGlass: 2,
  defaultPillarInsetMm: 150,
  uniformHeight: 1100,
  heightMode: 'uniform',
  packageRates: { ...DEFAULT_PACKAGE_RATES },
  packageQuoteUnit: 'rft',
  customCharges: [],
}

export const DEFAULT_PRESETS: QuotationPresets = {
  normal: { ...DEFAULT_MODE_PRESET },
  staircase: {
    ...DEFAULT_MODE_PRESET,
    finish: {
      ...DEFAULT_FINISH,
      handrailProfile: 'SS round tube 50mm',
      bottomRailProfile: 'Aluminium U channel',
    },
  },
}
