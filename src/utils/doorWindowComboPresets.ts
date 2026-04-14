import type { WindowConfig } from '../types';

export type DoorWindowComboPreset = {
  id: string;
  label: string;
  hint: string;
  panels: WindowConfig['partitionPanels'];
};

/** One-tap layouts: door + attached glazing (glass partition mode). User sets overall W×H in dimensions. */
export const DOOR_WINDOW_COMBO_PRESETS: DoorWindowComboPreset[] = [
  {
    id: 'door-hinged-fixed-7030',
    label: 'Door + fixed window (≈70% / 30%)',
    hint: 'Openable door leaf + fixed sidelight (common entrance combo).',
    panels: {
      count: 2,
      types: [{ type: 'hinged' }, { type: 'fixed' }],
      hasTopChannel: false,
      widthFractions: [7, 3],
    },
  },
  {
    id: 'door-hinged-sliding-7030',
    label: 'Door + sliding window (≈70% / 30%)',
    hint: 'Hinged door + sliding panel beside.',
    panels: {
      count: 2,
      types: [{ type: 'hinged' }, { type: 'sliding' }],
      hasTopChannel: false,
      widthFractions: [7, 3],
    },
  },
  {
    id: 'double-sliding-fixed-404020',
    label: 'Double sliding + fixed (≈40% / 40% / 20%)',
    hint: 'Two sliders + fixed glazing strip (e.g. large opening with sidelight).',
    panels: {
      count: 3,
      types: [{ type: 'sliding' }, { type: 'sliding' }, { type: 'fixed' }],
      hasTopChannel: false,
      widthFractions: [4, 4, 2],
    },
  },
  {
    id: 'shower-sliding-fixed-5050',
    label: 'Shower: sliding + fixed (50% / 50%)',
    hint: 'Typical bath enclosure — enable top/bottom channel below if needed.',
    panels: {
      count: 2,
      types: [{ type: 'sliding' }, { type: 'fixed' }],
      hasTopChannel: true,
      widthFractions: [1, 1],
    },
  },
  {
    id: 'fold-sliding-6040',
    label: 'Bi-fold + sliding (≈60% / 40%)',
    hint: 'Fold stack + sliding panel (stacking / open corner style).',
    panels: {
      count: 2,
      types: [{ type: 'fold' }, { type: 'sliding' }],
      hasTopChannel: false,
      widthFractions: [6, 4],
    },
  },
  {
    id: 'casement-pair-fixed-5050',
    label: 'Two openable + fixed centre (35% / 30% / 35%)',
    hint: 'Door + picture window + door style layout.',
    panels: {
      count: 3,
      types: [{ type: 'hinged' }, { type: 'fixed' }, { type: 'hinged' }],
      hasTopChannel: false,
      widthFractions: [3.5, 3, 3.5],
    },
  },
];
