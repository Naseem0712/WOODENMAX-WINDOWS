import {
  BOTTOM_RAIL_PROFILE_OPTIONS,
  GLASS_OPTIONS,
  HANDRAIL_PROFILE_OPTIONS,
  PROFILE_OTHER,
} from '../constants'
import type { ModePreset } from '../modePreset'
import type { BottomFixing, HardwareMode } from '../types'
import { DEFAULT_PACKAGE_RATES } from '../packagePricing'
import { CustomChargesEditor } from './CustomChargesEditor'

interface Props {
  mode: HardwareMode
  preset: ModePreset
  onChange: (preset: ModePreset) => void
}

function ProfileSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
}) {
  const isPreset = options.includes(value)
  const selectValue = isPreset ? value : PROFILE_OTHER

  return (
    <div className="profile-select-block compact">
      <label className="field">
        <span>{label}</span>
        <select
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value
            if (v === PROFILE_OTHER) {
              if (isPreset) onChange('')
            } else {
              onChange(v)
            }
          }}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={PROFILE_OTHER}>Other…</option>
        </select>
      </label>
      {selectValue === PROFILE_OTHER && (
        <label className="field">
          <span>Custom</span>
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
      )}
    </div>
  )
}

export function QuotationSetupSection({ mode, preset, onChange }: Props) {
  const pkg = preset.packageRates ?? DEFAULT_PACKAGE_RATES
  const patch = (p: Partial<ModePreset>) => onChange({ ...preset, ...p })
  const patchFinish = (p: Partial<ModePreset['finish']>) =>
    patch({ finish: { ...preset.finish, ...p } })
  const patchPkg = (p: Partial<typeof pkg>) => patch({ packageRates: { ...pkg, ...p } })

  const modeLabel = mode === 'staircase' ? 'Staircase' : 'Normal'

  return (
    <section className="quotation-setup-section">
      <h3 className="setup-title">{modeLabel} railing — glass &amp; hardware</h3>
      <p className="hint setup-hint">
        Ye settings sirf <strong>{modeLabel}</strong> designs par lagengi (L/U/straight = Normal;
        Custom → Staircase path = Staircase).
      </p>

      <div className="toggle-row">
        <button
          type="button"
          className={preset.bottomFixing === 'continuous-rail' ? 'toggle active' : 'toggle'}
          onClick={() => patch({ bottomFixing: 'continuous-rail' as BottomFixing })}
        >
          Bottom rail
        </button>
        <button
          type="button"
          className={preset.bottomFixing === 'pillars' ? 'toggle active' : 'toggle'}
          onClick={() => patch({ bottomFixing: 'pillars' as BottomFixing })}
        >
          Pillars
        </button>
        <label className="check-inline">
          <input
            type="checkbox"
            checked={preset.includeHandrail}
            onChange={(e) => patch({ includeHandrail: e.target.checked })}
          />
          Handrail
        </label>
      </div>

      <label className="field">
        <span>Glass type</span>
        <select value={preset.glassId} onChange={(e) => patch({ glassId: e.target.value })}>
          {GLASS_OPTIONS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      {preset.glassId === 'custom' && (
        <label className="field">
          <span>Custom glass</span>
          <input
            value={preset.customGlassComposition}
            onChange={(e) => patch({ customGlassComposition: e.target.value })}
          />
        </label>
      )}

      {preset.includeHandrail && (
        <ProfileSelect
          label="Handrail profile"
          value={preset.finish.handrailProfile}
          options={HANDRAIL_PROFILE_OPTIONS}
          onChange={(v) => patchFinish({ handrailProfile: v })}
        />
      )}

      {preset.bottomFixing === 'continuous-rail' && (
        <ProfileSelect
          label="Bottom rail profile"
          value={preset.finish.bottomRailProfile}
          options={BOTTOM_RAIL_PROFILE_OPTIONS}
          onChange={(v) => patchFinish({ bottomRailProfile: v })}
        />
      )}

      <div className="field-grid">
        <label className="field">
          <span>Default height (mm)</span>
          <input
            type="number"
            min={100}
            step={50}
            value={preset.uniformHeight}
            onChange={(e) => patch({ uniformHeight: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Panels per side</span>
          <input
            type="number"
            min={1}
            max={20}
            value={preset.defaultGlassCount}
            onChange={(e) => patch({ defaultGlassCount: Math.max(1, Number(e.target.value)) })}
          />
        </label>
        <label className="field">
          <span>Gap (mm)</span>
          <input
            type="number"
            min={6}
            max={30}
            value={preset.defaultGapMm}
            onChange={(e) => patch({ defaultGapMm: Number(e.target.value) })}
          />
        </label>
      </div>

      <h4 className="setup-subtitle">Package rate ({modeLabel}) — installation yahi</h4>
      <div className="toggle-row">
        <span className="toggle-label">Quote unit:</span>
        {(['sft', 'rft', 'rmt'] as const).map((u) => (
          <button
            key={u}
            type="button"
            className={preset.packageQuoteUnit === u ? 'toggle active' : 'toggle'}
            onClick={() => patch({ packageQuoteUnit: u })}
          >
            Per {u.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="field-grid">
        <label className="field">
          <span>₹ / SFT</span>
          <input
            type="number"
            min={0}
            value={pkg.perSft || ''}
            onChange={(e) => patchPkg({ perSft: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>₹ / RFT</span>
          <input
            type="number"
            min={0}
            value={pkg.perRft || ''}
            onChange={(e) => patchPkg({ perRft: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>₹ / RMT</span>
          <input
            type="number"
            min={0}
            value={pkg.perRmt || ''}
            onChange={(e) => patchPkg({ perRmt: Number(e.target.value) })}
          />
        </label>
      </div>

      <h4 className="setup-subtitle">Default extras ({modeLabel}) — optional</h4>
      <p className="hint">
        Naye design par tab apply honge jab aap &quot;Apply preset extras&quot; choose karenge. Har
        item ke alag extras neeche design form mein bhi daal sakte hain.
      </p>
      <CustomChargesEditor
        charges={preset.customCharges ?? []}
        onChange={(customCharges) => patch({ customCharges })}
      />
    </section>
  )
}
