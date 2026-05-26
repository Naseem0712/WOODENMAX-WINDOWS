import { DEFAULT_QUOTE_INTRO, QUOTATION_TERMS } from './constants'
import type { QuotationMeta } from './types'

export function defaultMetaFields(): Pick<QuotationMeta, 'introText' | 'termsText'> {
  return {
    introText: DEFAULT_QUOTE_INTRO,
    termsText: QUOTATION_TERMS.join('\n'),
  }
}

export function normalizeQuotationMeta(meta: QuotationMeta): QuotationMeta {
  const defaults = defaultMetaFields()
  return {
    ...meta,
    introText: meta.introText?.trim() || defaults.introText,
    termsText: meta.termsText?.trim() || defaults.termsText,
  }
}

export function parseTermsLines(termsText: string): string[] {
  return termsText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}
