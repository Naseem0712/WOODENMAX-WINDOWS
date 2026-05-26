import type { DesignDraft } from './types'

export function activeSegmentConfigs(draft: DesignDraft) {
  return draft.segmentConfigs.filter((c) => {
    const dim = draft.dimensions.find((d) => d.key === c.key)
    return dim && dim.unit === 'mm' && dim.value > 0
  })
}

function effectiveProfile(
  cfg: { handrailProfile?: string; bottomRailProfile?: string },
  field: 'handrailProfile' | 'bottomRailProfile',
  finishDefault: string,
): string {
  return cfg[field]?.trim() || finishDefault.trim()
}

export function uniqueProfiles(
  configs: { handrailProfile?: string; bottomRailProfile?: string }[],
  field: 'handrailProfile' | 'bottomRailProfile',
  finishDefault = '',
): string[] {
  const set = new Set<string>()
  for (const c of configs) {
    const v = effectiveProfile(c, field, finishDefault)
    if (v) set.add(v)
  }
  return [...set]
}

export function formatHandrailSpec(
  draft: DesignDraft,
  includeHandrail: boolean,
): string | null {
  if (!includeHandrail) return null
  const legs = activeSegmentConfigs(draft)
  const finishDefault = draft.finish.handrailProfile
  const types = uniqueProfiles(legs, 'handrailProfile', finishDefault)
  if (types.length === 0) return finishDefault || null
  if (types.length === 1) return types[0]
  return types
    .map((t) => {
      const labels = legs
        .filter((l) => effectiveProfile(l, 'handrailProfile', finishDefault) === t)
        .map((l) => l.label)
        .join(', ')
      return `${t} (${labels})`
    })
    .join(' · ')
}

export function formatBottomRailSpec(
  draft: DesignDraft,
  bottomFixing: DesignDraft['bottomFixing'],
): string | null {
  if (bottomFixing !== 'continuous-rail') return null
  const legs = activeSegmentConfigs(draft)
  const finishDefault = draft.finish.bottomRailProfile
  const types = uniqueProfiles(legs, 'bottomRailProfile', finishDefault)
  if (types.length === 0) return finishDefault || null
  if (types.length === 1) return types[0]
  return types
    .map((t) => {
      const labels = legs
        .filter((l) => effectiveProfile(l, 'bottomRailProfile', finishDefault) === t)
        .map((l) => l.label)
        .join(', ')
      return `${t} (${labels})`
    })
    .join(' · ')
}

export function hardwareProfilesSummary(draft: DesignDraft): {
  handrail: string | null
  bottomRail: string | null
} {
  return {
    handrail: formatHandrailSpec(draft, draft.includeHandrail),
    bottomRail: formatBottomRailSpec(draft, draft.bottomFixing),
  }
}
