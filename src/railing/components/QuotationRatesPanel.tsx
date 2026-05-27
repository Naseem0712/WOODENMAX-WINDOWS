import { useMemo, useState } from 'react'
import { calculateCosting } from '../costing'
import type { QuotationPresets } from '../modePreset'
import type { CostingRates, DesignDraft, HardwareMode, RateDisplayUnit } from '../types'
import { formatCurrency } from '../utils'
import { presetFromDraft } from '../presets'
import { QuotationSetupSection } from './QuotationSetupSection'
import { SetRatesDisplay } from './SetRatesDisplay'
import { UnitRateSections } from './UnitRateSections'

interface Props {
  draft: DesignDraft
  presets: QuotationPresets
  ratesNormal: CostingRates
  ratesStaircase: CostingRates
  onPresetsChange: (presets: QuotationPresets) => void
  onRatesNormalChange: (r: CostingRates) => void
  onRatesStaircaseChange: (r: CostingRates) => void
  onSaveAll: () => void
  onApplyModeToDraft: (mode: HardwareMode, applyExtras: boolean) => void
  prefsSaved: boolean
  lineCount: number
}

export function QuotationRatesPanel({
  draft,
  presets,
  ratesNormal,
  ratesStaircase,
  onPresetsChange,
  onRatesNormalChange,
  onRatesStaircaseChange,
  onSaveAll,
  onApplyModeToDraft,
  prefsSaved,
  lineCount,
}: Props) {
  const [editMode, setEditMode] = useState<HardwareMode>('normal')
  const [applyExtrasOnApply, setApplyExtrasOnApply] = useState(false)

  const activeRates = editMode === 'staircase' ? ratesStaircase : ratesNormal
  const breakdown = useMemo(
    () => calculateCosting(draft, activeRates),
    [draft, activeRates],
  )

  const setRates = (patch: Partial<CostingRates>) => {
    if (editMode === 'staircase') {
      onRatesStaircaseChange({ ...ratesStaircase, ...patch })
    } else {
      onRatesNormalChange({ ...ratesNormal, ...patch })
    }
  }

  const patchPreset = (mode: HardwareMode, preset: QuotationPresets[typeof mode]) => {
    onPresetsChange({ ...presets, [mode]: preset })
  }

  const captureCurrentToTab = () => {
    patchPreset(editMode, presetFromDraft(draft))
  }

  return (
    <div className="quotation-rates-panel">
      <div className="quotation-rates-head">
        <p className="hint">
          <strong>Normal</strong> aur <strong>Staircase</strong> alag save — quotation mein har
          item apne type ke hisaab se update hoga.
        </p>
        <button type="button" className="btn-save-rates" onClick={onSaveAll}>
          Save both presets {prefsSaved && '✓'}
        </button>
      </div>

      <div className="toggle-row preset-mode-tabs">
        <span className="toggle-label">Edit preset:</span>
        {(
          [
            ['normal', 'Normal railing'],
            ['staircase', 'Staircase railing'],
          ] as [HardwareMode, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={editMode === id ? 'toggle active' : 'toggle'}
            onClick={() => setEditMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="preset-apply-row">
        <button type="button" className="btn-ghost" onClick={captureCurrentToTab}>
          Copy current design → {editMode} tab
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onApplyModeToDraft(editMode, applyExtrasOnApply)}
        >
          Apply {editMode} to this design
        </button>
        <label className="check-inline">
          <input
            type="checkbox"
            checked={applyExtrasOnApply}
            onChange={(e) => setApplyExtrasOnApply(e.target.checked)}
          />
          Include preset extras
        </label>
      </div>

      <QuotationSetupSection
        mode={editMode}
        preset={presets[editMode]}
        onChange={(p) => patchPreset(editMode, p)}
      />

      <hr className="drawer-divider" />

      <h3 className="setup-title">
        Material rates — {editMode === 'staircase' ? 'Staircase' : 'Normal'} (internal costing)
      </h3>

      <div className="toggle-row">
        <span className="toggle-label">Quote line unit:</span>
        {(['sft', 'rft', 'rmt'] as RateDisplayUnit[]).map((u) => (
          <button
            key={u}
            type="button"
            className={activeRates.quoteDisplayUnit === u ? 'toggle active' : 'toggle'}
            onClick={() => setRates({ quoteDisplayUnit: u })}
          >
            Per {u.toUpperCase()}
          </button>
        ))}
      </div>

      <UnitRateSections
        rates={activeRates}
        onRatesChange={(r) => {
          if (editMode === 'staircase') onRatesStaircaseChange(r)
          else onRatesNormalChange(r)
        }}
        glassAreaSft={breakdown.glassAreaSft}
        bottomRailRft={breakdown.bottomRailRft}
        handrailRft={breakdown.handrailRft}
        perimeterRmt={breakdown.perimeterRmt}
        hardwareMode={editMode}
        connector90={breakdown.design.hardware.connector90}
        connector180={breakdown.design.hardware.connector180}
        wallConnectors={breakdown.design.hardware.wallConnectors}
        endCaps={breakdown.design.hardware.endCaps}
        totalPillars={breakdown.design.hardware.totalPillars}
        totalStuds={breakdown.design.hardware.totalStuds}
      />

      <SetRatesDisplay
        breakdown={breakdown}
        quantity={draft.quantity}
        highlightUnit={activeRates.quoteDisplayUnit}
      />

      <h4 className="cost-breakdown-title">Expected amount (this design × {editMode} rates)</h4>
      <div className="table-scroll">
        <table className="cost-table quotation-amount-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate ₹</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.items.map((row, i) => (
              <tr key={i} className={row.amount > 0 ? '' : 'muted-row'}>
                <td>{row.label}</td>
                <td>
                  {row.qty} {row.unit}
                </td>
                <td>{row.rate > 0 ? row.rate : '—'}</td>
                <td>{row.amount > 0 ? formatCurrency(row.amount) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>
                <strong>Subtotal (1 set)</strong>
              </td>
              <td>
                <strong>{formatCurrency(breakdown.subtotal)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {lineCount > 0 && (
        <p className="hint">
          Save updates {lineCount} quotation item(s) — Normal lines get Normal preset/rates,
          Staircase lines get Staircase (extras only if preset extras are set on that mode).
        </p>
      )}
    </div>
  )
}
