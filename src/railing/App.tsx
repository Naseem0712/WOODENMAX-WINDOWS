import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useDraftHistory } from './useDraftHistory'
import { downloadOrderBom } from './bomExport'
import { downloadGlassOrderCsv, downloadHardwareOrderCsv } from './orderExport'
import { OrderPrintDocument } from './components/OrderPrintDocument'
import { AppHeader, type HeaderDrawer } from './components/AppHeader'
import { BackupPanel } from './components/BackupPanel'
import { BomTable } from './components/BomTable'
import { CadPreview } from './components/CadPreview'
import { DesignForm } from './components/DesignForm'
import { DrawerPanel } from './components/DrawerPanel'
import { MaterialOrderPanel } from './components/MaterialOrderPanel'
import { ProfitLossPanel } from './components/ProfitLossPanel'
import { QuotationPanel } from './components/QuotationPanel'
import { QuotationDocument } from './components/QuotationDocument'
import { QuotationRatesPanel } from './components/QuotationRatesPanel'
import { calculateCosting } from './costing'
import { validateRatesForCosting } from './components/CostingPanel'
import {
  defaultDimensions,
  defaultSegmentConfigs,
  segmentHeightKeys,
} from './constants'
import { migrateBackup, type AppBackup } from './backup'
import { normalizeDraft } from './draftMigrate'
import type { QuotationPresets } from './modePreset'
import { loadProjectSettings, saveProjectSettings } from './projectStorage'
import { loadSession, saveSession, saveSessionNow } from './sessionStorage'
import type { CostingRates, DesignDraft, HardwareMode, QuotationLine, QuotationMeta } from './types'
import { packageLineTotal, resolvePackageQuote } from './packagePricing'
import { quoteLineAmount, quoteTotals, recalculateQuoteLine } from './quotationFormat'
import { defaultMetaFields, normalizeQuotationMeta } from './metaDefaults'
import {
  applyDefaultsToDraft,
  applyPresetsToMatchingLines,
  createDraftFromPreset,
} from './quotationDefaults'
import {
  applyPresetToDraft,
  ratesForMode,
  resolveDraftMode,
} from './presets'
import { displayDesignTitle, draftToLine, formatCurrency } from './utils'
import './index.css'

export interface RailingEmbedUnifiedHandlers {
  /** Push or update one railing line in the WoodenMax combined quotation JSON. */
  onPushLine?: (line: QuotationLine) => void
  onBackToWindows?: () => void
  /** After backup restore: replace railing rows in View Quotation with these lines (windows unchanged). */
  onReplaceUnifiedRailingLines?: (lines: QuotationLine[]) => void
}

export interface RailingDesignerAppProps {
  embedUnified?: RailingEmbedUnifiedHandlers
}

function createInitialDraft(presets: QuotationPresets, mode: HardwareMode = 'normal'): DesignDraft {
  const designType = 'l-type'
  const dimensions = defaultDimensions(designType)
  const keys = segmentHeightKeys(designType, dimensions)
  const preset = presets[mode]
  const base: DesignDraft = {
    designName: '',
    designType,
    dimensions,
    heightMode: preset.heightMode,
    uniformHeight: preset.uniformHeight,
    segmentHeights: keys.map((k) => ({ ...k, value: preset.uniformHeight })),
    segmentConfigs: defaultSegmentConfigs(designType).map((c) => ({
      ...c,
      glassCount: preset.defaultGlassCount,
      gapMm: preset.defaultGapMm,
      pillarsPerGlass: preset.defaultPillarsPerGlass,
      pillarInsetMm: preset.defaultPillarInsetMm,
      handrailProfile: preset.finish.handrailProfile,
      bottomRailProfile: preset.finish.bottomRailProfile,
    })),
    bottomFixing: preset.bottomFixing,
    includeHandrail: preset.includeHandrail,
    glassId: preset.glassId,
    customGlassComposition: preset.customGlassComposition,
    finish: { ...preset.finish },
    hardwareMode: mode,
    quantity: 1,
    notes: '',
    packageRates: { ...preset.packageRates },
    packageQuoteUnit: preset.packageQuoteUnit,
    customCharges: [],
  }
  return createDraftFromPreset(presets, mode, base)
}

