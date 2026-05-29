import React from 'react';
import type { DesignLayoutActiveUnit, DesignLayoutUnit, WindowConfig } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { CollapsibleCard } from './ui/CollapsibleCard';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { newLayoutUnitFromConfig } from '../utils/designLayout';

type Props = {
  primaryTitle: string;
  activeUnitId: DesignLayoutActiveUnit;
  companions: DesignLayoutUnit[];
  onActiveUnitChange: (id: DesignLayoutActiveUnit) => void;
  onAddUnit: (unit: DesignLayoutUnit) => void;
  onRemoveUnit: (id: string) => void;
  onUpdateUnit: (id: string, partial: Partial<DesignLayoutUnit>) => void;
  currentConfig: WindowConfig;
};

export const DesignLayoutPanel: React.FC<Props> = ({
  primaryTitle,
  activeUnitId,
  companions,
  onActiveUnitChange,
  onAddUnit,
  onRemoveUnit,
  onUpdateUnit,
  currentConfig,
}) => {
  const handleAdd = () => {
    onAddUnit(newLayoutUnitFromConfig(currentConfig, companions.length + 1));
  };

  return (
    <CollapsibleCard title="Multi-window layout" defaultOpen={companions.length > 0}>
      <p className="mb-2 text-[11px] leading-snug text-slate-400">
        Add windows beside the main unit. Set gap and level offset (0 = align tops). Switch unit to edit each design.
      </p>

      <label className="mb-2 block text-xs font-medium text-slate-300">
        Editing unit
        <select
          value={activeUnitId}
          onChange={(e) => onActiveUnitChange(e.target.value as DesignLayoutActiveUnit)}
          className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
        >
          <option value="primary">{primaryTitle || 'Window 1'} (primary)</option>
          {companions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>

      <Button type="button" variant="secondary" className="mb-3 w-full text-xs" onClick={handleAdd}>
        <PlusIcon className="mr-1.5 h-4 w-4" /> Add window unit
      </Button>

      {companions.map((c, i) => (
        <div key={c.id} className="mb-3 rounded border border-slate-600/80 bg-slate-800/50 p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">{c.title}</span>
            <button
              type="button"
              onClick={() => onRemoveUnit(c.id)}
              className="rounded p-1 text-red-400 hover:bg-slate-700"
              aria-label={`Remove ${c.title}`}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
          <Input
            id={`layout-title-${c.id}`}
            label="Label"
            value={c.title}
            onChange={(e) => onUpdateUnit(c.id, { title: e.target.value })}
            className="!py-1 text-xs"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input
              id={`layout-gap-${c.id}`}
              label="Gap from prev (mm)"
              type="number"
              value={c.gapFromPrevMm}
              onChange={(e) => onUpdateUnit(c.id, { gapFromPrevMm: Number(e.target.value) || 0 })}
              className="!py-1 text-xs"
            />
            <Input
              id={`layout-top-${c.id}`}
              label="Top offset vs W1 (mm)"
              type="number"
              value={c.offsetTopFromPrimaryMm}
              onChange={(e) => onUpdateUnit(c.id, { offsetTopFromPrimaryMm: Number(e.target.value) || 0 })}
              className="!py-1 text-xs"
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            Size: {Number(c.config.width) || 0} × {Number(c.config.height) || 0} mm — select unit above to edit design
          </p>
          {activeUnitId === c.id ? (
            <p className="mt-1 text-[10px] font-semibold text-indigo-300">Currently editing in canvas</p>
          ) : (
            <button
              type="button"
              className="mt-1 text-[10px] font-semibold text-indigo-400 underline"
              onClick={() => onActiveUnitChange(c.id)}
            >
              Edit this unit
            </button>
          )}
        </div>
      ))}

      {companions.length === 0 ? (
        <p className="text-[10px] text-slate-500">No extra units yet. Primary window only.</p>
      ) : null}
    </CollapsibleCard>
  );
};
