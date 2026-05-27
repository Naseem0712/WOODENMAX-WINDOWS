import { DEFAULT_FINISH } from './constants'
import type { FinishSpecs, HandrailMaterial, ProductSpec } from './types'

export const DEFAULT_PRODUCT_SPEC: ProductSpec = {
  name: '',
  color: '',
  size: '',
}

export function defaultBottomRailSpec(): ProductSpec {
  return {
    name: DEFAULT_FINISH.bottomRailProfile,
    color: 'Anodized silver',
    size: 'U channel',
  }
}

export function defaultPillarSpec(): ProductSpec {
  return {
    name: 'SS floor pillar',
    color: DEFAULT_FINISH.hardwareColor,
    size: '50 mm',
  }
}

export function defaultStudSpec(): ProductSpec {
  return {
    name: 'SS glass stud',
    color: DEFAULT_FINISH.hardwareColor,
    size: '19 mm',
  }
}

export function defaultHandrailSpec(material: HandrailMaterial): ProductSpec {
  if (material === 'aluminium') {
    return {
      name: 'Aluminium rectangular cap',
      color: 'Anodized silver',
      size: '100×45 mm',
    }
  }
  if (material === 'ss') {
    return {
      name: DEFAULT_FINISH.handrailProfile,
      color: 'Brushed stainless steel',
      size: '50 mm',
    }
  }
  return { ...DEFAULT_PRODUCT_SPEC }
}

export function finishWithHandrailMaterial(
  finish: FinishSpecs,
  material: HandrailMaterial,
): FinishSpecs {
  const handrailSpec = finish.handrailSpec ?? defaultHandrailSpec(material)
  const hardwareColorSameAsHandrail = finish.hardwareColorSameAsHandrail !== false
  return {
    ...finish,
    handrailMaterial: material,
    handrailSpec,
    hardwareColorSameAsHandrail,
    hardwareColor:
      hardwareColorSameAsHandrail && handrailSpec.color
        ? handrailSpec.color
        : finish.hardwareColor,
    handrailProfile:
      material === 'aluminium'
        ? handrailSpec.name || 'Aluminium rectangular cap 100×45 mm'
        : material === 'ss'
          ? handrailSpec.name || DEFAULT_FINISH.handrailProfile
          : finish.handrailProfile,
  }
}

export function normalizeFinishSpecs(finish: FinishSpecs): FinishSpecs {
  const material = finish.handrailMaterial ?? 'ss'
  return {
    ...finish,
    handrailMaterial: material,
    hardwareColorSameAsHandrail: finish.hardwareColorSameAsHandrail !== false,
    bottomRailSpec: finish.bottomRailSpec ?? defaultBottomRailSpec(),
    pillarSpec: finish.pillarSpec ?? defaultPillarSpec(),
    studSpec: finish.studSpec ?? defaultStudSpec(),
    handrailSpec: finish.handrailSpec ?? defaultHandrailSpec(material),
  }
}
