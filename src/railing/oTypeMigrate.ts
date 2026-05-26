import { defaultDimensions, segmentHeightKeys } from './constants'
import { syncSegmentConfigs } from './calculations'
import type { DesignDraft } from './types'

/** Old O-type had 3 sides (no back). Add back side and keep saved measurements. */
export function ensureOTypeFourSides(draft: DesignDraft): DesignDraft {
  if (draft.designType !== 'o-type') return draft
  if (draft.dimensions.some((d) => d.key === 'back')) return draft

  const defs = defaultDimensions('o-type')
  const front = draft.dimensions.find((d) => d.key === 'front')
  const left = draft.dimensions.find((d) => d.key === 'left')
  const right = draft.dimensions.find((d) => d.key === 'right')
  const backDefault = defs.find((d) => d.key === 'back')!.value

  const dimensions = defs.map((d) => {
    if (d.key === 'front') return { ...d, value: front?.value ?? d.value }
    if (d.key === 'left') return { ...d, value: left?.value ?? d.value }
    if (d.key === 'right') return { ...d, value: right?.value ?? d.value }
    if (d.key === 'back') return { ...d, value: front?.value ?? backDefault }
    return d
  })

  const keys = segmentHeightKeys('o-type', dimensions)
  const segmentHeights = keys.map((k) => {
    const h = draft.segmentHeights.find((x) => x.key === k.key)
    return h ?? { ...k, value: draft.uniformHeight }
  })

  const next: DesignDraft = {
    ...draft,
    dimensions,
    segmentHeights,
    segmentConfigs: syncSegmentConfigs({ ...draft, dimensions }),
  }
  return next
}
