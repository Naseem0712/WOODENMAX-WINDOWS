import { calcGlassWidth } from '../calculations'
import {
  GLASS_PANEL_MAX_MM,
  GLASS_PANEL_MIN_MM,
  listGlassDivideOptions,
  suggestGlassPanelCount,
} from '../glassDivision'
import type { CalculatedSegment, DesignDraft, PillarsPerGlass } from '../types'
import { selectOnFocus } from '../inputUtils'

interface Props {
  draft: DesignDraft
  cfg: DesignDraft['segmentConfigs'][0]
  dimValue: number
  seg?: CalculatedSegment
  onUpdate: (patch: Partial<DesignDraft['segmentConfigs'][0]>) => void
}

export function SegmentDivideEditor({ draft, cfg, dimValue, seg, onUpdate }: Props) {
  const suggestion = suggestGlassPanelCount(dimValue, cfg.gapMm)
  const divideOptions = listGlassDivideOptions(dimValue, cfg.gapMm)
  const panelWidth =
    seg?.glassWidthMm ?? calcGlassWidth(dimValue, cfg.glassCount, cfg.gapMm)

  return (
    <div className="segment-divide-block">
      <div className="field-grid segment-divide-fields">
        <label className="field">
          <span>Glass divide (panels)</span>
          <input
            type="number"
            min={1}
            max={20}
            value={cfg.glassCount}
            onFocus={selectOnFocus}
            onChange={(e) =>
              onUpdate({ glassCount: Math.max(1, Number(e.target.value)) })
            }
          />
        </label>
        <label className="field">
          <span>Gap between glass (mm)</span>
          <input
            type="number"
            min={6}
            max={30}
            value={cfg.gapMm}
            onFocus={selectOnFocus}
            onChange={(e) => onUpdate({ gapMm: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Each glass width</span>
          <div className="calc-readout">
            <strong>{Math.round(panelWidth)} mm</strong>
            <small>× {seg?.heightMm ?? draft.uniformHeight} mm H</small>
          </div>
        </label>
      </div>

      <p className={`hint glass-suggest-hint ${suggestion.inRange ? 'in-range' : ''}`}>
        Suggested: {suggestion.reason}
        {suggestion.inRange ? ' ✓' : ''}
      </p>

      {divideOptions.length > 0 && (
        <div className="divide-option-chips">
          <span className="divide-chips-label">Quick divide:</span>
          {divideOptions.map((opt) => (
            <button
              key={opt.count}
              type="button"
              className={`divide-chip ${cfg.glassCount === opt.count ? 'active' : ''} ${opt.inRange ? 'in-range' : ''}`}
              onClick={() => onUpdate({ glassCount: opt.count })}
              title={`${opt.count} panels, ${Math.round(opt.panelWidthMm)} mm each`}
            >
              {opt.count}× {Math.round(opt.panelWidthMm)} mm
            </button>
          ))}
        </div>
      )}

      <p className="ref divide-range-note">
        Ideal panel width {GLASS_PANEL_MIN_MM}–{GLASS_PANEL_MAX_MM} mm
      </p>
    </div>
  )
}

export function GlobalSupportPerGlass({
  bottomFixing,
  value,
  onChange,
}: {
  bottomFixing: DesignDraft['bottomFixing']
  value: PillarsPerGlass
  onChange: (v: PillarsPerGlass) => void
}) {
  if (bottomFixing !== 'pillars' && bottomFixing !== 'studs') return null
  const label = bottomFixing === 'pillars' ? 'Pillars per glass' : 'Studs per glass'
  return (
    <label className="field global-support-field">
      <span>{label} (all sides)</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as PillarsPerGlass)}
      >
        <option value={2}>2 per glass</option>
        <option value={3}>3 per glass</option>
        <option value={4}>4 per glass</option>
      </select>
    </label>
  )
}

export function RailingHeightFields({
  draft,
  onChange,
}: {
  draft: DesignDraft
  onChange: (patch: Partial<DesignDraft>) => void
}) {
  return (
    <div className="railing-height-block">
      <div className="toggle-row height-mode-row">
        <span className="toggle-label">Railing height:</span>
        <button
          type="button"
          className={draft.heightMode === 'uniform' ? 'toggle active' : 'toggle'}
          onClick={() => onChange({ heightMode: 'uniform' })}
        >
          Same all sides
        </button>
        <button
          type="button"
          className={draft.heightMode === 'per-segment' ? 'toggle active' : 'toggle'}
          onClick={() => onChange({ heightMode: 'per-segment' })}
        >
          Per side
        </button>
      </div>
      {draft.heightMode === 'uniform' ? (
        <label className="field">
          <span>Height (mm)</span>
          <input
            type="number"
            min={100}
            step={50}
            value={draft.uniformHeight}
            onFocus={selectOnFocus}
            onChange={(e) => {
              const v = Number(e.target.value)
              onChange({
                uniformHeight: v,
                segmentHeights: draft.segmentHeights.map((h) => ({ ...h, value: v })),
              })
            }}
          />
        </label>
      ) : (
        <div className="field-grid">
          {draft.segmentHeights.map((h) => (
            <label key={h.key} className="field">
              <span>{h.label} (mm)</span>
              <input
                type="number"
                min={100}
                step={50}
                value={h.value}
                onFocus={selectOnFocus}
                onChange={(e) =>
                  onChange({
                    segmentHeights: draft.segmentHeights.map((x) =>
                      x.key === h.key ? { ...x, value: Number(e.target.value) } : x,
                    ),
                  })
                }
              />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
