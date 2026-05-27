import { DEFAULT_PACKAGE_RATES, packageMaterialKey } from '../packagePricing'
import type { ModePreset } from '../modePreset'
import type { HardwareMode, RateDisplayUnit } from '../types'
import { CustomChargesEditor } from './CustomChargesEditor'
import { HardwareConfigFields } from './HardwareConfigFields'

interface Props {
  mode: HardwareMode
  preset: ModePreset
  onChange: (preset: ModePreset) => void
}

const QUOTE_UNITS: RateDisplayUnit[] = ['rft', 'sft', 'rmt']

export function QuotationSetupSection({ mode, preset, onChange }: Props) {
  const pkg = preset.packageRates ?? DEFAULT_PACKAGE_RATES
  const patch = (p: Partial<ModePreset>) => onChange({ ...preset, ...p })
  const patchPkg = (p: Partial<typeof pkg>) => patch({ packageRates: { ...pkg, ...p } })
  const unit = preset.packageQuoteUnit ?? 'rft'
  const matKey = packageMaterialKey(unit)

  const modeLabel = mode === 'staircase' ? 'Staircase' : 'Normal'

  return (
    <section className="quotation-setup-section">
      <h3 className="setup-title">{modeLabel} railing — configure once, use on all designs</h3>
      <p className="hint setup-hint">
        Save both presets in <strong>Rates</strong>. Glass costing always uses SFT. Default
        quotation unit is RFT — change per design on the home screen.
      </p>

      <HardwareConfigFields mode={mode} preset={preset} onChange={onChange} />

      <h4 className="setup-subtitle">Default quote material ({modeLabel})</h4>
      <p className="hint">
        Default material rate for new designs (installation is entered per design in Quotation
        rates panel).
      </p>
      <div className="toggle-row">
        <span className="toggle-label">Default quote unit:</span>
        {QUOTE_UNITS.map((u) => (
          <button
            key={u}
            type="button"
            className={unit === u ? 'toggle active' : 'toggle'}
            onClick={() => patch({ packageQuoteUnit: u })}
          >
            Per {u.toUpperCase()}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Default material ₹ / {unit.toUpperCase()}</span>
        <input
          type="number"
          min={0}
          value={pkg[matKey] || ''}
          onChange={(e) => patchPkg({ [matKey]: Number(e.target.value) })}
        />
      </label>

      <h4 className="setup-subtitle">Default extras ({modeLabel}) — optional</h4>
      <p className="hint">
        Applied when you choose &quot;Apply preset extras&quot;. Per-line extras stay in the design
        form.
      </p>
      <CustomChargesEditor
        charges={preset.customCharges ?? []}
        onChange={(customCharges) => patch({ customCharges })}
      />
    </section>
  )
}
