import { applyPresetToDraft, presetFromDraft, resolveDraftMode } from './presets'
import { DEFAULT_FINISH } from './constants'
import { DEFAULT_PACKAGE_RATES } from './packagePricing'
import { DEFAULT_RATES } from './rateStorage'
import {
  DEFAULT_MODE_PRESET,
  DEFAULT_PRESETS,
  type ModePreset,
  type QuotationPresets,
} from './modePreset'
import type {
  CostingRates,
  DesignDraft,
  HardwareMode,
} from './types'

export type { ModePreset, QuotationPresets } from './modePreset'
export { DEFAULT_MODE_PRESET, DEFAULT_PRESETS } from './modePreset'

const STORAGE_KEY = 'railingq-project-settings-v2'

/** @deprecated Use ModePreset */
export interface DesignDefaults extends ModePreset {
  hardwareMode: HardwareMode
}

export interface ProjectSettings {
  presets: QuotationPresets
  ratesNormal: CostingRates
  ratesStaircase: CostingRates
  costingCollapsed: boolean
  savedOnce: boolean
  designDefaults?: DesignDefaults
  rates?: CostingRates
}

export const DEFAULT_DESIGN: DesignDefaults = {
  ...DEFAULT_MODE_PRESET,
  hardwareMode: 'normal',
}

function modePresetFromLegacy(d?: Partial<DesignDefaults>): ModePreset {
  if (!d) return { ...DEFAULT_MODE_PRESET }
  return {
    ...DEFAULT_MODE_PRESET,
    ...d,
    finish: { ...DEFAULT_FINISH, ...d.finish },
    packageRates: { ...DEFAULT_PACKAGE_RATES, ...d.packageRates },
    customCharges: d.customCharges ?? [],
  }
}

export function loadProjectSettings(): ProjectSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        presets: {
          normal: { ...DEFAULT_MODE_PRESET },
          staircase: { ...DEFAULT_PRESETS.staircase },
        },
        ratesNormal: { ...DEFAULT_RATES },
        ratesStaircase: { ...DEFAULT_RATES },
        costingCollapsed: false,
        savedOnce: false,
      }
    }
    const parsed = JSON.parse(raw) as Partial<ProjectSettings> & {
      designDefaults?: DesignDefaults
      rates?: CostingRates
    }

    const legacyPreset = modePresetFromLegacy(parsed.designDefaults)
    const presets: QuotationPresets = parsed.presets
      ? {
          normal: {
            ...DEFAULT_MODE_PRESET,
            ...parsed.presets.normal,
            finish: { ...DEFAULT_FINISH, ...parsed.presets.normal?.finish },
            packageRates: { ...DEFAULT_PACKAGE_RATES, ...parsed.presets.normal?.packageRates },
            customCharges: parsed.presets.normal?.customCharges ?? [],
          },
          staircase: {
            ...DEFAULT_PRESETS.staircase,
            ...parsed.presets.staircase,
            finish: { ...DEFAULT_FINISH, ...parsed.presets.staircase?.finish },
            packageRates: { ...DEFAULT_PACKAGE_RATES, ...parsed.presets.staircase?.packageRates },
            customCharges: parsed.presets.staircase?.customCharges ?? [],
          },
        }
      : {
          normal: legacyPreset,
          staircase: { ...legacyPreset, ...DEFAULT_PRESETS.staircase },
        }

    const baseRates = { ...DEFAULT_RATES, ...parsed.rates }
    return {
      presets,
      ratesNormal: { ...baseRates, ...parsed.ratesNormal },
      ratesStaircase: { ...baseRates, ...parsed.ratesStaircase },
      costingCollapsed: parsed.costingCollapsed ?? true,
      savedOnce: parsed.savedOnce ?? true,
    }
  } catch {
    return {
      presets: {
        normal: { ...DEFAULT_MODE_PRESET },
        staircase: { ...DEFAULT_PRESETS.staircase },
      },
      ratesNormal: { ...DEFAULT_RATES },
      ratesStaircase: { ...DEFAULT_RATES },
      costingCollapsed: false,
      savedOnce: false,
    }
  }
}

export function saveProjectSettings(settings: ProjectSettings): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...settings, savedOnce: true, costingCollapsed: true }),
  )
}

export function designDefaultsFromDraft(draft: DesignDraft): DesignDefaults {
  const mode = resolveDraftMode(draft)
  return { ...presetFromDraft(draft), hardwareMode: mode }
}

export function applyDesignDefaults(
  draft: DesignDraft,
  defaults: DesignDefaults,
): DesignDraft {
  const { hardwareMode, ...preset } = defaults
  return applyPresetToDraft(draft, preset, hardwareMode)
}

export function applyDefaultsToNewSegments(
  configs: DesignDraft['segmentConfigs'],
  defaults: DesignDefaults,
): DesignDraft['segmentConfigs'] {
  return configs.map((c) => ({
    ...c,
    glassCount: defaults.defaultGlassCount,
    gapMm: defaults.defaultGapMm,
    pillarsPerGlass: defaults.defaultPillarsPerGlass,
    pillarInsetMm: defaults.defaultPillarInsetMm,
  }))
}
