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
import { QuotationQuickActions } from './components/QuotationQuickActions'
import { QuotationDocument } from './components/QuotationDocument'
import { QuotationRatesPanel } from './components/QuotationRatesPanel'
import { calculateCosting } from './costing'
import { validateRatesForCosting } from './components/CostingPanel'
import {
  defaultDimensions,
  defaultSegmentConfigs,
  segmentHeightKeys,
} from './constants'
import { buildBackup, downloadBackupJson, migrateBackup, parseBackupJson, type AppBackup } from './backup'
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
import { exportRailingQuotationPdf, printRailingQuotationPdf } from './exportQuotationPdf'
import { isMobileOrPrintUnavailable, waitForQuotationPrintRoot } from './railingPrint'
import './index.css'

export interface RailingEmbedUnifiedHandlers {
  /** Push or update one railing line in the WoodenMax combined quotation JSON. */
  onPushLine?: (line: QuotationLine) => void
  onBackToWindows?: () => void
  /** After backup restore: replace railing rows in View Quotation with these lines (windows unchanged). */
  onReplaceUnifiedRailingLines?: (lines: QuotationLine[]) => void
  /** Remove one line from main quotation (keep railing drawer in sync). */
  onRemoveLine?: (id: string) => void
  /** Remove all railing lines from main quotation. */
  onClearLines?: () => void
  /** Current railing rows from main quotation — hydrates drawer on load & after main-list edits. */
  unifiedLines?: QuotationLine[]
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
      studsPerGlass: preset.defaultStudsPerGlass,
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
    clientGstin: '',
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
  const [lines, setLines] = useState<QuotationLine[]>(() => {
    if (embedUnified?.unifiedLines?.length) {
      return embedUnified.unifiedLines.map(recalculateQuoteLine)
    }
    return (initialSession?.lines ?? []).map(recalculateQuoteLine)
  })
  const [meta, setMeta] = useState<QuotationMeta>(() =>
    normalizeQuotationMeta(initialSession?.meta ?? defaultMeta()),
  )
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const importJsonRef = useRef<HTMLInputElement>(null)
  const [showQuotePreview, setShowQuotePreview] = useState(false)
  const [activeDrawer, setActiveDrawer] = useState<HeaderDrawer>(null)

  useEffect(() => {
    if (showQuotePreview) {
      document.body.classList.add('quotation-preview-open')
    } else {
      document.body.classList.remove('quotation-preview-open')
    }
    return () => document.body.classList.remove('quotation-preview-open')
  }, [showQuotePreview])

  const restoredUnifiedDraftRef = useRef(false)
  const [unifiedBootstrapDone, setUnifiedBootstrapDone] = useState(
    () =>
      !embedUnified?.onReplaceUnifiedRailingLines ||
      (embedUnified?.unifiedLines?.length ?? 0) > 0 ||
      (initialSession?.lines?.length ?? 0) === 0,
  )

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

  useEffect(() => {
    if (unifiedBootstrapDone || !embedUnified?.onReplaceUnifiedRailingLines) return
    if ((embedUnified.unifiedLines?.length ?? 0) > 0) {
      setUnifiedBootstrapDone(true)
      return
    }
    const sessionLines = (initialSession?.lines ?? []).map(recalculateQuoteLine)
    if (sessionLines.length === 0) {
      setUnifiedBootstrapDone(true)
      return
    }
    embedUnified.onReplaceUnifiedRailingLines(sessionLines)
    setUnifiedBootstrapDone(true)
  }, [
    unifiedBootstrapDone,
    embedUnified?.onReplaceUnifiedRailingLines,
    embedUnified?.unifiedLines,
    initialSession,
  ])

  const unifiedLinesSig = embedUnified?.unifiedLines
    ?.map((l) => `${l.id}:${l.amount}:${l.quantity}`)
    .join('|')

