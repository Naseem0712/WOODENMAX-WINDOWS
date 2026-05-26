import { normalizeDraft } from './draftMigrate'
import { DEFAULT_RATES } from './rateStorage'
import type { CostingRates, DesignDraft, QuotationLine, QuotationMeta } from './types'
import { DEFAULT_PRESETS, type QuotationPresets } from './modePreset'
import { ratesForMode, resolveDraftMode } from './presets'
import { DEFAULT_DESIGN, type DesignDefaults } from './projectStorage'
import { DEFAULT_FINISH } from './constants'
import { normalizeQuotationMeta } from './metaDefaults'
import { recalculateQuoteLine } from './quotationFormat'
import { draftToLine } from './utils'
import type { QuotationItem, QuotationSettings } from '../types'

export const BACKUP_VERSION = 2

export interface AppBackup {
  version: number
  exportedAt: string
  meta: QuotationMeta
  lines: QuotationLine[]
  rates: CostingRates
  designDefaults: DesignDefaults
  presets?: QuotationPresets
  ratesNormal?: CostingRates
  ratesStaircase?: CostingRates
  draft: DesignDraft | null
}

export function buildBackup(
  meta: QuotationMeta,
  lines: QuotationLine[],
  presets: QuotationPresets,
  ratesNormal: CostingRates,
  ratesStaircase: CostingRates,
  draft: DesignDraft,
): AppBackup {
  const legacyDefaults: DesignDefaults = {
    ...presets.normal,
    hardwareMode: 'normal',
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    meta,
    lines,
    rates: ratesNormal,
    designDefaults: legacyDefaults,
    presets: structuredClone(presets),
    ratesNormal: structuredClone(ratesNormal),
    ratesStaircase: structuredClone(ratesStaircase),
    draft: structuredClone(draft),
  }
}

export function downloadBackupJson(backup: AppBackup, filename?: string) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    filename ??
    `WoodenMax-backup-${backup.meta.quoteNumber || 'quote'}-${backup.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * WoodenMax “View quotation → Export JSON” shape: { settings, items }.
 * Convert railing rows into an AppBackup so the same file can be imported in the railing designer.
 */
function tryParseWoodenMaxQuotationExport(raw: Record<string, unknown>): AppBackup | null {
  const settings = raw.settings
  const items = raw.items
  if (!settings || typeof settings !== 'object' || !Array.isArray(items)) return null

  const railingLines: QuotationLine[] = []
  for (const it of items as unknown[]) {
    if (!it || typeof it !== 'object') continue
    const row = it as QuotationItem
    if (row.kind === 'railing' && row.railingLine) {
      railingLines.push(structuredClone(row.railingLine) as QuotationLine)
    }
  }
  if (railingLines.length === 0) return null

  const s = settings as QuotationSettings
  const meta = normalizeQuotationMeta({
    clientName: s.customer?.name ?? '',
    clientPhone: s.customer?.contactPerson ?? '',
    clientAddress: s.customer?.address ?? '',
    projectName: s.title ?? '',
    quoteNumber: `WM-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    date: new Date().toISOString().slice(0, 10),
    introText: s.description ?? '',
    termsText: s.terms ?? '',
  })

  const draft = railingLines[0]?.draftSnapshot
    ? normalizeDraft(structuredClone(railingLines[0].draftSnapshot))
    : null

  const base: AppBackup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    meta,
    lines: railingLines,
    rates: { ...DEFAULT_RATES },
    designDefaults: { ...DEFAULT_DESIGN, hardwareMode: 'normal' },
    presets: structuredClone(DEFAULT_PRESETS),
    ratesNormal: { ...DEFAULT_RATES },
    ratesStaircase: { ...DEFAULT_RATES },
    draft,
  }

  const emb = raw.railingEmbeddedProject
  if (emb && typeof emb === 'object') {
    const rp = emb as {
      presets?: QuotationPresets
      ratesNormal?: Partial<CostingRates>
      ratesStaircase?: Partial<CostingRates>
    }
    if (rp.ratesNormal && typeof rp.ratesNormal === 'object') {
      base.ratesNormal = { ...DEFAULT_RATES, ...rp.ratesNormal }
      base.rates = base.ratesNormal
    }
    if (rp.ratesStaircase && typeof rp.ratesStaircase === 'object') {
      base.ratesStaircase = { ...DEFAULT_RATES, ...rp.ratesStaircase }
    }
    if (rp.presets) {
      base.presets = {
        normal: { ...DEFAULT_PRESETS.normal, ...rp.presets.normal },
        staircase: { ...DEFAULT_PRESETS.staircase, ...rp.presets.staircase },
      }
      base.designDefaults = {
        ...base.presets.normal,
        hardwareMode: 'normal',
      }
    }
  }

  return base
}

export function parseBackupJson(text: string): AppBackup {
  const raw = JSON.parse(text) as Record<string, unknown>

  const fromMainExport = tryParseWoodenMaxQuotationExport(raw)
  if (fromMainExport) return fromMainExport

  const extended = raw as unknown as AppBackup & {
    quotationLines?: QuotationLine[]
    quotation?: QuotationLine[]
  }
  const lines = extended.lines ?? extended.quotationLines ?? extended.quotation
  if (!extended.meta || !Array.isArray(lines)) {
    throw new Error(
      'Invalid backup file — need railing backup (meta + lines) or WoodenMax quotation export with railing items.',
    )
  }
  return { ...extended, lines }
}

