import { DEFAULT_PACKAGE_RATES, normalizePackageRates } from './packagePricing'
import {
  defaultBottomRailSpec,
  defaultHandrailSpec,
  defaultPillarSpec,
  defaultStudSpec,
  normalizeFinishSpecs,
} from './hardwareDefaults'
import type { ModePreset, QuotationPresets } from './modePreset'
import type {
  CostingRates,
  DesignDraft,
  HardwareMode,
  PackageRates,
  RateDisplayUnit,
} from './types'

/** True when Staircase preset/mode is active (any design type). */
export function isStaircaseDraft(draft: DesignDraft): boolean {
  return (draft.hardwareMode ?? 'normal') === 'staircase'
}

export function resolveDraftMode(draft: DesignDraft): HardwareMode {
  return draft.hardwareMode ?? 'normal'
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
  const finish = normalizeFinishSpecs(draft.finish)
  return {
    glassId: draft.glassId,
    customGlassComposition: draft.customGlassComposition,
    bottomFixing: draft.bottomFixing,
    includeHandrail: draft.includeHandrail,
    handrailMaterial: finish.handrailMaterial ?? (draft.includeHandrail ? 'ss' : 'none'),
    finish,
    defaultGlassCount: firstCfg?.glassCount ?? 2,
    defaultGapMm: firstCfg?.gapMm ?? 12,
    defaultPillarsPerGlass: firstCfg?.pillarsPerGlass ?? 2,
    defaultStudsPerGlass: firstCfg?.studsPerGlass ?? firstCfg?.pillarsPerGlass ?? 2,
    defaultPillarInsetMm: firstCfg?.pillarInsetMm ?? 150,
    uniformHeight: draft.uniformHeight,
    heightMode: draft.heightMode,
    packageRates: { ...(draft.packageRates ?? DEFAULT_PACKAGE_RATES) },
    packageQuoteUnit: draft.packageQuoteUnit ?? 'rft',
    customCharges: [...(draft.customCharges ?? [])],
    hardwareColorSameAsHandrail: finish.hardwareColorSameAsHandrail !== false,
    bottomRailSpec: finish.bottomRailSpec ?? defaultBottomRailSpec(),
    pillarSpec: finish.pillarSpec ?? defaultPillarSpec(),
    studSpec: finish.studSpec ?? defaultStudSpec(),
    handrailSpec: finish.handrailSpec ?? defaultHandrailSpec(finish.handrailMaterial ?? 'ss'),
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
  const finish = normalizeFinishSpecs({
    ...preset.finish,
    bottomRailSpec: preset.bottomRailSpec,
    pillarSpec: preset.pillarSpec,
    studSpec: preset.studSpec,
    handrailSpec: preset.handrailSpec,
    hardwareColorSameAsHandrail: preset.hardwareColorSameAsHandrail,
  })
  const includeHandrail = preset.handrailMaterial !== 'none' && preset.includeHandrail
  return {
    ...draft,
    glassId: preset.glassId,
    customGlassComposition: preset.customGlassComposition,
    bottomFixing: preset.bottomFixing,
    includeHandrail,
    hardwareMode: mode,
    finish,
    uniformHeight: preset.uniformHeight,
    heightMode: preset.heightMode,
    packageRates: normalizePackageRates({
      ...preset.packageRates,
      ...draft.packageRates,
    }),
    packageQuoteUnit: draft.packageQuoteUnit ?? preset.packageQuoteUnit,
    customCharges: applyExtras
      ? [...(preset.customCharges ?? [])]
      : [...(draft.customCharges ?? [])],
    segmentConfigs: draft.segmentConfigs.map((c) => ({
      ...c,
      glassCount: c.glassCount || preset.defaultGlassCount,
      gapMm: c.gapMm || preset.defaultGapMm,
      pillarsPerGlass: c.pillarsPerGlass || preset.defaultPillarsPerGlass,
      studsPerGlass: c.studsPerGlass || preset.defaultStudsPerGlass,
      pillarInsetMm: c.pillarInsetMm || preset.defaultPillarInsetMm,
      handrailProfile: finish.handrailProfile,
      bottomRailProfile: finish.bottomRailProfile,
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
