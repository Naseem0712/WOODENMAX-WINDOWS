import React, { useMemo } from 'react';
import type { WindowConfig } from '../types';
import { computeOpenViewSpec } from './computeOpenViewSpec';
import { PlanSchematic } from './planSchematic';
import { supportsOpenView } from './supportsOpenView';
import type { DoorSwingSide } from './doorHingeLayout';
import './openView.css';

type Props = {
  config: WindowConfig;
  /** 0–1 open amount for plan (default 50%) */
  openAmount?: number;
  swingSide?: DoorSwingSide;
  /** Smaller plan for package print secondary slot */
  compact?: boolean;
};

/** Plan-only print block — main elevation comes from PrintableWindow (canvas design). */
export const OpenViewPrintBlock: React.FC<Props> = ({
  config,
  openAmount = 0.5,
  swingSide = 'outside',
  compact = false,
}) => {
  const spec = useMemo(
    () => computeOpenViewSpec(config, openAmount, { swingSide }),
    [config, openAmount, swingSide],
  );

  if (!supportsOpenView(config) || !spec) return null;

  return (
    <div className="wov-print-block wov-print-plan-only">
      <PlanSchematic
        spec={spec}
        variant="print"
        widthPx={compact ? 54 : 130}
        swingSide={swingSide}
        openAmount={openAmount}
      />
    </div>
  );
};