  useEffect(() => {
    if (!unifiedBootstrapDone || embedUnified?.unifiedLines === undefined) return
    setLines(embedUnified.unifiedLines.map(recalculateQuoteLine))
  }, [unifiedBootstrapDone, unifiedLinesSig, embedUnified?.unifiedLines])

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
    if (!activeDrawer) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.classList.add('railing-drawer-open')
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
      document.body.classList.remove('railing-drawer-open')
    }
  }, [activeDrawer])

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
    setLines((prev) => {
      const next = applyPresetsToMatchingLines(prev, presets, ratesNormal, ratesStaircase)
      next.forEach((l) => embedUnified?.onPushLine?.(structuredClone(l)))
      return next
    })
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

  const handleExportJson = useCallback(() => {
    const backup = buildBackup(meta, lines, presets, ratesNormal, ratesStaircase, draft)
    downloadBackupJson(backup)
    showToast('Quotation backup exported (JSON).')
  }, [meta, lines, presets, ratesNormal, ratesStaircase, draft])

  const handleImportJsonFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = parseBackupJson(reader.result as string)
        handleRestore(raw)
      } catch {
        showToast('Could not read JSON — check backup file format.')
      }
    }
    reader.readAsText(file)
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

  const runQuotationPdfJob = async (
    job: (docEl: HTMLElement) => Promise<void>,
    successToast: string,
    failToast: string,
  ) => {
    if (lines.length === 0) {
      showToast('Add at least one item to the quotation first.')
      return
    }
    setActiveDrawer(null)
    let root: HTMLElement
    try {
      root = await waitForQuotationPrintRoot()
    } catch {
      showToast('Quotation not ready — try again.')
      return
    }
    const docEl = root.querySelector('.quotation-doc') as HTMLElement | null
    if (!docEl) {
      showToast('Quotation layout not found.')
      return
    }
    root.classList.add('quotation-print-capture', 'pdf-export-mode')
    document.body.classList.add('quotation-capture-active', 'pdf-export-active')
    try {
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      })
      await job(docEl)
      showToast(successToast)
    } catch (err) {
      console.error(err)
      showToast(failToast)
    } finally {
      root.classList.remove('quotation-print-capture', 'pdf-export-mode')
      document.body.classList.remove('quotation-capture-active', 'pdf-export-active')
    }
  }

  const handlePrint = async () => {
    if (isMobileOrPrintUnavailable()) {
      await runQuotationPdfJob(
        (docEl) => exportRailingQuotationPdf(docEl, `${(meta.quoteNumber || 'quote').replace(/[^\w.-]+/g, '_')}.pdf`),
        'PDF downloaded (use Share → Print on mobile).',
        'Print failed — try PDF.',
      )
      return
    }
    await runQuotationPdfJob(
      (docEl) => printRailingQuotationPdf(docEl),
      'Print dialog opened.',
      'Print failed — try PDF.',
    )
  }

  const handleExportPdf = async () => {
    const safeName = (meta.quoteNumber || 'railing-quote').replace(/[^\w.-]+/g, '_')
    await runQuotationPdfJob(
      (docEl) => exportRailingQuotationPdf(docEl, `${safeName}.pdf`),
      'PDF downloaded.',
      'PDF export failed — check logo / connection.',
    )
  }

  return (
    <div className={`app${activeDrawer ? ' drawer-open' : ''}${embedUnified ? ' railing-embed' : ''}`}>
      {embedUnified?.onPushLine && embedUnified?.onBackToWindows && (
        <div className="railing-embed-banner no-print">
          <button
            type="button"
            className="embed-back-btn"
            onClick={embedUnified.onBackToWindows}
          >
            ← Windows
          </button>
          <span className="embed-banner-text">
            Combined quote — items sync to main list
          </span>
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
        quickActions={
          <QuotationQuickActions
            quoteDisabled={lines.length === 0}
            onImportJson={() => importJsonRef.current?.click()}
            onExportJson={handleExportJson}
            onPrint={handlePrint}
            onExportPdf={handleExportPdf}
          />
        }
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

      <input
        ref={importJsonRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImportJsonFile(f)
          e.target.value = ''
        }}
      />

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
            embedUnified?.onRemoveLine?.(id)
          }}
          onClear={() => {
            setLines([])
            setEditingLineId(null)
            embedUnified?.onClearLines?.()
          }}
          onPreview={() => {
            setShowQuotePreview(true)
            setActiveDrawer(null)
            window.setTimeout(() => {
              document.getElementById('quotation-print-root')?.scrollTo({ top: 0, behavior: 'smooth' })
            }, 80)
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
          id="quotation-print-root"
          className={`quotation-print-root ${showQuotePreview ? 'on-screen-preview' : ''}`}
          role={showQuotePreview ? 'dialog' : undefined}
          aria-label={showQuotePreview ? 'Quotation preview' : undefined}
        >
          {showQuotePreview && (
            <button
              type="button"
              className="qdoc-preview-close no-print"
              onClick={() => setShowQuotePreview(false)}
            >
              Close preview
            </button>
          )}
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
