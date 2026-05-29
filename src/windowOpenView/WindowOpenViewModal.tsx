import React, { useMemo, useState } from 'react';
import type { WindowConfig } from '../types';
import { Button } from '../components/ui/Button';
import { computeOpenViewSpec } from './computeOpenViewSpec';
import { OpenViewElevation } from './OpenViewElevation';
import { PlanSchematic } from './planSchematic';
import { openViewKindLabel, supportsOpenView } from './supportsOpenView';
import type { DoorSwingSide } from './doorHingeLayout';
import './openView.css';

type Props = {
  config: WindowConfig;
  onClose: () => void;
};

/** Full-screen customer open view — separate module, does not modify main canvas. */
export const WindowOpenViewModal: React.FC<Props> = ({ config, onClose }) => {
  const [openAmount, setOpenAmount] = useState(1);
  const [swingSide, setSwingSide] = useState<DoorSwingSide>('outside');
  const canShow = supportsOpenView(config);
  const spec = useMemo(
    () => computeOpenViewSpec(config, openAmount, { swingSide }),
    [config, openAmount, swingSide],
  );

  return (
    <div className="wov-modal-backdrop no-print" role="dialog" aria-modal="true" aria-label="Customer open view">
      <header className="wov-modal-header">
        <div>
          <h2 className="text-lg font-semibold">Customer Open View</h2>
          <p className="text-xs text-slate-400">
            Shows how sliding, fold, or openable panels move — for customer clarity. Does not change your design.
          </p>
        </div>
        <Button onClick={onClose} variant="secondary">
          Close
        </Button>
      </header>

      <div className="wov-modal-body">
        {!canShow || !spec ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-6 text-center text-sm text-amber-100">
            Open view is available for sliding, casement/openable doors, ventilator doors, and operable glass partitions.
            Select a supported window type with valid series dimensions.
          </div>
        ) : (
          <>
            <div className="wov-slider-row flex-wrap">
              <span className="wov-badge">{openViewKindLabel(spec.kind)}</span>
              <label className="flex flex-col gap-1">
                <span>Swing</span>
                <select
                  value={swingSide}
                  onChange={(e) => setSwingSide(e.target.value as DoorSwingSide)}
                  className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-100"
                >
                  <option value="outside">Outside open</option>
                  <option value="inside">Inside open</option>
                </select>
              </label>
              <label className="flex min-w-[140px] flex-1 flex-col gap-1">
                <span>Open amount ({Math.round(openAmount * 100)}%) — C,D −20° top &amp; bottom</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(openAmount * 100)}
                  onChange={(e) => setOpenAmount(Number(e.target.value) / 100)}
                />
              </label>
              <button
                type="button"
                className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-600"
                onClick={() => setOpenAmount(openAmount >= 0.99 ? 0 : 1)}
              >
                {openAmount >= 0.99 ? 'Closed' : 'Fully open'}
              </button>
            </div>

            <p className="text-center text-xs text-slate-400">{spec.operationLabel}</p>

            <div className="wov-preview-card">
              <div className="wov-dual-view">
                <OpenViewElevation spec={spec} openAmount={openAmount} variant="canvas" maxWidthPx={480} />
                <PlanSchematic spec={spec} variant="canvas" widthPx={480} swingSide={swingSide} openAmount={openAmount} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
