import type { CostingRates, CostRateField, HardwareMode } from '../types'
import {
  displayRateForUnit,
  setStoredRate,
  rftRateToRmt,
  type RateUnit,
} from '../rateUnits'
import { quoteRailRft, totalRailMaterialRft } from '../railLength'
import { FT_PER_M } from '../units'

interface Props {
  rates: CostingRates
  onRatesChange: (r: CostingRates) => void
  bottomRailRft: number
  handrailRft: number
  glassAreaSft: number
  perimeterRmt: number
  hardwareMode?: HardwareMode
  connector90?: number
  connector180?: number
  wallConnectors?: number
  endCaps?: number
  totalPillars?: number
  totalStuds?: number
}

function RateInput({
  label,
  unit,
  value,
  onChange,
  hint,
}: {
  label: string
  unit: string
  value: number
  onChange: (n: number) => void
  hint?: string
}) {
  return (
    <label className="field unit-rate-field">
      <span>
        {label} <em>₹/{unit}</em>
      </span>
      <input
        type="number"
        min={0}
        step={unit === 'pcs' ? 1 : 0.01}
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <small className="ref">{hint}</small>}
    </label>
  )
}

export function UnitRateSections({
  rates,
  onRatesChange,
  bottomRailRft,
  handrailRft,
  glassAreaSft,
  perimeterRmt,
  hardwareMode = 'normal',
  connector90 = 0,
  connector180 = 0,
  wallConnectors = 0,
  endCaps = 0,
  totalPillars = 0,
  totalStuds = 0,
}: Props) {
  const set = (patch: Partial<CostingRates>) => onRatesChange({ ...rates, ...patch })

  const setField = (field: CostRateField, unit: RateUnit, value: number) => {
    onRatesChange(setStoredRate(rates, field, unit, value))
  }

  const runRft = quoteRailRft(perimeterRmt, bottomRailRft, handrailRft)
  const materialRailRft = totalRailMaterialRft(bottomRailRft, handrailRft)
  const runRmt = Math.round((runRft / FT_PER_M) * 1000) / 1000

  return (
    <div className="unit-rate-sections">
      <p className="section-desc unit-rate-intro">
        Rates in separate units — enter any column (SFT / RFT / RMT / pcs); amount stays in sync. This design:{' '}
        <strong>{glassAreaSft} SFT</strong> glass · <strong>{runRft} RFT</strong> perimeter run
        ({runRmt} RMT)
        {materialRailRft > runRft && (
          <>
            {' '}
            · <strong>{materialRailRft} RFT</strong> rail material (bottom + handrail)
          </>
        )}{' '}
        · <strong>{perimeterRmt} RMT</strong> path
      </p>

      <div className="unit-rate-block unit-sft">
        <h4>Per SFT (square feet)</h4>
        <RateInput
          label="Glass"
          unit="SFT"
          value={rates.glassPerSft}
          onChange={(n) => set({ glassPerSft: n })}
          hint={
            hardwareMode === 'staircase'
              ? `Staircase billed: ${glassAreaSft} SFT — (panel W + H) × H per piece`
              : `This design: ${glassAreaSft} SFT`
          }
        />
        {hardwareMode === 'staircase' && (
          <p className="ref">
            Each glass: (run width ÷ panels + height) × height. Glass ₹/RFT = glass cost ÷
            actual run length (mm→RFT).
          </p>
        )}
      </div>
      <p className="ref install-note">
        Material rates here are supply-only. Add <strong>installation / labour</strong> in the
        package rate section (Add to quote) or under Rates → Package defaults.
      </p>

      <div className="unit-rate-block unit-rft">
        <h4>Per RFT (running feet)</h4>
        <div className="unit-rate-grid">
          <RateInput
            label="Bottom rail"
            unit="RFT"
            value={
              rates.bottomRailRateMode === 'rft' ? rates.bottomRailRate : 0
            }
            onChange={(n) =>
              set({ bottomRailRate: n, bottomRailRateMode: 'rft' })
            }
            hint={bottomRailRft > 0 ? `${bottomRailRft} RFT on this design` : undefined}
          />
          <RateInput
            label="Handrail"
            unit="RFT"
            value={rates.handrailRateMode === 'rft' ? rates.handrailRate : 0}
            onChange={(n) => set({ handrailRate: n, handrailRateMode: 'rft' })}
            hint={handrailRft > 0 ? `${handrailRft} RFT` : undefined}
          />
        </div>
        {rates.bottomRailRateMode === 'kg' && (
          <label className="field">
            <span>Bottom rail ₹/KG + KG per RFT</span>
            <div className="rail-mode-row">
              <input
                type="number"
                value={rates.bottomRailRate || ''}
                onChange={(e) => set({ bottomRailRate: Number(e.target.value) })}
              />
              <input
                type="number"
                step={0.1}
                placeholder="kg/RFT"
                value={rates.bottomRailKgPerRft || ''}
                onChange={(e) => set({ bottomRailKgPerRft: Number(e.target.value) })}
              />
            </div>
          </label>
        )}
      </div>

      <div className="unit-rate-block unit-rmt">
        <h4>Per RMT (running metre)</h4>
        <div className="unit-rate-grid">
          <RateInput
            label="Bottom rail"
            unit="RMT"
            value={displayRateForUnit(rates, 'bottomRailRate', 'rmt')}
            onChange={(n) => setField('bottomRailRate', 'rmt', n)}
            hint={
              bottomRailRft > 0
                ? `${Math.round((bottomRailRft / FT_PER_M) * 100) / 100} RMT ≈ ${rftRateToRmt(rates.bottomRailRate)}/RMT ↔ ₹${rates.bottomRailRate}/RFT`
                : `₹${rftRateToRmt(rates.bottomRailRate)}/RMT if ₹${rates.bottomRailRate}/RFT`
            }
          />
          <RateInput
            label="Handrail"
            unit="RMT"
            value={displayRateForUnit(rates, 'handrailRate', 'rmt')}
            onChange={(n) => setField('handrailRate', 'rmt', n)}
            hint={
              handrailRft > 0
                ? `${Math.round((handrailRft / FT_PER_M) * 100) / 100} RMT`
                : undefined
            }
          />
        </div>
        <p className="ref rmt-sync-note">
          RMT rate change → RFT rate auto update (1 RMT = {FT_PER_M.toFixed(2)} RFT). Perimeter
          run: {perimeterRmt} RMT
        </p>
      </div>

      <div className="unit-rate-block unit-pcs">
        <h4>Per piece (PCS)</h4>
        {hardwareMode === 'staircase' && (
          <p className="ref">Staircase: 180° connectors not used on this type.</p>
        )}
        <div className="unit-rate-grid">
          <RateInput
            label="Pillar"
            unit="pcs"
            value={rates.pillarPerPcs}
            onChange={(n) => set({ pillarPerPcs: n })}
            hint={totalPillars > 0 ? `${totalPillars} pcs on this design` : undefined}
          />
          <RateInput
            label="Stud"
            unit="pcs"
            value={rates.studPerPcs}
            onChange={(n) => set({ studPerPcs: n })}
            hint={totalStuds > 0 ? `${totalStuds} pcs on this design` : undefined}
          />
          <RateInput
            label="90° connector"
            unit="pcs"
            value={rates.connector90PerPcs}
            onChange={(n) => set({ connector90PerPcs: n })}
            hint={connector90 > 0 ? `${connector90} pcs` : undefined}
          />
          {hardwareMode !== 'staircase' && (
            <RateInput
              label="180° connector"
              unit="pcs"
              value={rates.connector180PerPcs}
              onChange={(n) => set({ connector180PerPcs: n })}
              hint={connector180 > 0 ? `${connector180} pcs (rail splice)` : undefined}
            />
          )}
          <RateInput
            label="Wall connector"
            unit="pcs"
            value={rates.wallConnectorPerPcs}
            onChange={(n) => set({ wallConnectorPerPcs: n })}
            hint={wallConnectors > 0 ? `${wallConnectors} pcs` : undefined}
          />
          <RateInput
            label="End cap"
            unit="pcs"
            value={rates.endCapPerPcs}
            onChange={(n) => set({ endCapPerPcs: n })}
            hint={endCaps > 0 ? `${endCaps} pcs` : undefined}
          />
          <RateInput
            label="Anchor"
            unit="pcs"
            value={rates.anchorPerPcs}
            onChange={(n) => set({ anchorPerPcs: n })}
          />
          {(totalPillars > 0 || totalStuds > 0) && (
            <RateInput
              label="Hole drilling (per pillar/stud)"
              unit="hole"
              value={rates.holePerPcs}
              onChange={(n) => set({ holePerPcs: n })}
              hint={`${totalPillars + totalStuds} holes when “Add hole charges” is ticked on design`}
            />
          )}
        </div>
      </div>
    </div>
  )
}
