import type { DesignType, FinishSpecs, GlassOption } from './types'
import { defaultConfigFor } from './calculations'
import { defaultCustomDimensions } from './customSegments'

export const COMPANY = {
  name: 'WoodenMax Architectural Elements',
  gst: '36ARWPA9740L1Z3',
  address:
    '5-6-411/413, Aaghapura Nampally, Hyderabad 500001 — Near Aaghapura Circle',
  phone: '',
  email: 'info@woodenmax.com',
  website: 'www.woodenmax.in',
} as const

export const QUOTATION_BANK = {
  accountName: 'WoodenMax Architectural Elements',
  bankName: '—',
  accountNo: '—',
  ifsc: '—',
  branch: 'Hyderabad',
} as const

export const DEFAULT_QUOTE_INTRO =
  'Thank you for your enquiry. We are pleased to submit our quotation for glass railing systems as per your requirements. All measurements are in millimetres unless stated otherwise.'

/** Default ₹ per pillar/stud hole when “Add hole charges” is ticked. */
export const DEFAULT_HOLE_CHARGE_PER_PCS = 100

export const QUOTATION_TERMS = [
  'Rates are valid for 15 days from the date of this quotation unless otherwise agreed in writing.',
  'Prices are exclusive of civil work, core cutting, scaffolding, and statutory approvals unless specified.',
  'Glass as per approved thickness and finish; site measurements final at time of order.',
  'Payment terms as mutually agreed. GST @ 18% applicable on taxable value.',
  'Delivery / installation timeline to be confirmed upon receipt of advance and approved drawings.',
  'Any variation in scope or sizes will be quoted separately.',
] as const

export const DEFAULT_FINISH: FinishSpecs = {
  glassColor: 'Clear',
  hardwareColor: 'Brushed Stainless Steel',
  anchorSize: '12×100 mm',
  bottomRailProfile: 'Aluminium U channel',
  handrailProfile: 'SS round tube 50mm',
}

/** Preset handrail types — custom text allowed via "Other". */
export const HANDRAIL_PROFILE_OPTIONS: readonly string[] = [
  'SS round tube 50mm',
  'SS round tube 40mm',
  'SS square tube 40×40 mm',
  'SS flat bar 40×10 mm',
  'SS D-shape slotted tube 50mm',
  'Aluminium rectangular cap 100×45 mm',
  'Wooden hardwood cap rail',
  'Glass structural top cap',
] as const

export const BOTTOM_RAIL_PROFILE_OPTIONS: readonly string[] = [
  'Aluminium U channel',
  'Aluminium mini U channel',
  'SS U channel',
  'SS flat bottom channel',
  'Pillar only (no bottom rail)',
  'Concrete groove (no aluminium channel)',
] as const

export const PROFILE_OTHER = '__other__'

export const DESIGN_TYPES: {
  id: DesignType
  label: string
  labelHi: string
  description: string
}[] = [
  {
    id: 'straight',
    label: 'Straight',
    labelHi: 'सीधी',
    description: 'Single straight run',
  },
  {
    id: 'u-type',
    label: 'U Type',
    labelHi: 'U टाइप',
    description: 'Left + straight + right',
  },
  {
    id: 'o-type',
    label: 'O Type',
    labelHi: 'O टाइप',
    description: '4 sides — front, right, back, left (closed)',
  },
  {
    id: 'l-type',
    label: 'L Type',
    labelHi: 'L टाइप',
    description: '90° corner — 2 legs',
  },
  {
    id: 'balcony',
    label: 'Balcony',
    labelHi: 'बालकनी',
    description: 'Front + optional sides',
  },
  {
    id: 'custom',
    label: 'Custom path',
    labelHi: 'कस्टम',
    description: 'Bends & extra legs — choose Normal or Staircase hardware',
  },
]

/** Preset shapes (not custom) — always normal hardware. */
export const NORMAL_DESIGN_TYPES = DESIGN_TYPES.filter((t) => t.id !== 'custom')

