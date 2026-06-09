import React, { useEffect, useMemo, useState } from 'react';
import type { DesignLayoutActiveUnit, DesignLayoutCrossAlign, DesignLayoutSide, DesignLayoutUnit } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { DimensionInput } from './ui/DimensionInput';
import { CollapsibleCard } from './ui/CollapsibleCard';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import {
  applyAppearanceFromPrimary,
  crossAlignLabel,
  lastLayoutUnitId,
  layoutAnchorOptions,
  newLayoutUnitFromConfig,
} from '../utils/designLayout';

type Props = {
  primaryTitle: string;
  activeUnitId: DesignLayoutActiveUnit;
  companions: DesignLayoutUnit[];
  getUnitConfig: (id: DesignLayoutActiveUnit) => import('../types').WindowConfig;
  onActiveUnitChange: (id: DesignLayoutActiveUnit) => void;
  onAddUnits: (units: DesignLayoutUnit[]) => void;
  onRemoveUnit: (id: string) => void;
  onUpdateUnit: (id: string, partial: Partial<DesignLayoutUnit>) => void;
  onSaveAllToQuotation?: () => void;
};

const SIDE_OPTIONS: { value: DesignLayoutSide; label: string; short: string }[] = [
  { value: 'left', label: 'Left', short: '← Left' },
  { value: 'right', label: 'Right', short: 'Right →' },
  { value: 'top', label: 'Upar', short: '↑ Upar' },
  { value: 'bottom', label: 'Neeche', short: '↓ Neeche' },
];

