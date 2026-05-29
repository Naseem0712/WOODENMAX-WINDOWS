import { createCustomSegment } from './customSegments'
import type { PathStartHeading, SegmentDim } from './types'

export interface CustomPathTemplate {
  id: string
  label: string
  hint: string
  pathStartHeading: PathStartHeading
  dimensions: SegmentDim[]
}

/** Ready-made multi-leg paths — edit mm values after loading. */
export const CUSTOM_PATH_TEMPLATES: CustomPathTemplate[] = [
  {
    id: 'wall-l',
    label: 'Wall L',
    hint: 'Bottom wall → up → turn → along top (2 legs)',
    pathStartHeading: 'north',
    dimensions: [
      createCustomSegment(1, { value: 6694, label: 'Wall leg (up)', bendMode: 'none' }),
      createCustomSegment(2, { value: 6585, label: 'Top run', bendMode: 'right-90' }),
    ],
  },
  {
    id: 'notched-long-run',
    label: 'Long run + notch',
    hint: 'Up wall leg, long top, rectangular notch bump, finish run (6 legs)',
    pathStartHeading: 'north',
    dimensions: [
      createCustomSegment(1, { value: 6865, label: 'Left wall (up)', bendMode: 'none' }),
      createCustomSegment(2, { value: 11500, label: 'Top run 1', bendMode: 'right-90' }),
      createCustomSegment(3, { value: 5100, label: 'Notch up', bendMode: 'left-90' }),
      createCustomSegment(4, { value: 4700, label: 'Notch across', bendMode: 'right-90' }),
      createCustomSegment(5, { value: 5100, label: 'Notch down', bendMode: 'right-90' }),
      createCustomSegment(6, { value: 11700, label: 'Top run 2', bendMode: 'left-90' }),
    ],
  },
  {
    id: 'wall-to-wall-notch',
    label: 'Wall ↔ wall + notch',
    hint: 'Left wall up, top with drop-in notch, right wall down (7 legs)',
    pathStartHeading: 'north',
    dimensions: [
      createCustomSegment(1, { value: 6694, label: 'Left wall (up)', bendMode: 'none' }),
      createCustomSegment(2, { value: 2018, label: 'Top before notch', bendMode: 'right-90' }),
      createCustomSegment(3, { value: 1900, label: 'Notch down', bendMode: 'right-90' }),
      createCustomSegment(4, { value: 4567, label: 'Notch across', bendMode: 'right-90' }),
      createCustomSegment(5, { value: 1900, label: 'Notch up', bendMode: 'left-90' }),
      createCustomSegment(6, { value: 1500, label: 'Top to corner', bendMode: 'right-90' }),
      createCustomSegment(7, { value: 6835, label: 'Right wall (down)', bendMode: 'right-90' }),
    ],
  },
  {
    id: 'u-open',
    label: 'Open U',
    hint: 'Up left, across, down right (3 legs)',
    pathStartHeading: 'north',
    dimensions: [
      createCustomSegment(1, { value: 1500, label: 'Left side', bendMode: 'none' }),
      createCustomSegment(2, { value: 3000, label: 'Front / top', bendMode: 'right-90' }),
      createCustomSegment(3, { value: 1500, label: 'Right side', bendMode: 'right-90' }),
    ],
  },
]

export function getCustomPathTemplate(id: string): CustomPathTemplate | undefined {
  return CUSTOM_PATH_TEMPLATES.find((t) => t.id === id)
}
