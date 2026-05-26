import type { SegmentBendMode, SegmentDim } from '../types'
import { bendModeLabel } from '../segmentLayout'
import { appendCustomSegment, zigzagTemplateAsCustom } from '../customSegments'
import { selectOnFocus } from '../inputUtils'

const BEND_OPTIONS: SegmentBendMode[] = [
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
]

interface Props {
  dimensions: SegmentDim[]
  onChange: (dimensions: SegmentDim[]) => void
}

export function CustomSegmentFields({
  dimensions,
  onChange,
}: Props) {
  const mmSegs = dimensions.filter((d) => d.unit === 'mm')

  const updateSeg = (key: string, patch: Partial<SegmentDim>) => {
    onChange(dimensions.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }

  const removeSeg = (key: string) => {
    if (mmSegs.length <= 1) return
    onChange(dimensions.filter((d) => d.key !== key))
  }

  const addLeg = () => {
    onChange(appendCustomSegment(dimensions))
  }

  const loadZigzag = () => {
    onChange(zigzagTemplateAsCustom())
  }

  return (
    <div className="custom-segments">
      <p className="hint zigzag-hint">
        <strong>Custom path:</strong> kitni bhi legs — har leg ka length, bend (90° / depth /
        front / left…), alag glass division. Zigzag ke liye template load karo.
      </p>
      <div className="custom-seg-actions">
        <button type="button" className="btn-ghost" onClick={addLeg}>
          + Add leg
        </button>
        <button type="button" className="btn-ghost" onClick={loadZigzag}>
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
            {idx > 0 && (
              <>
                <label className="field">
                  <span>Bend before this leg</span>
                  <select
                    value={d.bendMode ?? 'right-90'}
                    onChange={(e) =>
                      updateSeg(d.key, { bendMode: e.target.value as SegmentBendMode })
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
        Bottom rail & handrail length auto = total run. 90° at each bend. 180° splice only on
        handrail if stock bar short.
      </p>
    </div>
  )
}