export const DesignLayoutPanel: React.FC<Props> = ({
  primaryTitle,
  activeUnitId,
  companions,
  getUnitConfig,
  onActiveUnitChange,
  onAddUnits,
  onRemoveUnit,
  onUpdateUnit,
  onSaveAllToQuotation,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [copyCount, setCopyCount] = useState(1);
  const [attachToId, setAttachToId] = useState<DesignLayoutActiveUnit>('primary');
  const [attachSide, setAttachSide] = useState<DesignLayoutSide>('right');
  const [newUnitCrossAlign, setNewUnitCrossAlign] = useState<DesignLayoutCrossAlign>('top');

  useEffect(() => {
    if (companions.length > 0) setIsOpen(true);
  }, [companions.length]);

  useEffect(() => {
    const lastId = lastLayoutUnitId(companions);
    setAttachToId(lastId);
  }, [companions.length, companions[companions.length - 1]?.id]);

  const primaryConfig = getUnitConfig('primary');

  const attachTargetOptions = useMemo(
    () => layoutAnchorOptions(primaryTitle, companions, companions.length),
    [companions, primaryTitle],
  );

  useEffect(() => {
    if (!attachTargetOptions.some((o) => o.id === attachToId)) {
      setAttachToId(attachTargetOptions[attachTargetOptions.length - 1]?.id ?? 'primary');
    }
  }, [attachTargetOptions, attachToId]);

  const handleAddCopies = () => {
    const count = Math.max(1, Math.min(12, copyCount));
    const sourceConfig = getUnitConfig(attachToId);
    const base = applyAppearanceFromPrimary(primaryConfig, sourceConfig);
    const units: DesignLayoutUnit[] = [];
    let anchorId = attachToId;
    const startIndex = companions.length;

    for (let i = 0; i < count; i++) {
      const unit = newLayoutUnitFromConfig(
        base,
        startIndex + i,
        primaryTitle || 'Window 1',
        anchorId,
        attachSide,
        newUnitCrossAlign,
      );
      units.push(unit);
      anchorId = unit.id;
    }
    onAddUnits(units);
  };

  const activeCompanion = companions.find((c) => c.id === activeUnitId);

  return (
    <CollapsibleCard
      title="Multi-window layout"
      isOpen={isOpen}
      onToggle={() => setIsOpen((v) => !v)}
    >
      <p className="mb-2 text-[11px] leading-snug text-slate-400">
        <strong className="text-slate-200">Step 1:</strong> Window 1 design karein.
        <strong className="ml-1 text-slate-200">Step 2:</strong> Copy apply karein.
        <strong className="ml-1 text-slate-200">Step 3:</strong> Unit select karke size / design / position set karein.
        Copy = canvas jaisa poora design (size, grid, doors, arch). Frame/colour/glass Window 1 se sync.
        Neeche har unit ki position: top / center / bottom ya custom mm offset.
      </p>

      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Select window</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onActiveUnitChange('primary')}
          className={`min-w-[2.5rem] rounded-md border px-2.5 py-1.5 text-xs font-bold ${
            activeUnitId === 'primary'
              ? 'border-indigo-400 bg-indigo-600 text-white'
              : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
          }`}
        >
          1
        </button>
        {companions.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onActiveUnitChange(c.id)}
            className={`min-w-[2.5rem] rounded-md border px-2.5 py-1.5 text-xs font-bold ${
              activeUnitId === c.id
                ? 'border-indigo-400 bg-indigo-600 text-white'
                : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
            }`}
          >
            {i + 2}
          </button>
        ))}
      </div>
      <p className="mb-3 text-[10px] text-slate-500">
        Ab selected:{' '}
        <strong className="text-slate-300">
          {activeUnitId === 'primary' ? primaryTitle || 'Window 1' : activeCompanion?.title ?? 'Unit'}
        </strong>
        {' — '}neeche saare Configure options isi par lagenge
      </p>

      <div className="mb-3 rounded border border-indigo-500/40 bg-indigo-950/30 p-3">
        <p className="mb-2 text-xs font-semibold text-indigo-200">Window 1 ki copy apply karein</p>

        <div className="mb-2 grid grid-cols-2 gap-2">
          <Input
            id="layout-copy-count"
            label="Kitni copies"
            type="number"
            min={1}
            max={12}
            value={copyCount}
            onChange={(e) => setCopyCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            className="!py-1 text-xs"
          />
          <Select
            id="layout-attach-to"
            label="Chipkayein kis se"
            value={attachToId}
            onChange={(e) => setAttachToId(e.target.value as DesignLayoutActiveUnit)}
          >
            {attachTargetOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <p className="mb-1 text-[10px] font-medium text-slate-400">Kis taraf</p>
        <div className="grid grid-cols-2 gap-1.5">
          {SIDE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setAttachSide(o.value)}
              className={`rounded border px-2 py-2 text-xs font-semibold ${
                attachSide === o.value
                  ? 'border-indigo-400 bg-indigo-600 text-white'
                  : 'border-slate-600 bg-slate-800 text-slate-300'
              }`}
            >
              {o.short}
            </button>
          ))}
        </div>

        <Select
          id="layout-new-cross-align"
          label="Vertical align (nayi copies)"
          value={newUnitCrossAlign}
          onChange={(e) => setNewUnitCrossAlign(e.target.value as DesignLayoutCrossAlign)}
          className="mt-2 !bg-slate-900 !py-1.5 !text-xs"
        >
          <option value="top">Top align (upar se chipka)</option>
          <option value="center">Center align (beech)</option>
          <option value="bottom">Bottom align (neeche se)</option>
        </Select>

        <Button type="button" variant="secondary" className="mt-3 w-full text-xs" onClick={handleAddCopies}>
          <PlusIcon className="mr-1.5 h-4 w-4" /> Add {copyCount} copy / copies
        </Button>
      </div>

      {companions.map((c, i) => {
        const anchors = layoutAnchorOptions(primaryTitle, companions, i);
        const alignLabels = crossAlignLabel(c.side ?? 'right');
        const hasCustomOffset = c.crossOffsetMm !== '' && c.crossOffsetMm !== undefined;

        return (
          <div key={c.id} className="mb-3 rounded border border-slate-600/80 bg-slate-800/50 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">
                {i + 2}. {c.title}
              </span>
              <button
                type="button"
                onClick={() => onRemoveUnit(c.id)}
                className="rounded px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-slate-700"
              >
                <TrashIcon className="mr-1 inline h-3.5 w-3.5" /> Remove
              </button>
            </div>

            <Input
              id={`layout-title-${c.id}`}
              label="Label"
              value={c.title}
              onChange={(e) => onUpdateUnit(c.id, { title: e.target.value })}
              className="!py-1 text-xs"
            />

            <p className="mt-1 text-[10px] text-slate-500">
              Size: {Number(c.config.width) || 0} × {Number(c.config.height) || 0} mm
            </p>

            <Input
              id={`layout-rate-${c.id}`}
              label="Rate (₹/unit area — khali = global rate)"
              type="number"
              inputMode="decimal"
              placeholder="Same as quotation"
              value={c.rate ?? ''}
              onChange={(e) =>
                onUpdateUnit(c.id, {
                  rate: e.target.value === '' ? '' : Number(e.target.value) || 0,
                })
              }
              className="mt-2 !py-1 text-xs"
            />

            <div className="mt-3 border-t border-slate-700 pt-2">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Position</p>
              <div className="grid grid-cols-2 gap-1.5">
                {SIDE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onUpdateUnit(c.id, { side: o.value })}
                    className={`rounded border px-1.5 py-1.5 text-[10px] font-semibold ${
                      (c.side ?? 'right') === o.value
                        ? 'border-sky-500 bg-sky-800 text-white'
                        : 'border-slate-600 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {o.short}
                  </button>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Select
                  id={`layout-anchor-${c.id}`}
                  label="Anchor"
                  value={c.anchorUnitId ?? 'primary'}
                  onChange={(e) => onUpdateUnit(c.id, { anchorUnitId: e.target.value as DesignLayoutActiveUnit })}
                >
                  {anchors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
                <DimensionInput
                  id={`layout-gap-${c.id}`}
                  label="Gap mm (0=chipka)"
                  value_mm={c.gapMm ?? 0}
                  onChange_mm={(v) => onUpdateUnit(c.id, { gapMm: Number(v) || 0 })}
                />
              </div>

              <Select
                id={`layout-align-${c.id}`}
                label={alignLabels.axis}
                value={hasCustomOffset ? 'custom' : (c.crossAlign ?? 'top')}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'custom') {
                    onUpdateUnit(c.id, { crossOffsetMm: 0 });
                  } else {
                    onUpdateUnit(c.id, {
                      crossAlign: v as DesignLayoutCrossAlign,
                      crossOffsetMm: '',
                    });
                  }
                }}
                className="mt-2"
              >
                <option value="top">{alignLabels.top}</option>
                <option value="center">{alignLabels.center}</option>
                <option value="bottom">{alignLabels.bottom}</option>
                <option value="custom">Custom mm</option>
              </Select>

              {hasCustomOffset ? (
                <DimensionInput
                  id={`layout-offset-${c.id}`}
                  label="Offset mm"
                  value_mm={c.crossOffsetMm ?? 0}
                  onChange_mm={(v) => onUpdateUnit(c.id, { crossOffsetMm: v })}
                  className="mt-2"
                />
              ) : null}
            </div>
          </div>
        );
      })}

      {companions.length === 0 ? (
        <p className="text-[10px] text-slate-500">Sirf Window 1. Upar se copies add karein.</p>
      ) : (
        onSaveAllToQuotation ? (
          <Button type="button" variant="secondary" className="mt-2 w-full text-xs" onClick={onSaveAllToQuotation}>
            Save façade package to quotation
          </Button>
        ) : null
      )}
    </CollapsibleCard>
  );
};