function defaultMeta(): QuotationMeta {
  return {
    clientName: '',
    clientPhone: '',
    clientAddress: '',
    projectName: '',
    quoteNumber: `WM-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    date: new Date().toISOString().slice(0, 10),
    ...defaultMetaFields(),
  }
}

export function RailingDesignerApp({ embedUnified }: RailingDesignerAppProps = {}) {
  const initialSettings = useMemo(() => loadProjectSettings(), [])
  const initialSession = useMemo(() => loadSession(), [])

  const [presets, setPresets] = useState<QuotationPresets>(initialSettings.presets)
  const [ratesNormal, setRatesNormal] = useState<CostingRates>(initialSettings.ratesNormal)
  const [ratesStaircase, setRatesStaircase] = useState<CostingRates>(
    initialSettings.ratesStaircase,
  )
  const [prefsSaved, setPrefsSaved] = useState(initialSettings.savedOnce)

  const initialDraft = useMemo(() => {
    const base = normalizeDraft(
      initialSession?.draft ?? createInitialDraft(initialSettings.presets, 'normal'),
    )
    const mode = resolveDraftMode(base)
    return {
      ...base,
      packageQuoteUnit:
        base.packageQuoteUnit ?? ratesForMode(initialSettings.ratesNormal, initialSettings.ratesStaircase, mode).quoteDisplayUnit,
    }
  }, [])

  const {
    draft,
    setDraft,
    replaceDraft,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDraftHistory(initialDraft)
  const [lines, setLines] = useState<QuotationLine[]>(() =>
    (initialSession?.lines ?? []).map(recalculateQuoteLine),
  )
  const [meta, setMeta] = useState<QuotationMeta>(() =>
    normalizeQuotationMeta(initialSession?.meta ?? defaultMeta()),
  )
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showQuotePreview, setShowQuotePreview] = useState(false)
  const [activeDrawer, setActiveDrawer] = useState<HeaderDrawer>(null)

  const restoredUnifiedDraftRef = useRef(false)

  useEffect(() => {
    if (!embedUnified?.onPushLine || restoredUnifiedDraftRef.current) return
    try {
      const raw = sessionStorage.getItem('wm-railing-unified-restore-v1')
      if (!raw) return
      const parsed = JSON.parse(raw) as { line: QuotationLine }
      if (!parsed?.line?.draftSnapshot || !parsed.line.id) return
      restoredUnifiedDraftRef.current = true
      sessionStorage.removeItem('wm-railing-unified-restore-v1')
      replaceDraft(normalizeDraft(structuredClone(parsed.line.draftSnapshot)))
      setEditingLineId(parsed.line.id)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      /* ignore */
    }
  }, [embedUnified?.onPushLine, replaceDraft])

  const draftMode = resolveDraftMode(draft)
  const activeRates = useMemo(
    () => ratesForMode(ratesNormal, ratesStaircase, draftMode),
    [ratesNormal, ratesStaircase, draftMode],
  )
  const liveCost = useMemo(
    () => calculateCosting(draft, activeRates),
    [draft, activeRates],
  )
  const designTitle = displayDesignTitle(draft)
  const hasMeasurements = draft.dimensions.some((d) => d.unit === 'mm' && d.value > 0)
  const designLiveTotal = hasMeasurements ? packageLineTotal(draft, liveCost) : null

  const { grand: quoteGrandTotal } = quoteTotals(lines)

  const canDownloadBom =
    lines.length > 0 || draft.dimensions.some((d) => d.unit === 'mm' && d.value > 0)

  const editingIndex = editingLineId
    ? lines.findIndex((l) => l.id === editingLineId)
    : -1

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const openDrawer = (id: NonNullable<HeaderDrawer>) => {
    setActiveDrawer((cur) => (cur === id ? null : id))
  }

  useEffect(() => {
    setLines((prev) => {
      const fixed = prev.map(recalculateQuoteLine)
      const unchanged = fixed.every((l, i) => l.amount === prev[i]?.amount)
      return unchanged ? prev : fixed
    })
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      saveSession({ version: 1, meta, lines, draft: normalizeDraft(draft) })
    }, 350)
    return () => window.clearTimeout(t)
  }, [meta, lines, draft])

  useEffect(() => {
    const clearPrintClass = () => document.body.classList.remove('printing-quotation')
    window.addEventListener('afterprint', clearPrintClass)
    return () => window.removeEventListener('afterprint', clearPrintClass)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveDrawer(null)
      const mod = e.ctrlKey || e.metaKey
      if (!mod || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (undo()) showToast('Undo')
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault()
        if (redo()) showToast('Redo')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  useEffect(() => {
    const t = window.setTimeout(() => {
      saveProjectSettings({
        presets,
        ratesNormal,
        ratesStaircase,
        costingCollapsed: false,
        savedOnce: prefsSaved,
      })
    }, 350)
    return () => window.clearTimeout(t)
  }, [presets, ratesNormal, ratesStaircase, prefsSaved])

  const handleSaveRates = () => {
    saveProjectSettings({
      presets,
      ratesNormal,
      ratesStaircase,
      costingCollapsed: false,
      savedOnce: true,
    })
    setPrefsSaved(true)
    setDraft((d) => applyDefaultsToDraft(d, presets))
    setLines((prev) =>
      applyPresetsToMatchingLines(prev, presets, ratesNormal, ratesStaircase),
    )
    showToast('Normal + Staircase presets saved — matching items updated.')
  }

  const resetDraft = useCallback(() => {
    const mode = resolveDraftMode(draft)
    replaceDraft(createInitialDraft(presets, mode))
    setEditingLineId(null)
  }, [presets, draft, replaceDraft])

  const handleApplyModeToDraft = (mode: HardwareMode, applyExtras: boolean) => {
    setDraft((d) =>
      applyPresetToDraft(d, presets[mode], mode, { applyPresetExtras: applyExtras }),
    )
    showToast(
      applyExtras
        ? `${mode} preset applied (with default extras)`
        : `${mode} preset applied to this design`,
    )
  }

  const handleRestore = (backup: AppBackup) => {
    const migrated = migrateBackup(backup)
    const nextPresets = migrated.presets!
    const nextDraft = migrated.draft
      ? normalizeDraft(migrated.draft)
      : createInitialDraft(nextPresets, 'normal')

    const restoredLines = migrated.lines.map(recalculateQuoteLine)
    embedUnified?.onReplaceUnifiedRailingLines?.(restoredLines)

    setMeta(migrated.meta)
    setLines(restoredLines)
    setPresets(nextPresets)
    setRatesNormal(migrated.ratesNormal!)
    setRatesStaircase(migrated.ratesStaircase!)
    replaceDraft(nextDraft)
    setEditingLineId(null)
    setPrefsSaved(true)

    saveProjectSettings({
      presets: nextPresets,
      ratesNormal: migrated.ratesNormal!,
      ratesStaircase: migrated.ratesStaircase!,
      costingCollapsed: false,
      savedOnce: true,
    })
    saveSessionNow(migrated.meta, restoredLines, nextDraft)

    setActiveDrawer('quotation')
    showToast(
      migrated.lines.length > 0
        ? `Imported ${migrated.lines.length} quotation item(s) — open Quotation panel`
        : 'Imported settings (no quotation lines in file)',
    )
  }

  const handleEditLine = (id: string) => {
    const line = lines.find((l) => l.id === id)
    if (!line) return
    const idx = lines.findIndex((l) => l.id === id)
    replaceDraft(structuredClone(line.draftSnapshot))
    setEditingLineId(id)
    setActiveDrawer(null)
    showToast(`Editing quotation #${idx + 1} — position will stay same`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingLineId(null)
    resetDraft()
    showToast('Edit cancelled')
  }

  const handleAdd = useCallback(() => {
    const err = validateRatesForCosting(activeRates)
    if (err) {
      showToast(err)
      return
    }
    const pq = resolvePackageQuote(draft, liveCost)
    if (pq.rate <= 0 || pq.basisQty <= 0) {
      showToast('Enter package rate in Add to quote (section 6).')
      return
    }

    const existing = editingLineId ? lines.find((l) => l.id === editingLineId) : undefined
    const line = recalculateQuoteLine(
      draftToLine(
        draft,
        activeRates,
        existing ? { id: existing.id, createdAt: existing.createdAt } : undefined,
      ),
    )

    if (editingLineId) {
      setLines((prev) => prev.map((l) => (l.id === editingLineId ? line : l)))
      setEditingLineId(null)
      showToast(`Updated #${editingIndex + 1} — ${formatCurrency(quoteLineAmount(line))}`)
    } else {
      setLines((prev) => [...prev, line])
      showToast(`Added — ${formatCurrency(quoteLineAmount(line))}`)
    }

    embedUnified?.onPushLine?.(structuredClone(line))

    resetDraft()
  }, [draft, activeRates, liveCost, editingLineId, editingIndex, lines, resetDraft, embedUnified])

  const handleDownloadBom = () => {
    downloadOrderBom(meta, lines, draft)
    showToast('Full BOM downloaded (CSV).')
  }

  const handleDownloadHardware = () => {
    downloadHardwareOrderCsv(meta, lines, draft)
    showToast('Hardware order Excel downloaded.')
  }

  const handleDownloadGlass = () => {
    downloadGlassOrderCsv(meta, lines, draft)
    showToast('Glass order Excel downloaded.')
  }

  const handlePrintOrder = () => {
    if (!canDownloadBom) {
      showToast('Add at least one design to the quotation first.')
      return
    }
    document.body.classList.add('printing-order')
    window.setTimeout(() => {
      window.print()
      window.setTimeout(() => document.body.classList.remove('printing-order'), 500)
    }, 300)
  }

  const handlePrint = () => {
    if (lines.length === 0) {
      showToast('Add at least one item to the quotation before printing.')
      return
    }
    setShowQuotePreview(true)
    document.body.classList.add('printing-quotation')
    window.setTimeout(() => {
      window.print()
      window.setTimeout(() => document.body.classList.remove('printing-quotation'), 500)
    }, 300)
  }

  return (
    <div className={embedUnified ? 'app railing-embed' : 'app'}>
      {embedUnified?.onPushLine && embedUnified?.onBackToWindows && (
        <div className="no-print border-b border-slate-700 bg-slate-900/95 px-3 py-2 text-[12px] text-sky-100">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-500 bg-slate-800 px-2 py-1 font-semibold text-white hover:bg-slate-700"
              onClick={embedUnified.onBackToWindows}
            >
              ← Windows &amp; doors
            </button>
            <span className="opacity-95">
              <strong className="text-sky-200">Combined quote:</strong> Har baar &quot;Add to quotation&quot; yahan + main list dono jagah sync
              ho jata hai — View Quotation se windows ke saath ek hi PDF/total mein railing bhi shamil karein.
            </span>
          </div>
        </div>
      )}
      <AppHeader
        activeDrawer={activeDrawer}
        onOpenDrawer={openDrawer}
        onDownloadBom={handleDownloadBom}
        canDownloadBom={canDownloadBom}
        quoteLineCount={lines.length}
        quoteGrandTotal={quoteGrandTotal}
        designLiveTotal={designLiveTotal}
        designLabel={designTitle}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => undo() && showToast('Undo')}
        onRedo={() => redo() && showToast('Redo')}
      />

      <main className="workspace-main no-print">
        <div className="workspace-grid">
          <div className="workspace-canvas">
            <CadPreview
              draft={draft}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={() => undo() && showToast('Undo')}
              onRedo={() => redo() && showToast('Redo')}
            />
          </div>
          <div className="workspace-config custom-scrollbar touch-pan-y">
            <DesignForm
              draft={draft}
              presets={presets}
              prefsSaved={prefsSaved}
              rates={activeRates}
              editingLineId={editingLineId}
              editingIndex={editingIndex}
              onCancelEdit={handleCancelEdit}
              onChange={setDraft}
              onAdd={handleAdd}
              onApplyMode={handleApplyModeToDraft}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={() => undo() && showToast('Undo')}
              onRedo={() => redo() && showToast('Redo')}
            />
          </div>
        </div>
      </main>

      <DrawerPanel
        open={activeDrawer === 'quotation'}
        title="Quotation — client & products"
        onClose={() => setActiveDrawer(null)}
        wide
      >
        <QuotationPanel
          meta={meta}
          onMetaChange={setMeta}
          lines={lines}
          ratesNormal={ratesNormal}
          ratesStaircase={ratesStaircase}
          editingLineId={editingLineId}
          onEdit={handleEditLine}
          onRemove={(id) => {
            setLines((p) => p.filter((l) => l.id !== id))
            if (editingLineId === id) setEditingLineId(null)
          }}
          onClear={() => {
            setLines([])
            setEditingLineId(null)
          }}
          onPrint={handlePrint}
          onPreview={() => {
            setShowQuotePreview(true)
            setActiveDrawer(null)
            window.setTimeout(
              () =>
                document
                  .getElementById('quotation-preview')
                  ?.scrollIntoView({ behavior: 'smooth' }),
              100,
            )
          }}
        />
      </DrawerPanel>

      <DrawerPanel
        open={activeDrawer === 'rates'}
        title="Quotation rates"
        onClose={() => setActiveDrawer(null)}
        wide
      >
        <QuotationRatesPanel
          draft={draft}
          presets={presets}
          ratesNormal={ratesNormal}
          ratesStaircase={ratesStaircase}
          lineCount={lines.length}
          onPresetsChange={setPresets}
          onRatesNormalChange={setRatesNormal}
          onRatesStaircaseChange={setRatesStaircase}
          onApplyModeToDraft={handleApplyModeToDraft}
          onSaveAll={handleSaveRates}
          prefsSaved={prefsSaved}
        />
      </DrawerPanel>

      <DrawerPanel
        open={activeDrawer === 'bom'}
        title="BOM — this design"
        onClose={() => setActiveDrawer(null)}
        wide
      >
        {hasMeasurements ? (
          <BomTable
            draft={draft}
            rates={activeRates}
            onRatesChange={(r) => {
              if (draftMode === 'staircase') setRatesStaircase(r)
              else setRatesNormal(r)
            }}
            quantity={draft.quantity}
            variant="quantities"
          />
        ) : (
          <p className="hint">Enter sizes on the canvas workspace first.</p>
        )}
      </DrawerPanel>

      <DrawerPanel
        open={activeDrawer === 'order'}
        title="Glass & hardware order"
        onClose={() => setActiveDrawer(null)}
        wide
      >
        <MaterialOrderPanel
          lines={lines}
          currentDraft={draft}
          meta={meta}
          onDownloadHardware={handleDownloadHardware}
          onDownloadGlass={handleDownloadGlass}
          onDownloadFullBom={handleDownloadBom}
          onPrintOrder={handlePrintOrder}
          canDownload={canDownloadBom}
          embedded
        />
      </DrawerPanel>

      <DrawerPanel
        open={activeDrawer === 'tools'}
        title="Backup & profit / loss"
        onClose={() => setActiveDrawer(null)}
        wide
      >
        <BackupPanel
          meta={meta}
          lines={lines}
          presets={presets}
          ratesNormal={ratesNormal}
          ratesStaircase={ratesStaircase}
          draft={draft}
          onRestore={handleRestore}
        />
        <hr className="drawer-divider" />
        <ProfitLossPanel
          meta={meta}
          lines={lines}
          rates={activeRates}
          editingLineId={editingLineId}
          onEdit={handleEditLine}
          embedded
        />
      </DrawerPanel>

      {lines.length > 0 && (
        <div
          id="quotation-preview"
          className={`quotation-print-root ${showQuotePreview ? 'on-screen-preview' : ''}`}
        >
          <QuotationDocument meta={meta} lines={lines} />
        </div>
      )}

      {canDownloadBom && (
        <div className="order-print-root">
          <OrderPrintDocument meta={meta} lines={lines} currentDraft={draft} />
        </div>
      )}

      {toast && <div className="toast no-print">{toast}</div>}
    </div>
  )
}

export default RailingDesignerApp
