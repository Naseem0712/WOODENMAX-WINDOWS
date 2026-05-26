import { DEFAULT_PACKAGE_RATES } from './packagePricing'
import type { ModePreset, QuotationPresets } from './modePreset'
import type {
  CostingRates,
  DesignDraft,
  HardwareMode,
  PackageRates,
  RateDisplayUnit,
} from './types'

export function resolveDraftMode(draft: DesignDraft): HardwareMode {
  if (draft.designType === 'custom') return draft.hardwareMode ?? 'normal'
  return 'normal'
}

export function ratesForMode(
  ratesNormal: CostingRates,
  ratesStaircase: CostingRates,
  mode: HardwareMode,
): CostingRates {
  return mode === 'staircase' ? ratesStaircase : ratesNormal
}

export function presetForMode(presets: QuotationPresets, mode: HardwareMode): ModePreset {
  return presets[mode]
}

export function presetFromDraft(draft: DesignDraft): ModePreset {
  const firstCfg = draft.segmentConfigs[0]
  return {
    glassId: draft.glassId,
    customGlassComposition: draft.customGlassComposition,
    bottomFixing: draft.bottomFixing,
    includeHandrail: draft.includeHandrail,
    finish: { ...draft.finish },
    defaultGlassCount: firstCfg?.glassCount ?? 2,
    defaultGapMm: firstCfg?.gapMm ?? 12,
    defaultPillarsPerGlass: firstCfg?.pillarsPerGlass ?? 2,
    defaultPillarInsetMm: firstCfg?.pillarInsetMm ?? 150,
    uniformHeight: draft.uniformHeight,
    heightMode: draft.heightMode,
    packageRates: { ...(draft.packageRates ?? DEFAULT_PACKAGE_RATES) },
    packageQuoteUnit: draft.packageQuoteUnit ?? 'rft',
    customCharges: [...(draft.customCharges ?? [])],
  }
}

export type ApplyPresetOptions = {
  applyPresetExtras?: boolean
}

export function applyPresetToDraft(
  draft: DesignDraft,
  preset: ModePreset,
  mode: HardwareMode,
  options: ApplyPresetOptions = {},
): DesignDraft {
  const applyExtras = options.applyPresetExtras === true
  return {
    ...draft,
    glassId: preset.glassId,
    customGlassComposition: preset.customGlassComposition,
    bottomFixing: preset.bottomFixing,
    includeHandrail: preset.includeHandrail,
    hardwareMode: mode,
    finish: { ...preset.finish },
    uniformHeight: preset.uniformHeight,
    heightMode: preset.heightMode,
    packageRates: { ...preset.packageRates },
    packageQuoteUnit: preset.packageQuoteUnit,
    customCharges: applyExtras
      ? [...(preset.customCharges ?? [])]
      : [...(draft.customCharges ?? [])],
    segmentConfigs: draft.segmentConfigs.map((c) => ({
      ...c,
      glassCount: c.glassCount || preset.defaultGlassCount,
      gapMm: c.gapMm || preset.defaultGapMm,
      pillarsPerGlass: c.pillarsPerGlass || preset.defaultPillarsPerGlass,
      pillarInsetMm: c.pillarInsetMm || preset.defaultPillarInsetMm,
      handrailProfile: preset.finish.handrailProfile,
      bottomRailProfile: preset.finish.bottomRailProfile,
    })),
  }
}

export function packageRateAmount(pkg: PackageRates, unit: RateDisplayUnit): number {
  switch (unit) {
    case 'sft':
      return pkg.perSft
    case 'rmt':
      return pkg.perRmt
    default:
      return pkg.perRft
  }
}
