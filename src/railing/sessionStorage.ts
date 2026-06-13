import { migrateQuotationLine } from './backup'
import { normalizeQuotationMeta } from './metaDefaults'
import { recalculateQuoteLine, hydrateQuotationLine } from './quotationFormat'
import { normalizeDraft } from './draftMigrate'
import { DEFAULT_RATES } from './rateStorage'
import { loadProjectSettings } from './projectStorage'
import type { DesignDraft, QuotationLine, QuotationMeta } from './types'

const SESSION_KEY = 'railingq-session-v1'

export interface SessionState {
  version: 1
  meta: QuotationMeta
  lines: QuotationLine[]
  draft: DesignDraft
}

export function loadSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SessionState
    if (!data.meta || !Array.isArray(data.lines) || !data.draft) return null
    const rates = loadProjectSettings().rates ?? DEFAULT_RATES
    return {
      version: 1,
      meta: normalizeQuotationMeta(data.meta),
      lines: data.lines.map((l) => hydrateQuotationLine(migrateQuotationLine(l, rates))),
      draft: normalizeDraft(data.draft),
    }
  } catch {
    return null
  }
}

export function saveSession(state: SessionState): void {
  try {
    const payload: SessionState = {
      version: 1,
      meta: state.meta,
      lines: state.lines,
      draft: normalizeDraft(state.draft),
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch (err) {
    console.error('saveSession failed', err)
  }
}

/** Save immediately after import (no debounce race). */
export function saveSessionNow(
  meta: QuotationMeta,
  lines: QuotationLine[],
  draft: DesignDraft,
): void {
  saveSession({ version: 1, meta, lines, draft })
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
