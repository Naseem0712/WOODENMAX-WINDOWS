import { GLASS_OPTIONS } from '../constants'
import {
  defaultBottomRailSpec,
  defaultHandrailSpec,
  defaultPillarSpec,
  defaultStudSpec,
  finishWithHandrailMaterial,
} from '../hardwareDefaults'
import type { ModePreset } from '../modePreset'
import type {
  BottomFixing,
  FinishSpecs,
  HandrailMaterial,
  ProductSpec,
} from '../types'

function ProductSpecFields({
  title,
  spec,
  onChange,
}: {
  title: string
  spec: ProductSpec
  onChange: (spec: ProductSpec) => void
}) {
  return (
    <div className="product-spec-block">
      <p className="product-spec-title">{title}</p>
      <div className="field-grid product-spec-grid">
        <label className="field">
          <span>Name</span>
          <input
            value={spec.name}
            onChange={(e) => onChange({ ...spec, name: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Colour</span>
          <input
            value={spec.color}
            onChange={(e) => onChange({ ...spec, color: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Size</span>
          <input
            value={spec.size}
            onChange={(e) => onChange({ ...spec, size: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}

export interface HardwareConfigFieldsProps {
  mode: 'normal' | 'staircase'
  preset: ModePreset
  onChange: (preset: ModePreset) => void
  compact?: boolean
}

export function HardwareConfigFields({
  mode,
  preset,
  onChange,
  compact = false,
}: HardwareConfigFieldsProps) {
  const patch = (p: Partial<ModePreset>) => onChange({ ...preset, ...p })
  const patchFinish = (p: Partial<FinishSpecs>) => {
    const nextFinish = { ...preset.finish, ...p }
    onChange({ ...preset, finish: nextFinish })
  }

  const setBottomFixing = (bottomFixing: BottomFixing) => {
    patch({
      bottomFixing,
      bottomRailSpec:
        bottomFixing === 'continuous-rail'
          ? preset.bottomRailSpec ?? defaultBottomRailSpec()
          : preset.bottomRailSpec,
    })
  }

  const setHandrailMaterial = (material: HandrailMaterial) => {
    const includeHandrail = material !== 'none'
    const finish = finishWithHandrailMaterial(preset.finish, material)
    patch({
      handrailMaterial: material,
      includeHandrail,
      finish,
      handrailSpec: finish.handrailSpec ?? defaultHandrailSpec(material),
    })
  }

  const syncHardwareColor = (same: boolean) => {
    const finish = finishWithHandrailMaterial(
      { ...preset.finish, hardwareColorSameAsHandrail: same },
      preset.handrailMaterial ?? 'ss',
    )
    patch({
      hardwareColorSameAsHandrail: same,
      finish,
    })
  }

  const modeLabel = mode === 'staircase' ? 'Staircase' : 'Normal'

  return (
    <div className={`hardware-config-fields ${compact ? 'hardware-config-compact' : ''}`}>
      <h4 className="setup-subtitle">Bottom support ({modeLabel})</h4>
      <div className="toggle-row">
        <button
          type="button"
          className={preset.bottomFixing === 'continuous-rail' ? 'toggle active' : 'toggle'}
          onClick={() => setBottomFixing('continuous-rail')}
        >
          U channel continue
        </button>
        <button
          type="button"
          className={preset.bottomFixing === 'pillars' ? 'toggle active' : 'toggle'}
          onClick={() => setBottomFixing('pillars')}
        >
          Pillars
        </button>
        <button
          type="button"
          className={preset.bottomFixing === 'studs' ? 'toggle active' : 'toggle'}
          onClick={() => setBottomFixing('studs')}
        >
          Studs
        </button>
      </div>

      {preset.bottomFixing === 'continuous-rail' && (
        <ProductSpecFields
          title="Bottom U channel (continuous rail)"
          spec={preset.bottomRailSpec ?? defaultBottomRailSpec()}
          onChange={(bottomRailSpec) => {
            patch({
              bottomRailSpec,
              finish: {
                ...preset.finish,
                bottomRailProfile: bottomRailSpec.name || preset.finish.bottomRailProfile,
              },
            })
          }}
        />
      )}

      {preset.bottomFixing === 'pillars' && (
        <ProductSpecFields
          title="Pillar / post"
          spec={preset.pillarSpec ?? defaultPillarSpec()}
          onChange={(pillarSpec) => patch({ pillarSpec })}
        />
      )}

      {preset.bottomFixing === 'studs' && (
        <ProductSpecFields
          title="Glass stud"
          spec={preset.studSpec ?? defaultStudSpec()}
          onChange={(studSpec) => patch({ studSpec })}
        />
      )}

      <h4 className="setup-subtitle">Handrail ({modeLabel})</h4>
      <div className="toggle-row">
        {(
          [
            ['aluminium', 'Aluminium'],
            ['ss', 'SS'],
            ['none', 'No handrail'],
          ] as [HandrailMaterial, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={preset.handrailMaterial === id ? 'toggle active' : 'toggle'}
            onClick={() => setHandrailMaterial(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {preset.handrailMaterial !== 'none' && preset.includeHandrail && (
        <ProductSpecFields
          title="Handrail profile"
          spec={preset.handrailSpec ?? defaultHandrailSpec(preset.handrailMaterial)}
          onChange={(handrailSpec) => {
            const finish = finishWithHandrailMaterial(
              {
                ...preset.finish,
                handrailSpec,
                handrailProfile: handrailSpec.name || preset.finish.handrailProfile,
              },
              preset.handrailMaterial,
            )
            patch({ handrailSpec, finish })
          }}
        />
      )}

      <h4 className="setup-subtitle">Hardware finish</h4>
      <label className="check-inline hardware-color-sync">
        <input
          type="checkbox"
          checked={preset.hardwareColorSameAsHandrail !== false}
          onChange={(e) => syncHardwareColor(e.target.checked)}
        />
        Hardware colour same as handrail
      </label>
      {preset.hardwareColorSameAsHandrail === false && (
        <label className="field">
          <span>Hardware colour</span>
          <input
            value={preset.finish.hardwareColor}
            onChange={(e) => patchFinish({ hardwareColor: e.target.value })}
          />
        </label>
      )}

      <h4 className="setup-subtitle">Glass ({modeLabel})</h4>
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

      {mode === 'staircase' && (
        <p className="hint staircase-hw-hint">
          Staircase: 180° connectors are not used — 90° connectors, wall connectors &amp; end caps
          apply from size.
        </p>
      )}
    </div>
  )
}
