import { useState } from 'react'
import {
  defaultDimensions,
  DESIGN_TYPES,
  GLASS_OPTIONS,
  segmentHeightKeys,
} from '../constants'
import { syncSegmentConfigs } from '../calculations'
import { calculateCosting } from '../costing'
import type { QuotationPresets } from '../modePreset'
import type { ModePreset } from '../modePreset'
import { resolveDraftMode, presetForMode } from '../presets'
import type {
  CostingRates,
  DesignDraft,
  DesignType,
  BottomFixing,
  HardwareMode,
  PillarsPerGlass,
} from '../types'
import { calculateDesign } from '../calculations'
import { packageLineTotal } from '../packagePricing'
import { glassLabel, displayDesignTitle, formatCurrency, hardwareProfilesLabel } from '../utils'
import { CustomChargesEditor } from './CustomChargesEditor'
import { CustomSegmentFields } from './CustomSegmentFields'
import { PackageRatesEditor } from './PackageRatesEditor'
import { SetRatesDisplay } from './SetRatesDisplay'
import { RailProfilesSection } from './RailProfilesSection'
import { CollapsiblePanel } from './CollapsiblePanel'
import { selectOnFocus } from '../inputUtils'

interface Props {
  draft: DesignDraft
  presets: QuotationPresets
  prefsSaved: boolean
  rates: CostingRates
  editingLineId: string | null
  editingIndex: number
  onCancelEdit: () => void
  onChange: (draft: DesignDraft) => void
  onAdd: () => void
  onApplyMode: (mode: HardwareMode, applyExtras: boolean) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

function mergeSegmentConfigs(
  draft: DesignDraft,
  synced: DesignDraft['segmentConfigs'],
  preset: ModePreset,
): DesignDraft['segmentConfigs'] {
  return synced.map((c) => {
    const existing = draft.segmentConfigs.find((x) => x.key === c.key)
    if (existing) return { ...existing, label: c.label }
    return {
      ...c,
      glassCount: preset.defaultGlassCount,
      gapMm: preset.defaultGapMm,
      pillarsPerGlass: preset.defaultPillarsPerGlass,
      pillarInsetMm: preset.defaultPillarInsetMm,
      handrailProfile: preset.finish.handrailProfile,
      bottomRailProfile: preset.finish.bottomRailProfile,
    }
  })
}

function patchDraft(
  draft: DesignDraft,
  patch: Partial<DesignDraft>,
  preset: ModePreset,
): DesignDraft {
  const next = { ...draft, ...patch }
  const synced = syncSegmentConfigs(next)
  next.segmentConfigs = mergeSegmentConfigs(draft, synced, preset)
  return next
}

export function DesignForm({
  draft,
  presets,
  prefsSaved,
  rates,
  editingLineId,
  editingIndex,
  onCancelEdit,
  onChange,
  onAdd,
  onApplyMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  const draftMode = resolveDraftMode(draft)
  const activePreset = presetForMode(presets, draftMode)
  const calc = calculateDesign(draft)
  const liveCost = calculateCosting(draft, rates)
  const set = (patch: Partial<DesignDraft>) =>
    onChange(patchDraft(draft, patch, activePreset))
  const [applyExtrasOnMode, setApplyExtrasOnMode] = useState(false)
  const showHardwareSections = !prefsSaved || !!draft.customizeHardware

  const [designTypesOpen, setDesignTypesOpen] = useState(true)
  const hasMeasurements = draft.dimensions.some(
    (d) => d.unit === 'mm' && d.value > 0,
  )

  const activeType = DESIGN_TYPES.find((t) => t.id === draft.designType)

  const setType = (designType: DesignType) => {
    const dimensions = defaultDimensions(designType)
    const keys = segmentHeightKeys(designType, dimensions)
    const segmentConfigs = dimensions
      .filter((d) => d.unit === 'mm')
      .map((d) => ({
        key: d.key,
        label: d.label,
        glassCount: activePreset.defaultGlassCount,
        gapMm: activePreset.defaultGapMm,
        pillarsPerGlass: activePreset.defaultPillarsPerGlass,
        pillarInsetMm: activePreset.defaultPillarInsetMm,
        handrailProfile: activePreset.finish.handrailProfile,
        bottomRailProfile: activePreset.finish.bottomRailProfile,
      }))
    const mode: HardwareMode =
      designType === 'custom' ? draft.hardwareMode ?? 'normal' : 'normal'
    const preset = presetForMode(presets, mode)
    set({
      designType,
      dimensions,
      segmentConfigs,
      segmentHeights: keys.map((k) => ({
        ...k,
        value: preset.uniformHeight,
      })),
      hardwareMode: mode,
      bottomFixing: preset.bottomFixing,
      includeHandrail: preset.includeHandrail,
      glassId: preset.glassId,
      customGlassComposition: preset.customGlassComposition,
      finish: { ...preset.finish },
      packageRates: { ...preset.packageRates },
      packageQuoteUnit: preset.packageQuoteUnit,
    })
  }

  const updateDim = (key: string, value: number) => {
    set({
      dimensions: draft.dimensions.map((d) =>
        d.key === key ? { ...d, value: Math.max(0, value) } : d,
      ),
    })
  }

  const updateSegConfig = (
    key: string,
    patch: Partial<(typeof draft.segmentConfigs)[0]>,
  ) => {
    onChange({
      ...draft,
      segmentConfigs: draft.segmentConfigs.map((c) =>
        c.key === key ? { ...c, ...patch } : c,
      ),
    })
  }

  const setCustomDimensions = (dimensions: DesignDraft['dimensions']) => {
    const mm = dimensions.filter((d) => d.unit === 'mm')
    set({
      dimensions,
      segmentHeights: mm.map((d) => {
        const ex = draft.segmentHeights.find((h) => h.key === d.key)
        return {
          key: d.key,
          label: d.label,
          value: ex?.value ?? draft.uniformHeight,
        }
      }),
    })
  }

  const activeConfigs = draft.segmentConfigs.filter((c) => {
    const dim = draft.dimensions.find((d) => d.key === c.key)
    return dim && dim.unit === 'mm' && dim.value > 0
  })

  return (
    <div className="form-panel no-print">
      <div className="design-undo-bar">
        <button
          type="button"
          className="cad-tool-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          className="cad-tool-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
        </button>
        <span className="design-undo-hint">Ctrl+Z · Ctrl+Y</span>
      </div>
      {editingLineId && editingIndex >= 0 && (
        <div className="editing-banner">
          <span>
            Editing quotation <strong>#{editingIndex + 1}</strong> — same position after save
          </span>
          <button type="button" className="btn-ghost" onClick={onCancelEdit}>
            Cancel edit
          </button>
        </div>
      )}
      <section className="form-section">
        <h2>
          1. Design name & type <span className="hi">नाम</span>
        </h2>
        <label className="field full">
          <span>Design name (on quotation)</span>
          <input
            type="text"
            placeholder={`e.g. Master bedroom balcony — ${displayDesignTitle({ ...draft, designName: '' })}`}
            value={draft.designName}
            onChange={(e) => set({ designName: e.target.value })}
          />
        </label>
        <p className="hint design-name-preview">
          Quotation title: <strong>{displayDesignTitle(draft)}</strong>
        </p>
        <CollapsiblePanel
          id="design-types"
          open={designTypesOpen}
          onToggle={() => setDesignTypesOpen((o) => !o)}
          title={
            <>
              Shape type <span className="hi">टाइप</span>
            </>
          }
          subtitle={
            activeType ? (
              <span className="collapse-active-type">
                {activeType.label} · {activeType.labelHi}
              </span>
            ) : null
          }
        >
          <p className="section-desc">Select railing shape</p>
          <div className="design-grid">
            {DESIGN_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`design-card ${draft.designType === t.id ? 'active' : ''}`}
                onClick={() => {
                  setType(t.id)
                  setDesignTypesOpen(false)
                }}
              >
                <strong>{t.label}</strong>
                <span className="hi-sm">{t.labelHi}</span>
                <small>{t.description}</small>
              </button>
            ))}
          </div>
        </CollapsiblePanel>
      </section>

