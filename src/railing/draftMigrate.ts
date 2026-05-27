import { migrateZigzagTypeToCustom } from './customSegments'
import { normalizeFinishSpecs } from './hardwareDefaults'
import { normalizePackageRates } from './packagePricing'
import { ensureOTypeFourSides } from './oTypeMigrate'
import type { DesignDraft } from './types'

function ensureSegmentSupportFields(draft: DesignDraft): DesignDraft {
  return {
    ...draft,
    segmentConfigs: draft.segmentConfigs.map((c) => ({
      ...c,
      studsPerGlass: c.studsPerGlass ?? c.pillarsPerGlass ?? 2,
    })),
  }
}

export function normalizeDraft(draft: DesignDraft): DesignDraft {
  let d = { ...draft }
  if (d.designType === 'zigzag-type' || d.designType === 'staircase') {
    const migrated =
      d.designType === 'zigzag-type' ? migrateZigzagTypeToCustom(d) : { ...d, designType: 'custom' as const }
    d = {
      ...d,
      designType: 'custom',
      dimensions: migrated.dimensions ?? d.dimensions,
      hardwareMode: 'staircase',
    }
  }
  if (!d.hardwareMode) {
    d = { ...d, hardwareMode: 'normal' }
  }
  d = ensureSegmentSupportFields(d)
  return ensureSegmentRailProfiles(
    ensureOTypeFourSides({
      ...d,
      finish: normalizeFinishSpecs(d.finish),
      packageRates: normalizePackageRates(d.packageRates),
      packageQuoteUnit: d.packageQuoteUnit ?? 'rft',
      customCharges: d.customCharges ?? [],
      applyHoleCharges: d.applyHoleCharges ?? false,
    }),
  )
}

function ensureSegmentRailProfiles(draft: DesignDraft): DesignDraft {
  return {
    ...draft,
    segmentConfigs: draft.segmentConfigs.map((c) => ({
      ...c,
      handrailProfile:
        (c as { handrailProfile?: string }).handrailProfile ?? draft.finish.handrailProfile,
      bottomRailProfile:
        (c as { bottomRailProfile?: string }).bottomRailProfile ??
        draft.finish.bottomRailProfile,
    })),
  }
}
