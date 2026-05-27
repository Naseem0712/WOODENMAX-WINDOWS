import { DEFAULT_QUOTE_INTRO, QUOTATION_BANK, QUOTATION_TERMS } from './constants'
import type { QuotationBankDetails, QuotationMeta } from './types'

export function defaultBankDetails(): QuotationBankDetails {
  return {
    accountName: QUOTATION_BANK.accountName,
    bankName: QUOTATION_BANK.bankName,
    accountNo: QUOTATION_BANK.accountNo,
    ifsc: QUOTATION_BANK.ifsc,
    branch: QUOTATION_BANK.branch,
  }
}

export function defaultMetaFields(): Pick<QuotationMeta, 'introText' | 'termsText' | 'bankDetails'> {
  return {
    introText: DEFAULT_QUOTE_INTRO,
    termsText: QUOTATION_TERMS.join('\n'),
    bankDetails: defaultBankDetails(),
  }
}

export function bankDetailsForQuote(meta: QuotationMeta): QuotationBankDetails {
  const b = meta.bankDetails
  const d = defaultBankDetails()
  return {
    accountName: b?.accountName?.trim() || d.accountName,
    bankName: b?.bankName?.trim() || d.bankName,
    accountNo: b?.accountNo?.trim() || d.accountNo,
    ifsc: b?.ifsc?.trim() || d.ifsc,
    branch: b?.branch?.trim() || d.branch,
  }
}

export function normalizeQuotationMeta(meta: QuotationMeta): QuotationMeta {
  const defaults = defaultMetaFields()
  const bank = bankDetailsForQuote(meta)
  return {
    ...meta,
    introText: meta.introText?.trim() || defaults.introText,
    termsText: meta.termsText?.trim() || defaults.termsText,
    bankDetails: bank,
  }
}

export function parseTermsLines(termsText: string): string[] {
  return termsText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}