      <section className="form-section">
        <h2>
          2. Sizes (mm) <span className="hi">माप</span>
        </h2>
        {draft.designType === 'custom' && (
          <div className="toggle-row custom-path-row">
            <span className="toggle-label">Custom path type:</span>
            <button
              type="button"
              className={draft.hardwareMode === 'normal' ? 'toggle active' : 'toggle'}
              onClick={() => set({ hardwareMode: 'normal' })}
            >
              Normal bends
            </button>
            <button
              type="button"
              className={draft.hardwareMode === 'staircase' ? 'toggle active' : 'toggle'}
              onClick={() => set({ hardwareMode: 'staircase' })}
            >
              Staircase
            </button>
          </div>
        )}
        {draft.designType === 'custom' ? (
          <CustomSegmentFields
            dimensions={draft.dimensions}
            onChange={setCustomDimensions}
          />
        ) : (
          <div className="field-grid">
            {draft.dimensions.map((d) => (
              <label key={d.key} className="field">
                <span>
                  {d.label} <span className="hi-sm">({d.labelHi})</span>
                </span>
                <div className="input-row">
                  <input
                    type="number"
                    min={0}
                    step={d.unit === 'deg' ? 1 : 50}
                    value={d.value}
                    onFocus={selectOnFocus}
                    onChange={(e) => updateDim(d.key, Number(e.target.value))}
                  />
                  <span className="unit">{d.unit}</span>
                </div>
              </label>
            ))}
          </div>
        )}
        {draft.designType === 'o-type' && (
          <p className="hint o-type-hint">
            O-type: enter all four sides — front, right, back, left. Set one height for all sides
            or different height per side in section 5.
          </p>
        )}
        <p className="hint">
          Run: <strong>{calc.perimeterRunMm.toLocaleString('en-IN')} mm</strong>
        </p>
      </section>

