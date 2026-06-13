import { DEFAULT_PACKAGE_RATES, packageInstallationKey, packageMaterialKey } from '../packagePricing'
import type { ModePreset } from '../modePreset'
import type { HardwareMode, RateDisplayUnit } from '../types'
import { CustomChargesEditor } from './CustomChargesEditor'
import { HardwareConfigFields } from './HardwareConfigFields'

interface Props {
  mode: HardwareMode
  preset: ModePreset
  onChange: (preset: ModePreset) => void
  glassPerSft: number
  onGlassPerSftChange: (value: number) => void
  glassAreaHint?: number
}

const QUOTE_UNITS: RateDisplayUnit[] = ['rft', 'sft', 'rmt']

export function QuotationSetupSection({
  mode,
  preset,
  onChange,
  glassPerSft,
  onGlassPerSftChange,
  glassAreaHint,
}: Props) {
  const pkg = preset.packageRates ?? DEFAULT_PACKAGE_RATES
  const patch = (p: Partial<ModePreset>) => onChange({ ...preset, ...p })
  const patchPkg = (p: Partial<typeof pkg>) => patch({ packageRates: { ...pkg, ...p } })
  const unit = preset.packageQuoteUnit ?? 'rft'
  const matKey = packageMaterialKey(unit)
  const instKey = packageInstallationKey(unit)

  const modeLabel = mode === 'staircase' ? 'Staircase' : 'Normal'

  return (
    <section className="quotation-setup-section">
      <h3 className="setup-title">{modeLabel} railing — configure once, use on all designs</h3>
      <p className="hint setup-hint">
        Save both presets in <strong>Rates</strong>. Glass costing always uses SFT. Default
        quotation unit is RFT — change per design on the home screen.
      </p>

      <HardwareConfigFields
        mode={mode}
        preset={preset}
        onChange={onChange}
        glassPerSft={glassPerSft}
        onGlassPerSftChange={onGlassPerSftChange}
        glassAreaHint={glassAreaHint}
      />

      <h4 className="setup-subtitle">Default quote rates ({modeLabel})</h4>
      <p className="hint">
        Per-design defaults when you apply this preset. Material = internal costing reference only.
        Quote rate = final customer rate (not added to material).
      </p>
      <div className="toggle-row">
        <span className="toggle-label">Quote unit:</span>
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
      <div className="field-grid quote-rate-inputs">
        <label className="field">
          <span>
            Default material ₹ / {unit.toUpperCase()}{' '}
            <span className="field-basis">(BOM / costing reference)</span>
          </span>
          <div className="input-row">
            <span className="input-prefix">₹</span>
            <input
              type="number"
              min={0}
              value={pkg[matKey] || ''}
              onChange={(e) => patchPkg({ [matKey]: Number(e.target.value) })}
            />
          </div>
        </label>
        <label className="field package-rate-install">
          <span>
            Default quote rate ₹ / {unit.toUpperCase()}{' '}
            <span className="field-basis">(final rate — all-in for customer)</span>
          </span>
          <div className="input-row">
            <span className="input-prefix">₹</span>
            <input
              type="number"
              min={0}
              value={pkg[instKey] || ''}
              onChange={(e) => patchPkg({ [instKey]: Number(e.target.value) })}
            />
          </div>
        </label>
      </div>

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
