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
    id: 'fold-sliding-2plus1-6040',
    label: '2+1 — Bi-fold (2) + sliding (1)',
    hint: 'Three equal door widths — two fold leaves + one frame-hung open panel.',
    panels: {
      count: 2,
      types: [{ type: 'fold', foldLeafCount: 2 }, { type: 'sliding' }],
      hasTopChannel: false,
      widthFractions: [2, 1],
    },
  },
  {
    id: 'fold-sliding-3plus1-6040',
    label: '3+1 — Bi-fold (3) + sliding (1)',
    hint: 'Four equal door widths — three fold leaves + one frame-hung panel.',
    panels: {
      count: 2,
      types: [{ type: 'fold', foldLeafCount: 3 }, { type: 'sliding' }],
      hasTopChannel: false,
      widthFractions: [3, 1],
    },
  },
  {
    id: 'fold-sliding-4plus1-6040',
    label: '4+1 — Bi-fold (4) + sliding (1)',
    hint: 'Five equal door widths — four fold leaves + one frame-hung panel.',
    panels: {
      count: 2,
      types: [{ type: 'fold', foldLeafCount: 4 }, { type: 'sliding' }],
      hasTopChannel: false,
      widthFractions: [4, 1],
    },
  },
  {
    id: 'fold-sliding-5plus1-6040',
    label: '5+1 — Bi-fold (5) + sliding (1)',
    hint: 'Six equal door widths — five fold leaves + one frame-hung panel.',
    panels: {
      count: 2,
      types: [{ type: 'fold', foldLeafCount: 5 }, { type: 'sliding' }],
      hasTopChannel: false,
      widthFractions: [5, 1],
    },
  },
  {
    id: 'fold-sliding-1plus2-4060',
    label: '1+2 — Sliding (1) + Bi-fold (2)',
    hint: 'Three equal door widths — one frame-hung + two fold leaves.',
    panels: {
      count: 2,
      types: [{ type: 'sliding' }, { type: 'fold', foldLeafCount: 2 }],
      hasTopChannel: false,
      widthFractions: [1, 2],
    },
  },
  {
    id: 'fold-sliding-1plus3-4060',
    label: '1+3 — Sliding (1) + Bi-fold (3)',
    hint: 'Four equal door widths — one frame-hung + three fold leaves.',
    panels: {
      count: 2,
      types: [{ type: 'sliding' }, { type: 'fold', foldLeafCount: 3 }],
      hasTopChannel: false,
      widthFractions: [1, 3],
    },
  },
  {
    id: 'fold-sliding-1plus4-4060',
    label: '1+4 — Sliding (1) + Bi-fold (4)',
    hint: 'Five equal door widths — one frame-hung + four fold leaves.',
    panels: {
      count: 2,
      types: [{ type: 'sliding' }, { type: 'fold', foldLeafCount: 4 }],
      hasTopChannel: false,
      widthFractions: [1, 4],
    },
  },
  {
    id: 'fold-sliding-1plus5-4060',
    label: '1+5 — Sliding (1) + Bi-fold (5)',
    hint: 'Six equal door widths — one frame-hung + five fold leaves.',
    panels: {
      count: 2,
      types: [{ type: 'sliding' }, { type: 'fold', foldLeafCount: 5 }],
      hasTopChannel: false,
      widthFractions: [1, 5],
    },
  },
  {
    id: 'fold-center-2plus2-5050',
    label: '2+2 — Center opening (fold ×2 each side)',
    hint: 'Four equal door widths — two fold leaves each side; centre opening.',
    panels: {
      count: 2,
      types: [{ type: 'fold', foldLeafCount: 2 }, { type: 'fold', foldLeafCount: 2 }],
      hasTopChannel: false,
      widthFractions: [1, 1],
    },
  },
  {
    id: 'fold-center-3plus3-5050',
    label: '3+3 — Center opening (fold ×3 each side)',
    hint: 'Six equal door widths — three fold leaves each side; centre opening.',
    panels: {
      count: 2,
      types: [{ type: 'fold', foldLeafCount: 3 }, { type: 'fold', foldLeafCount: 3 }],
      hasTopChannel: false,
      widthFractions: [1, 1],
    },
  },
  {
    id: 'fold-sliding-6040',
    label: 'Bi-fold + sliding (2+1 equal doors)',
    hint: 'Same as 2+1 — three equal door widths.',
    panels: {
      count: 2,
      types: [{ type: 'fold', foldLeafCount: 2 }, { type: 'sliding' }],
      hasTopChannel: false,
      widthFractions: [2, 1],
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
