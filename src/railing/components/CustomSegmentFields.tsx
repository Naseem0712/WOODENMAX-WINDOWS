import type { PathStartHeading, SegmentDim } from '../types'
import { bendModeLabel, pathStartHeadingLabel } from '../segmentLayout'
import { appendCustomSegment, zigzagTemplateAsCustom } from '../customSegments'
import { CUSTOM_PATH_TEMPLATES } from '../customPathTemplates'
import { selectOnFocus } from '../inputUtils'

const BEND_OPTIONS = [
  'none',
  'right-90',
  'left-90',
  'depth-in',
  'depth-out',
  'front-90',
  'back-90',
  'left-side-90',
  'right-side-90',
  'custom',
] as const

interface Props {
  dimensions: SegmentDim[]
  pathStartHeading?: PathStartHeading
  onPatch: (patch: {
    dimensions?: SegmentDim[]
    pathStartHeading?: PathStartHeading
    designType?: 'custom'
  }) => void
}

export function CustomSegmentFields({ dimensions, pathStartHeading, onPatch }: Props) {
  const mmSegs = dimensions.filter((d) => d.unit === 'mm')

  const updateSeg = (key: string, patch: Partial<SegmentDim>) => {
    onPatch({
      dimensions: dimensions.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    })
  }

  const removeSeg = (key: string) => {
    if (mmSegs.length <= 1) return
    onPatch({ dimensions: dimensions.filter((d) => d.key !== key) })
  }

  const addLeg = () => {
    onPatch({ dimensions: appendCustomSegment(dimensions) })
  }

  const loadTemplate = (templateId: string) => {
    const t = CUSTOM_PATH_TEMPLATES.find((x) => x.id === templateId)
    if (!t) return
    onPatch({
      designType: 'custom',
      dimensions: t.dimensions.map((d) => ({ ...d })),
      pathStartHeading: t.pathStartHeading,
    })
  }

  return (
    <div className="custom-segments">
      <p className="hint zigzag-hint">
        <strong>Custom path:</strong> kitni bhi legs — wall se upar, notch, zigzag, ya koi bhi plan.
        Pehle template load karo, phir har leg ka mm aur bend adjust karo.
      </p>

      <label className="field full">
        <span>Leg 1 start direction (plan view)</span>
        <select
          value={pathStartHeading ?? 'east'}
          onChange={(e) => onPatch({ pathStartHeading: e.target.value as PathStartHeading })}
        >
          <option value="north">{pathStartHeadingLabel('north')}</option>
          <option value="east">{pathStartHeadingLabel('east')}</option>
          <option value="south">{pathStartHeadingLabel('south')}</option>
          <option value="west">{pathStartHeadingLabel('west')}</option>
        </select>
      </label>

      <p className="section-desc">Layout templates (aapke sketch jaisa)</p>
      <div className="custom-template-grid">
        {CUSTOM_PATH_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="custom-template-card"
            onClick={() => loadTemplate(t.id)}
            title={t.hint}
          >
            <strong>{t.label}</strong>
            <small>{t.hint}</small>
          </button>
        ))}
      </div>

      <div className="custom-seg-actions">
        <button type="button" className="btn-ghost" onClick={addLeg}>
          + Add leg
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            onPatch({
              designType: 'custom',
              dimensions: zigzagTemplateAsCustom(),
              pathStartHeading: 'east',
            })
          }
        >
          Load zigzag template
        </button>
      </div>
      {mmSegs.map((d, idx) => (
        <div key={d.key} className="custom-seg-card">
          <div className="custom-seg-card-head">
            <strong>
              Leg {idx + 1} — {d.label}
            </strong>
            {mmSegs.length > 1 && (
              <button type="button" className="btn-icon-text danger" onClick={() => removeSeg(d.key)}>
                Remove
              </button>
            )}
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Run length (mm)</span>
              <input
                type="number"
                min={0}
                step={50}
                value={d.value}
                onFocus={selectOnFocus}
                onChange={(e) => updateSeg(d.key, { value: Math.max(0, Number(e.target.value)) })}
              />
            </label>
            <label className="field">
              <span>Leg label</span>
              <input
                type="text"
                value={d.label}
                onChange={(e) => updateSeg(d.key, { label: e.target.value || d.label })}
              />
            </label>
            {idx > 0 && (
              <>
                <label className="field">
                  <span>Bend before this leg</span>
                  <select
                    value={d.bendMode ?? 'right-90'}
                    onChange={(e) =>
                      updateSeg(d.key, { bendMode: e.target.value as (typeof BEND_OPTIONS)[number] })
                    }
                  >
                    {BEND_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {bendModeLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
                {d.bendMode === 'custom' && (
                  <label className="field">
                    <span>Bend angle (°)</span>
                    <input
                      type="number"
                      min={0}
                      max={360}
                      step={1}
                      value={d.bendBeforeDeg ?? 90}
                      onFocus={selectOnFocus}
                      onChange={(e) =>
                        updateSeg(d.key, { bendBeforeDeg: Number(e.target.value) })
                      }
                    />
                  </label>
                )}
              </>
            )}
          </div>
        </div>
      ))}
      <p className="hint">
        Bottom rail & handrail length = total run. Har 90° bend par connector. Wall ends par wall
        connector auto count.
      </p>
    </div>
  )
}
