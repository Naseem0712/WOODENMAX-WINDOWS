import { useState } from 'react'
import {
  defaultDimensions,
  DESIGN_TYPES,
  GLASS_OPTIONS,
  segmentHeightKeys,
} from '../constants'
import { syncSegmentConfigs } from '../calculations'
import { calculateCosting, supportHoleCount } from '../costing'
import { staircaseGlassBillLengthMm } from '../staircaseGlass'
import { MM_PER_FT } from '../units'
import { suggestGlassPanelCount } from '../glassDivision'
import type { ModePreset, QuotationPresets } from '../modePreset'
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
import { displayDesignTitle, formatCurrency } from '../utils'
import { CustomChargesEditor } from './CustomChargesEditor'
import { CustomSegmentFields } from './CustomSegmentFields'
import { CostingSummaryStrip } from './CostingSummaryStrip'
import { DesignBudgetPanel } from './DesignBudgetPanel'
import { DesignQuoteRatePanel } from './DesignQuoteRatePanel'
import {
  GlobalSupportPerGlass,
  RailingHeightFields,
  SegmentDivideEditor,
} from './SegmentDivideEditor'
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
      studsPerGlass: preset.defaultStudsPerGlass,
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
  const holeCount = supportHoleCount(calc.hardware)
  const set = (patch: Partial<DesignDraft>) =>
    onChange(patchDraft(draft, patch, activePreset))
  const [applyExtrasOnMode, setApplyExtrasOnMode] = useState(false)
  const showHardwareSections = !prefsSaved || !!draft.customizeHardware

  const [designTypesOpen, setDesignTypesOpen] = useState(true)
  const [ratesOpen, setRatesOpen] = useState(true)
  const [budgetOpen, setBudgetOpen] = useState(false)
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
        studsPerGlass: activePreset.defaultStudsPerGlass,
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
    const cfg = draft.segmentConfigs.find((c) => c.key === key)
    const gap = cfg?.gapMm ?? activePreset.defaultGapMm
    const suggestion = suggestGlassPanelCount(value, gap)
    set({
      dimensions: draft.dimensions.map((d) =>
        d.key === key ? { ...d, value: Math.max(0, value) } : d,
      ),
      segmentConfigs: draft.segmentConfigs.map((c) =>
        c.key === key ? { ...c, glassCount: suggestion.count } : c,
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

  const applySupportPerGlass = (value: PillarsPerGlass) => {
    onChange({
      ...draft,
      segmentConfigs: draft.segmentConfigs.map((c) => ({
        ...c,
        pillarsPerGlass: value,
        studsPerGlass: value,
      })),
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

  const globalSupportPerGlass =
    draft.bottomFixing === 'studs'
      ? (activeConfigs[0]?.studsPerGlass ?? activeConfigs[0]?.pillarsPerGlass ?? 2)
      : (activeConfigs[0]?.pillarsPerGlass ?? 2)

  const quoteUnit = draft.packageQuoteUnit ?? 'rft'
  const quoteTotal = packageLineTotal(draft, liveCost)

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
          1. Design name & type
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
              Shape type
            </>
          }
          subtitle={
            activeType ? (
              <span className="collapse-active-type">
                {activeType.label}
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
                <small>{t.description}</small>
              </button>
            ))}
          </div>
        </CollapsiblePanel>
      </section>

      <section className="form-section">
        <h2>
          2. Sizes · height · divide
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
          <>
            {draft.dimensions
              .filter((d) => d.unit === 'deg')
              .map((d) => (
                <label key={d.key} className="field">
                  <span>{d.label}</span>
                  <div className="input-row">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={d.value}
                      onFocus={selectOnFocus}
                      onChange={(e) => updateDim(d.key, Number(e.target.value))}
                    />
                    <span className="unit">{d.unit}</span>
                  </div>
                </label>
              ))}
            {draft.segmentConfigs.map((cfg) => {
              const dim = draft.dimensions.find((d) => d.key === cfg.key)
              if (!dim || dim.unit !== 'mm') return null
              const seg = calc.segments.find((s) => s.key === cfg.key)
              return (
                <div key={cfg.key} className="size-divide-leg-card">
                  <label className="field">
                    <span>{cfg.label} — run length</span>
                    <div className="input-row">
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={dim.value}
                        onFocus={selectOnFocus}
                        onChange={(e) => updateDim(cfg.key, Number(e.target.value))}
                      />
                      <span className="unit">mm</span>
                    </div>
                  </label>
                  {dim.value > 0 && (
                    <SegmentDivideEditor
                      draft={draft}
                      cfg={cfg}
                      dimValue={dim.value}
                      seg={seg}
                      onUpdate={(patch) => updateSegConfig(cfg.key, patch)}
                    />
                  )}
                </div>
              )
            })}
          </>
        )}

        {draft.designType === 'custom' &&
          draft.segmentConfigs.map((cfg) => {
            const dim = draft.dimensions.find((d) => d.key === cfg.key)
            if (!dim || dim.unit !== 'mm' || dim.value <= 0) return null
            const seg = calc.segments.find((s) => s.key === cfg.key)
            return (
              <div key={`divide-${cfg.key}`} className="size-divide-leg-card">
                <h4 className="leg-divide-title">
                  {cfg.label} — {dim.value} mm
                </h4>
                <SegmentDivideEditor
                  draft={draft}
                  cfg={cfg}
                  dimValue={dim.value}
                  seg={seg}
                  onUpdate={(patch) => updateSegConfig(cfg.key, patch)}
                />
              </div>
            )
          })}

        {hasMeasurements && (
          <>
            <RailingHeightFields draft={draft} onChange={set} />
            <div className="field-grid home-support-row">
              <GlobalSupportPerGlass
                bottomFixing={draft.bottomFixing}
                value={globalSupportPerGlass}
                onChange={applySupportPerGlass}
              />
            </div>
          </>
        )}

        {draft.designType === 'o-type' && (
          <p className="hint o-type-hint">
            O-type: enter all four sides — front, right, back, left.
          </p>
        )}
        {hasMeasurements && (
          <p className="hint">
            Run: <strong>{calc.perimeterRunMm.toLocaleString('en-IN')} mm</strong>
          </p>
        )}
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
              title="Staircase glass: (panel width + height) × height — more SFT than normal W×H"
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

          {showHardwareSections && (
          <>
          <section className="form-section">
            <h2>
              3. Bottom fixing
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
              <button
                type="button"
                className={draft.bottomFixing === 'studs' ? 'toggle active' : 'toggle'}
                onClick={() => set({ bottomFixing: 'studs' as BottomFixing })}
              >
                Studs per glass
              </button>
            </div>
            {draft.bottomFixing === 'continuous-rail' && (
              <p className="calc-result">
                Bottom rail: <strong>{calc.hardware.bottomRailRft} RFT</strong> (
                {calc.hardware.bottomRailStock.barSizes})
              </p>
            )}
            {draft.bottomFixing === 'pillars' && (
              <p className="calc-result">
                Total pillars: <strong>{calc.hardware.totalPillars} pcs</strong>
                <span className="hint-inline"> — per glass count in section 2</span>
              </p>
            )}
            {draft.bottomFixing === 'studs' && (
              <p className="calc-result">
                Total studs: <strong>{calc.hardware.totalStuds} pcs</strong>
                <span className="hint-inline"> — per glass count in section 2</span>
              </p>
            )}
            {holeCount > 0 && (
              <label className="check-inline hole-charge-toggle">
                <input
                  type="checkbox"
                  checked={!!draft.applyHoleCharges}
                  onChange={(e) => set({ applyHoleCharges: e.target.checked })}
                />
                Add hole drilling charge — {holeCount} holes × ₹{rates.holePerPcs ?? 100}/hole
                {draft.applyHoleCharges && (
                  <span className="hint-inline">
                    {' '}
                    (= {formatCurrency(holeCount * (rates.holePerPcs ?? 100))} in BOM)
                  </span>
                )}
              </label>
            )}
            {draftMode === 'staircase' && calc.segments.length > 0 && (
              <p className="calc-result staircase-glass-hint">
                Staircase glass: each panel <strong>(run width + H) × H</strong> for angle cut
                {calc.totalGlassAreaSftActual != null && (
                  <>
                    {' '}
                    — billed <strong>{calc.totalGlassAreaSft} SFT</strong> (actual W×H{' '}
                    {calc.totalGlassAreaSftActual} SFT). Glass ₹/RFT = glass cost ÷{' '}
                    {Math.round((calc.perimeterRunMm / MM_PER_FT) * 100) / 100} RFT run.
                  </>
                )}
                {calc.segments[0]?.glasses[0] && (
                  <>
                    {' '}
                    e.g. panel{' '}
                    {calc.segments[0].glasses[0].widthMm}+{calc.segments[0].glasses[0].heightMm}=
                    {staircaseGlassBillLengthMm(
                      calc.segments[0].glasses[0].widthMm,
                      calc.segments[0].glasses[0].heightMm,
                    )}
                    ×{calc.segments[0].glasses[0].heightMm} mm
                  </>
                )}
              </p>
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

          <section className="form-section compact-section">
            <h2>
              4. Glass · Finish
            </h2>
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
              90°×{calc.hardware.connector90}
              {draftMode !== 'staircase' && <> · 180°×{calc.hardware.connector180}</>}
              {' · '}
              Wall×{calc.hardware.wallConnectors} · End cap×{calc.hardware.endCaps} · Anchors×
              {calc.hardware.totalAnchors}
              {calc.hardware.totalPillars > 0 && <> · Pillars×{calc.hardware.totalPillars}</>}
              {calc.hardware.totalStuds > 0 && <> · Studs×{calc.hardware.totalStuds}</>}
              {' · '}
              Bottom {calc.hardware.bottomRailRft} RFT · Handrail {calc.hardware.handrailRft} RFT ·{' '}
              {calc.totalGlassAreaSftActual ?? calc.totalGlassAreaSft} SFT
              {draftMode === 'staircase' && calc.totalGlassAreaSftActual != null && (
                <> · billed {calc.totalGlassAreaSft} SFT</>
              )}
            </p>
          </section>
          </>
          )}

          <section className="form-section add-to-quote-section">
            <CostingSummaryStrip draft={draft} breakdown={liveCost} />

            <CollapsiblePanel
              id="design-quote-rates"
              className="budget-collapse-panel"
              open={ratesOpen}
              onToggle={() => setRatesOpen((o) => !o)}
              title="5. Quotation rates"
              subtitle={`${quoteUnit.toUpperCase()} · ${formatCurrency(quoteTotal)}`}
            >
              <DesignQuoteRatePanel
                draft={draft}
                breakdown={liveCost}
                onChange={(patch) => set(patch)}
              />
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
              <button type="button" className="btn-primary" onClick={onAdd}>
                {editingLineId ? '✓ Update quotation line' : '+ Add to quotation'}
              </button>
            </CollapsiblePanel>

            <CollapsiblePanel
              id="design-budget"
              className="budget-collapse-panel"
              open={budgetOpen}
              onToggle={() => setBudgetOpen((o) => !o)}
              title="Budget (material costing + installation)"
              subtitle={formatCurrency(liveCost.subtotal)}
            >
              <DesignBudgetPanel draft={draft} breakdown={liveCost} />
            </CollapsiblePanel>
          </section>
        </>
      )}
    </div>
  )
}