function migrateDraft(d: DesignDraft): DesignDraft {
  const fixed: DesignDraft = {
    ...d,
    designName: d.designName ?? '',
    designType: ((d.designType as string) === 'c-type' ? 'o-type' : d.designType) as DesignDraft['designType'],
  }
  return normalizeDraft(fixed)
}

/** Re-hydrate a saved quotation line so UI & costing never break after import. */
export function migrateQuotationLine(
  line: QuotationLine,
  rates: CostingRates,
): QuotationLine {
  const designType =
    ((line.designType as string) === 'c-type' ? 'o-type' : line.designType) as QuotationLine['designType']

  if (!line.draftSnapshot) {
    const items = line.costing?.items ?? []
    return {
      ...line,
      designType,
      designName: line.designName ?? '',
      costing: {
        items,
        subtotal: line.costing?.subtotal ?? line.amount ?? 0,
        referenceSubtotal: line.costing?.referenceSubtotal ?? 0,
        glassAreaSft: line.costing?.glassAreaSft ?? 0,
        bottomRailRft: line.costing?.bottomRailRft ?? 0,
        handrailRft: line.costing?.handrailRft ?? 0,
        perimeterRmt: line.costing?.perimeterRmt ?? 0,
        totalAnchors: line.costing?.totalAnchors ?? 0,
        displayUnit: line.costing?.displayUnit ?? rates.quoteDisplayUnit,
        setRates: line.costing?.setRates ?? {
          perSft: null,
          perRft: null,
          perRmt: null,
          railRftBasis: 0,
        },
        design: line.costing?.design ?? line.calculation,
      },
    }
  }

  const snapshot = migrateDraft(line.draftSnapshot)
  const fresh = draftToLine(snapshot, rates, {
    id: line.id,
    createdAt: line.createdAt,
  })

  const merged: QuotationLine = {
    ...fresh,
    designType,
    designName: line.designName?.trim() || fresh.designName,
    quantity: line.quantity > 0 ? line.quantity : fresh.quantity,
    notes: line.notes ?? fresh.notes,
    customCharges: line.customCharges?.length ? line.customCharges : fresh.customCharges,
    packageQuote: line.packageQuote ?? fresh.packageQuote,
    internalCosting: line.internalCosting ?? fresh.internalCosting,
    calculation: line.calculation ?? fresh.calculation,
    costing: line.packageQuote
      ? {
          ...fresh.costing,
          subtotal: line.packageQuote.amountPerSet,
          items: fresh.costing.items,
          displayUnit: line.packageQuote.unit,
        }
      : line.costing?.items
        ? { ...line.costing, design: line.costing.design ?? fresh.calculation }
        : fresh.costing,
  }

  return recalculateQuoteLine(merged)
}

/** Migrate old c-type to o-type; full quotation line repair on import */
export function migrateBackup(data: AppBackup): AppBackup {
  const baseRates = { ...DEFAULT_RATES, ...data.rates }
  const presets: QuotationPresets = data.presets
    ? {
        normal: { ...DEFAULT_PRESETS.normal, ...data.presets.normal },
        staircase: { ...DEFAULT_PRESETS.staircase, ...data.presets.staircase },
      }
    : {
        normal: {
          ...DEFAULT_PRESETS.normal,
          ...(data.designDefaults ?? DEFAULT_DESIGN),
          customCharges: data.designDefaults?.customCharges ?? [],
        },
        staircase: { ...DEFAULT_PRESETS.staircase },
      }
  const ratesNormal = { ...baseRates, ...data.ratesNormal }
  const ratesStaircase = { ...baseRates, ...data.ratesStaircase }
  const lines = data.lines.map((l) => {
    const mode = l.draftSnapshot ? resolveDraftMode(l.draftSnapshot) : 'normal'
    const r = ratesForMode(ratesNormal, ratesStaircase, mode)
    return migrateQuotationLine(l, r)
  })
  const draft = data.draft
    ? migrateDraft(data.draft)
    : lines[0]?.draftSnapshot
      ? migrateDraft(lines[0].draftSnapshot)
      : null

  return {
    ...data,
    rates: ratesNormal,
    ratesNormal,
    ratesStaircase,
    presets,
    lines,
    draft,
    meta: normalizeQuotationMeta({
      ...data.meta,
      clientName: data.meta.clientName ?? '',
      clientPhone: data.meta.clientPhone ?? '',
      clientAddress: data.meta.clientAddress ?? '',
      projectName: data.meta.projectName ?? '',
      quoteNumber: data.meta.quoteNumber ?? `WM-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      date: data.meta.date ?? new Date().toISOString().slice(0, 10),
    }),
    designDefaults: {
      ...DEFAULT_DESIGN,
      ...data.designDefaults,
      finish: { ...DEFAULT_FINISH, ...data.designDefaults?.finish },
    },
  }
}
