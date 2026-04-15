import type { MaterialRateSettings } from '../types';

export const DEFAULT_MATERIAL_RATES: MaterialRateSettings = {
  aluminiumProfilePerKg: 470,
  makingChargePerSqFt: 120,
  meshPerSqFt: 85,
  meshShutterOptions: {
    separateSections: false,
    meshClipPerMeshShutter: 1,
    meshClipLengthFt: 16,
    meshClipWeightKgPerPc: 1.5,
    meshClipPowderRatePerRft: 45,
  },
  profit: {
    mode: 'percentage',
    value: 15,
  },
  wastageCartagePerSqFt: 0,
  powderCoatingPerRft: {
    track: 55,
    shutterSections: 45,
    slimInterlock: 35,
  },
  glassPerSqFt: {
    clear: {
      '5': 90,
      '6': 105,
      '8': 120,
      '10': 140,
      '12': 165,
    },
    laminated: {
      '5+5': 380,
      '6+6': 465,
    },
    dgu: {
      '6+12+6': 340,
      '5+12+5': 290,
    },
  },
};