export const GLASS_OPTIONS: GlassOption[] = [
  {
    id: '12-single',
    name: '12 mm Toughened (Single)',
    nameHi: '12 mm सिंगल',
    composition: '12 mm toughened glass',
    thicknessMm: 12,
  },
  {
    id: 'lam-11.52',
    name: 'Laminated 11.52 mm',
    nameHi: 'लैमिनेटेड 11.52 mm',
    composition: '5.76 mm + 0.76 mm PVB + 5.76 mm',
    thicknessMm: 11.52,
  },
  {
    id: 'lam-13.52',
    name: 'Laminated 13.52 mm',
    nameHi: 'लैमिनेटेड 13.52 mm',
    composition: '6 mm + 1.52 mm PVB + 6 mm',
    thicknessMm: 13.52,
  },
  {
    id: 'lam-17.52',
    name: 'Laminated 17.52 mm',
    nameHi: 'लैमिनेटेड 17.52 mm',
    composition: '8 mm + 1.52 mm PVB + 8 mm',
    thicknessMm: 17.52,
  },
  {
    id: 'lam-21.52',
    name: 'Laminated 21.52 mm',
    nameHi: 'लैमिनेटेड 21.52 mm',
    composition: '10 mm + 1.52 mm PVB + 10 mm',
    thicknessMm: 21.52,
  },
  {
    id: 'custom',
    name: 'Custom composition',
    nameHi: 'कस्टम ग्लास',
    composition: 'User defined',
    thicknessMm: 0,
  },
]

export function defaultSegmentConfigs(type: DesignType) {
  return defaultDimensions(type)
    .filter((d) => d.unit === 'mm')
    .map((d) => defaultConfigFor(d.key, d.label))
}

export function defaultDimensions(type: DesignType) {
  switch (type) {
    case 'straight':
      return [
        { key: 'length', label: 'Length', labelHi: 'लंबाई', unit: 'mm' as const, value: 3000 },
      ]
    case 'u-type':
      return [
        { key: 'left', label: 'Left side', labelHi: 'बायाँ', unit: 'mm' as const, value: 1500 },
        { key: 'straight', label: 'Straight (front)', labelHi: 'सामने सीधा', unit: 'mm' as const, value: 3000 },
        { key: 'right', label: 'Right side', labelHi: 'दायाँ', unit: 'mm' as const, value: 1500 },
      ]
    case 'o-type':
      return [
        { key: 'front', label: 'Front', labelHi: 'सामने', unit: 'mm' as const, value: 3500 },
        { key: 'right', label: 'Right side', labelHi: 'दायाँ', unit: 'mm' as const, value: 2000 },
        { key: 'back', label: 'Back', labelHi: 'पीछे', unit: 'mm' as const, value: 3500 },
        { key: 'left', label: 'Left side', labelHi: 'बायाँ', unit: 'mm' as const, value: 2000 },
      ]
    case 'l-type':
      return [
        { key: 'leg1', label: 'Leg 1 (side)', labelHi: 'साइड', unit: 'mm' as const, value: 1550 },
        { key: 'leg2', label: 'Leg 2 (front)', labelHi: 'सामने', unit: 'mm' as const, value: 3000 },
      ]
    case 'zigzag-type':
      return defaultCustomDimensions()
    case 'staircase':
      return [
        { key: 'run', label: 'Horizontal run', labelHi: 'हॉरिजॉन्टल', unit: 'mm' as const, value: 4000 },
        { key: 'rise', label: 'Total rise', labelHi: 'कुल ऊँचाई उठाव', unit: 'mm' as const, value: 1200 },
        { key: 'angle', label: 'Slope angle', labelHi: 'कोण', unit: 'deg' as const, value: 35 },
      ]
    case 'balcony':
      return [
        { key: 'front', label: 'Front length', labelHi: 'सामने', unit: 'mm' as const, value: 4000 },
        { key: 'left', label: 'Left side (0 if none)', labelHi: 'बायाँ', unit: 'mm' as const, value: 0 },
        { key: 'right', label: 'Right side (0 if none)', labelHi: 'दायाँ', unit: 'mm' as const, value: 0 },
      ]
    case 'custom':
      return defaultCustomDimensions()
  }
}

export function segmentHeightKeys(
  type: DesignType,
  dims: { key: string; label: string; unit: 'mm' | 'deg' }[],
) {
  if (type === 'staircase') {
    return [{ key: 'stair', label: 'Railing height along slope' }]
  }
  return dims.filter((d) => d.unit !== 'deg').map((d) => ({ key: d.key, label: d.label }))
}
