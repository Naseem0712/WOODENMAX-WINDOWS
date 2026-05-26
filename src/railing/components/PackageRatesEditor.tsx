import { useEffect, useRef } from 'react'
import type { CostBreakdown, DesignDraft, PackageRates, RateDisplayUnit } from '../types'
import {
  DEFAULT_PACKAGE_RATES,
  packageLineTotal,
  packageRatesFromSetRates,
  resolvePackageQuote,
} from '../packagePricing'
import { quoteRailRft } from '../railLength'
import { formatCurrency } from '../utils'

interface Props {
  draft: DesignDraft
  breakdown: CostBreakdown
  onChange: (patch: Partial<DesignDraft>) => void
}

export function PackageRatesEditor({ draft, breakdown, onChange }: Props) {
  const rates = draft.packageRates ?? DEFAULT_PACKAGE_RATES
  const unit = draft.packageQuoteUnit ?? breakdown.displayUnit
  const pq = resolvePackageQuote(draft, breakdown)
  const total = packageLineTotal(draft, breakdown)
  const userEdited = useRef(false)

  useEffect(() => {
    if (userEdited.current) return
    const suggested = packageRatesFromSetRates(breakdown.setRates)
    const hasSuggested =
      (suggested.perSft ?? 0) > 0 ||
      (suggested.perRft ?? 0) > 0 ||
      (suggested.perRmt ?? 0) > 0
    if (!hasSuggested) return
    const same =
      rates.perSft === suggested.perSft &&
      rates.perRft === suggested.perRft &&
      rates.perRmt === suggested.perRmt
    if (!same) onChange({ packageRates: suggested })
  }, [
    breakdown.setRates.perSft,
    breakdown.setRates.perRft,
    breakdown.setRates.perRmt,
    rates.perSft,
    rates.perRft,
    rates.perRmt,
    onChange,
  ])

  const setRates = (patch: Partial<PackageRates>) => {
    userEdited.current = true
    onChange({ packageRates: { ...rates, ...patch } })
  }

  const setUnit = (packageQuoteUnit: RateDisplayUnit) => {
    onChange({ packageQuoteUnit })
  }

  const applySuggested = () => {
    userEdited.current = false
    onChange({ packageRates: packageRatesFromSetRates(breakdown.setRates) })
  }

  const fields: { key: keyof PackageRates; unit: RateDisplayUnit; label: string; basis: string }[] =
    [
      {
        key: 'perSft',
        unit: 'sft',
        label: 'Package rate per SFT',
        basis: `${breakdown.glassAreaSft} SFT`,
      },
      {
        key: 'perRft',
        unit: 'rft',
        label: 'Package rate per RFT',
        basis: `${breakdown.setRates?.railRftBasis ?? quoteRailRft(breakdown.perimeterRmt, breakdown.bottomRailRft, breakdown.handrailRft)} RFT run`,
      },
      {
        key: 'perRmt',
        unit: 'rmt',
        label: 'Package rate per RMT',
        basis: `${breakdown.perimeterRmt} RMT`,
      },
    ]

  return (
    <div className="package-rates-editor">
      <div className="package-rates-head">
        <p className="hint">
          <strong>Package rate</strong> — edit karke apna rate daalo. Quotation & PDF isi rate se
          banenge.
        </p>
        <button type="button" className="btn-ghost btn-sm" onClick={applySuggested}>
          Fill from costing
        </button>
      </div>

      <p className="toggle-label">Quote on basis:</p>
      <div className="toggle-row package-unit-row">
        {(['sft', 'rft', 'rmt'] as RateDisplayUnit[]).map((u) => (
          <button
            key={u}
            type="button"
            className={unit === u ? 'toggle active' : 'toggle'}
            onClick={() => setUnit(u)}
          >
            Per {u.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="package-rate-fields">
        {fields.map((f) => (
          <label
            key={f.key}
            className={`field package-rate-field ${unit === f.unit ? 'package-rate-active' : ''}`}
          >
            <span>
              {f.label} <span className="hi-sm">({f.basis})</span>
            </span>
            <div className="input-row">
              <span className="input-prefix">₹</span>
              <input
                type="number"
                min={0}
                step={1}
                value={rates[f.key] || ''}
                onChange={(e) => setRates({ [f.key]: Number(e.target.value) })}
                onFocus={() => setUnit(f.unit)}
              />
              <span className="unit">/{f.unit.toUpperCase()}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="package-quote-preview">
        <p>
          Selected: <strong>{pq.basisQty}</strong> {unit.toUpperCase()} ({pq.basisLabel}) ×{' '}
          <strong>{formatCurrency(pq.rate)}</strong>/{unit.toUpperCase()} ={' '}
          <strong>{formatCurrency(pq.amountPerSet)}</strong> / set
        </p>
        <p className="package-quote-total">
          × {draft.quantity} set = <strong>{formatCurrency(total)}</strong>
        </p>
      </div>
    </div>
  )
}