      {!hasMeasurements && (
        <p className="flow-hint">
          Enter sizes above — glass, hardware & costing options will appear automatically
          {prefsSaved ? ' (from your saved settings).' : '.'}
        </p>
      )}

      {hasMeasurements && (
        <>
          <div className="apply-preset-bar">
            <span className="toggle-label">Apply saved preset to this design:</span>
            <button
              type="button"
              className={draftMode === 'normal' ? 'toggle active' : 'toggle'}
              onClick={() => onApplyMode('normal', applyExtrasOnMode)}
            >
              Normal
            </button>
            <button
              type="button"
              className={draftMode === 'staircase' ? 'toggle active' : 'toggle'}
              onClick={() => onApplyMode('staircase', applyExtrasOnMode)}
            >
              Staircase
            </button>
            <label className="check-inline">
              <input
                type="checkbox"
                checked={applyExtrasOnMode}
                onChange={(e) => setApplyExtrasOnMode(e.target.checked)}
              />
              Preset extras
            </label>
            {prefsSaved && (
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={!!draft.customizeHardware}
                  onChange={(e) => set({ customizeHardware: e.target.checked })}
                />
                Custom hardware / glass (this item only)
              </label>
            )}
          </div>

          {prefsSaved && (
            <div className="auto-applied-banner saved-config-banner">
              <p>
                <strong>✓ Saved — {draftMode === 'staircase' ? 'Staircase' : 'Normal'}</strong>{' '}
                preset for this design type
              </p>
              <ul className="saved-config-list">
                <li>
                  {glassLabel({
                    ...draft,
                    glassId: activePreset.glassId,
                    customGlassComposition: activePreset.customGlassComposition,
                  })}
                </li>
                <li>
                  {activePreset.bottomFixing === 'pillars' ? 'Pillars' : 'Bottom rail'} ·{' '}
                  {activePreset.includeHandrail ? 'Handrail on' : 'No handrail'}
                </li>
                <li>
                  {hardwareProfilesLabel({
                    ...draft,
                    finish: activePreset.finish,
                    bottomFixing: activePreset.bottomFixing,
                    includeHandrail: activePreset.includeHandrail,
                  })}
                </li>
                <li>
                  Package: ₹
                  {activePreset.packageRates[
                    activePreset.packageQuoteUnit === 'sft'
                      ? 'perSft'
                      : activePreset.packageQuoteUnit === 'rmt'
                        ? 'perRmt'
                        : 'perRft'
                  ]}{' '}
                  / {activePreset.packageQuoteUnit.toUpperCase()}
                </li>
              </ul>
              <p className="hint">
                Edit both presets in <strong>Rates</strong> → Save both.
              </p>
            </div>
          )}

          {showHardwareSections && (
          <>
          <section className="form-section">
            <h2>
              3. Bottom fixing <span className="hi">नीचे</span>
            </h2>
            <div className="toggle-row">
              <button
                type="button"
                className={
                  draft.bottomFixing === 'continuous-rail' ? 'toggle active' : 'toggle'
                }
                onClick={() => set({ bottomFixing: 'continuous-rail' as BottomFixing })}
              >
                Continuous bottom rail
              </button>
              <button
                type="button"
                className={draft.bottomFixing === 'pillars' ? 'toggle active' : 'toggle'}
                onClick={() => set({ bottomFixing: 'pillars' as BottomFixing })}
              >
                Pillars per glass
              </button>
            </div>
            {draft.bottomFixing === 'continuous-rail' && (
              <p className="calc-result">
                Bottom rail: <strong>{calc.hardware.bottomRailRft} RFT</strong> (
                {calc.hardware.bottomRailStock.barSizes})
              </p>
            )}
            {draft.bottomFixing === 'pillars' && (
              <div className="pillar-config">
                <p className="section-desc">
                  Customise pillars per side (saved default:{' '}
                  {activePreset.defaultPillarsPerGlass} per glass)
                </p>
                {activeConfigs.map((cfg) => (
                  <div key={cfg.key} className="field-grid pillar-row">
                    <label className="field">
                      <span>{cfg.label} — pillars/glass</span>
                      <select
                        value={cfg.pillarsPerGlass}
                        onChange={(e) =>
                          updateSegConfig(cfg.key, {
                            pillarsPerGlass: Number(e.target.value) as PillarsPerGlass,
                          })
                        }
                      >
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Edge inset (mm)</span>
                      <input
                        type="number"
                        min={50}
                        max={300}
                        value={cfg.pillarInsetMm}
                        onFocus={selectOnFocus}
                        onChange={(e) =>
                          updateSegConfig(cfg.key, {
                            pillarInsetMm: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                <p className="calc-result">
                  Total pillars: <strong>{calc.hardware.totalPillars} pcs</strong>
                </p>
              </div>
            )}
            <label className="check-inline">
              <input
                type="checkbox"
                checked={draft.includeHandrail}
                onChange={(e) => set({ includeHandrail: e.target.checked })}
              />
              Handrail {calc.hardware.handrailRft} RFT
            </label>

            <RailProfilesSection
              draft={draft}
              activeConfigs={activeConfigs}
              showHandrail={draft.includeHandrail}
              showBottomRail={draft.bottomFixing === 'continuous-rail'}
              onChange={onChange}
            />
          </section>

          <section className="form-section">
            <h2>
              4. Glass panels <span className="hi">विभाजन</span>
            </h2>
            {activeConfigs.map((cfg) => {
              const dim = draft.dimensions.find((d) => d.key === cfg.key)!
              const seg = calc.segments.find((s) => s.key === cfg.key)
              return (
                <div key={cfg.key} className="seg-config-card">
                  <h4>
                    {cfg.label} — {dim.value} mm
                  </h4>
                  <div className="field-grid">
                    <label className="field">
                      <span>Panels</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={cfg.glassCount}
                        onFocus={selectOnFocus}
                        onChange={(e) =>
                          updateSegConfig(cfg.key, {
                            glassCount: Math.max(1, Number(e.target.value)),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Gap (mm)</span>
                      <input
                        type="number"
                        min={6}
                        max={30}
                        value={cfg.gapMm}
                        onFocus={selectOnFocus}
                        onChange={(e) =>
                          updateSegConfig(cfg.key, { gapMm: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                  {seg && (
                    <p className="calc-result">
                      Glass: <strong>{seg.glassWidthMm} × {seg.heightMm} mm</strong> each
                    </p>
                  )}
                </div>
              )
            })}
          </section>

          <section className="form-section compact-section">
            <h2>
              5. Height · Glass · Finish <span className="hi">ऊँचाई</span>
            </h2>
            <div className="toggle-row height-mode-row">
              <button
                type="button"
                className={draft.heightMode === 'uniform' ? 'toggle active' : 'toggle'}
                onClick={() => set({ heightMode: 'uniform' })}
              >
                Same height all sides
              </button>
              <button
                type="button"
                className={draft.heightMode === 'per-segment' ? 'toggle active' : 'toggle'}
                onClick={() => set({ heightMode: 'per-segment' })}
              >
                Different per side
              </button>
            </div>
            {draft.heightMode === 'uniform' ? (
              <div className="field-grid">
                <label className="field">
                  <span>Height all sides (mm)</span>
                  <input
                    type="number"
                    min={100}
                    step={50}
                    value={draft.uniformHeight}
                    onFocus={selectOnFocus}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      set({
                        uniformHeight: v,
                        segmentHeights: draft.segmentHeights.map((h) => ({
                          ...h,
                          value: v,
                        })),
                      })
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="field-grid">
                {draft.segmentHeights.map((h) => (
                  <label key={h.key} className="field">
                    <span>{h.label} height (mm)</span>
                    <input
                      type="number"
                      min={100}
                      step={50}
                      value={h.value}
                      onFocus={selectOnFocus}
                      onChange={(e) =>
                        set({
                          segmentHeights: draft.segmentHeights.map((x) =>
                            x.key === h.key
                              ? { ...x, value: Number(e.target.value) }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="glass-list compact-glass">
              {GLASS_OPTIONS.map((g) => (
                <label
                  key={g.id}
                  className={`radio-card compact ${draft.glassId === g.id ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    name="glass"
                    checked={draft.glassId === g.id}
                    onChange={() => set({ glassId: g.id })}
                  />
                  <strong>{g.name}</strong>
                </label>
              ))}
            </div>
            <div className="field-grid finish-compact">
              <label className="field">
                <span>Glass colour</span>
                <input
                  value={draft.finish.glassColor}
                  onChange={(e) =>
                    set({ finish: { ...draft.finish, glassColor: e.target.value } })
                  }
                />
              </label>
              <label className="field">
                <span>Hardware colour</span>
                <input
                  value={draft.finish.hardwareColor}
                  onChange={(e) =>
                    set({ finish: { ...draft.finish, hardwareColor: e.target.value } })
                  }
                />
              </label>
              <label className="field">
                <span>Anchor size</span>
                <input
                  value={draft.finish.anchorSize}
                  onChange={(e) =>
                    set({ finish: { ...draft.finish, anchorSize: e.target.value } })
                  }
                />
              </label>
            </div>
            <p className="calc-result hw-auto">
              90°×{calc.hardware.connector90} · 180°×{calc.hardware.connector180} · Wall×
              {calc.hardware.wallConnectors} · Anchors×{calc.hardware.totalAnchors} ·{' '}
              {calc.totalGlassAreaSft} SFT
            </p>
          </section>
          </>
          )}

          <section className="form-section add-to-quote-section">
            <h2>
              6. Add to quote <span className="hi">पैकेज रेट</span>
            </h2>
            <SetRatesDisplay
              breakdown={liveCost}
              quantity={draft.quantity}
              highlightUnit={rates.quoteDisplayUnit}
            />
            <PackageRatesEditor
              draft={draft}
              breakdown={liveCost}
              onChange={(patch) => set(patch)}
            />
            <p className="hint">
              <strong>Expected</strong> set rates upar — apna package rate neeche edit karo (
              {draftMode} material rates).
            </p>
            <p className="calc-result add-quote-total">
              Quotation amount:{' '}
              <strong>{formatCurrency(packageLineTotal(draft, liveCost))}</strong>
            </p>
            <label className="field">
              <span>Sets (qty)</span>
              <input
                type="number"
                min={1}
                value={draft.quantity}
                onFocus={selectOnFocus}
                onChange={(e) => set({ quantity: Math.max(1, Number(e.target.value)) })}
              />
            </label>
            <label className="field full">
              <span>Notes</span>
              <textarea
                rows={2}
                value={draft.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </label>
            <CustomChargesEditor
              charges={draft.customCharges ?? []}
              onChange={(customCharges) => set({ customCharges })}
            />
            <p className="hint">
              Ye extras sirf is item par — doosri lines par nahi (preset extras alag se apply
              karein).
            </p>
            <button type="button" className="btn-primary" onClick={onAdd}>
              {editingLineId ? '✓ Update quotation line' : '+ Add to quotation'}
            </button>
          </section>
        </>
      )}
    </div>
  )
}
