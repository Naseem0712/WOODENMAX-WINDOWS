import { migrateZigzagTypeToCustom } from './customSegments'
import { DEFAULT_PACKAGE_RATES } from './packagePricing'
import { ensureOTypeFourSides } from './oTypeMigrate'
import type { DesignDraft } from './types'

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
  return ensureSegmentRailProfiles(
    ensureOTypeFourSides({
      ...d,
      packageRates: d.packageRates ?? { ...DEFAULT_PACKAGE_RATES },
      packageQuoteUnit: d.packageQuoteUnit ?? 'sft',
      customCharges: d.customCharges ?? [],
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
