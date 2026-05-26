import { DEFAULT_PACKAGE_RATES } from './packagePricing'
import type { QuotationPresets } from './modePreset'
import {
  applyPresetToDraft,
  presetForMode,
  ratesForMode,
  resolveDraftMode,
  type ApplyPresetOptions,
} from './presets'
import type { CostingRates, DesignDraft, HardwareMode, QuotationLine } from './types'
import { recalculateQuoteLine } from './quotationFormat'
import { draftToLine } from './utils'

export type { ApplyPresetOptions }

export function applyDefaultsToDraft(
  draft: DesignDraft,
  presets: QuotationPresets,
  options?: ApplyPresetOptions,
): DesignDraft {
  const mode = resolveDraftMode(draft)
  const preset = presetForMode(presets, mode)
  return applyPresetToDraft(draft, preset, mode, options)
}

export function applyPresetsToMatchingLines(
  lines: QuotationLine[],
  presets: QuotationPresets,
  ratesNormal: CostingRates,
  ratesStaircase: CostingRates,
  options?: ApplyPresetOptions,
): QuotationLine[] {
  return lines.map((line) => {
    const mode = resolveDraftMode(line.draftSnapshot)
    const preset = presetForMode(presets, mode)
    const rates = ratesForMode(ratesNormal, ratesStaircase, mode)
    const snapshot = applyPresetToDraft(line.draftSnapshot, preset, mode, options)
    return recalculateQuoteLine(
      draftToLine(snapshot, rates, { id: line.id, createdAt: line.createdAt }),
    )
  })
}

export function createDraftFromPreset(
  presets: QuotationPresets,
  mode: HardwareMode,
  base: DesignDraft,
): DesignDraft {
  const preset = presetForMode(presets, mode)
  return applyPresetToDraft(
    base,
    { ...preset, packageRates: preset.packageRates ?? { ...DEFAULT_PACKAGE_RATES } },
    mode,
  )
}
