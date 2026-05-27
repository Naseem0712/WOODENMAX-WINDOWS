import { DEFAULT_FINISH } from './constants'
import {
  defaultBottomRailSpec,
  defaultHandrailSpec,
  defaultPillarSpec,
  defaultStudSpec,
} from './hardwareDefaults'
import { DEFAULT_PACKAGE_RATES } from './packagePricing'
import type {
  BottomFixing,
  CustomCharge,
  FinishSpecs,
  HandrailMaterial,
  HeightMode,
  PackageRates,
  PillarsPerGlass,
  ProductSpec,
  RateDisplayUnit,
} from './types'

export interface ModePreset {
  glassId: string
  customGlassComposition: string
  bottomFixing: BottomFixing
  includeHandrail: boolean
  handrailMaterial: HandrailMaterial
  finish: FinishSpecs
  defaultGlassCount: number
  defaultGapMm: number
  defaultPillarsPerGlass: PillarsPerGlass
  defaultStudsPerGlass: PillarsPerGlass
  defaultPillarInsetMm: number
  uniformHeight: number
  heightMode: HeightMode
  packageRates: PackageRates
  packageQuoteUnit: RateDisplayUnit
  customCharges: CustomCharge[]
  hardwareColorSameAsHandrail: boolean
  bottomRailSpec: ProductSpec
  pillarSpec: ProductSpec
  studSpec: ProductSpec
  handrailSpec: ProductSpec
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
  handrailMaterial: 'ss',
  finish: { ...DEFAULT_FINISH, handrailMaterial: 'ss', hardwareColorSameAsHandrail: true },
  defaultGlassCount: 2,
  defaultGapMm: 12,
  defaultPillarsPerGlass: 2,
  defaultStudsPerGlass: 2,
  defaultPillarInsetMm: 150,
  uniformHeight: 1100,
  heightMode: 'uniform',
  packageRates: { ...DEFAULT_PACKAGE_RATES },
  packageQuoteUnit: 'rft',
  customCharges: [],
  hardwareColorSameAsHandrail: true,
  bottomRailSpec: defaultBottomRailSpec(),
  pillarSpec: defaultPillarSpec(),
  studSpec: defaultStudSpec(),
  handrailSpec: defaultHandrailSpec('ss'),
}

export const DEFAULT_PRESETS: QuotationPresets = {
  normal: { ...DEFAULT_MODE_PRESET },
  staircase: {
    ...DEFAULT_MODE_PRESET,
    handrailMaterial: 'ss',
    finish: {
      ...DEFAULT_FINISH,
      handrailMaterial: 'ss',
      hardwareColorSameAsHandrail: true,
      handrailProfile: 'SS round tube 50mm',
      bottomRailProfile: 'Aluminium U channel',
    },
    handrailSpec: defaultHandrailSpec('ss'),
    bottomRailSpec: defaultBottomRailSpec(),
  },
}
