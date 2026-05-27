import { useEffect, useRef } from 'react'
import type { CostBreakdown, DesignDraft, PackageRates, RateDisplayUnit } from '../types'
import {
  DEFAULT_PACKAGE_RATES,
  normalizePackageRates,
  packageLineTotal,
  packageMaterialKey,
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
  const rates = normalizePackageRates(draft.packageRates ?? DEFAULT_PACKAGE_RATES)
  const unit = draft.packageQuoteUnit ?? breakdown.displayUnit
  const pq = resolvePackageQuote(draft, breakdown)
  const total = packageLineTotal(draft, breakdown)
  const userEdited = useRef(false)

  useEffect(() => {
    if (userEdited.current) return
    const suggested = packageRatesFromSetRates(breakdown.setRates, unit)
    const nextMat = suggested[packageMaterialKey(unit)]
    if (nextMat <= 0) return
    if (rates[packageMaterialKey(unit)] > 0) return
    onChange({
      packageRates: { ...rates, [packageMaterialKey(unit)]: nextMat },
    })
  }, [
    breakdown.setRates?.perSft,
    breakdown.setRates?.perRft,
    breakdown.setRates?.perRmt,
    breakdown.subtotal,
    unit,
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
    onChange({
      packageRates: {
        ...rates,
        ...packageRatesFromSetRates(breakdown.setRates, unit),
      },
    })
  }

  const materialFields: {
    key: keyof Pick<PackageRates, 'perSft' | 'perRft' | 'perRmt'>
    installKey: keyof Pick<PackageRates, 'installationPerSft' | 'installationPerRft' | 'installationPerRmt'>
    unit: RateDisplayUnit
    label: string
    basis: string
  }[] = [
    {
      key: 'perSft',
      installKey: 'installationPerSft',
      unit: 'sft',
      label: 'Material rate per SFT',
      basis: `${breakdown.glassAreaSft} SFT`,
    },
    {
      key: 'perRft',
      installKey: 'installationPerRft',
      unit: 'rft',
      label: 'Material rate per RFT',
      basis: `${breakdown.setRates?.railRftBasis ?? quoteRailRft(breakdown.perimeterRmt, breakdown.bottomRailRft, breakdown.handrailRft)} RFT run`,
    },
    {
      key: 'perRmt',
      installKey: 'installationPerRmt',
      unit: 'rmt',
      label: 'Material rate per RMT',
      basis: `${breakdown.perimeterRmt} RMT`,
    },
  ]

  return (
    <div className="package-rates-editor">
      <div className="package-rates-head">
        <p className="hint">
          <strong>Package rate</strong> — material + installation below. Quotation and PDF use the
          combined total for the selected unit.
        </p>
        <button type="button" className="btn-ghost btn-sm" onClick={applySuggested}>
          Fill material from costing
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

      <p className="package-section-label">Material (supply)</p>
      <div className="package-rate-fields">
        {materialFields.map((f) => (
          <label
            key={f.key}
            className={`field package-rate-field ${unit === f.unit ? 'package-rate-active' : ''}`}
          >
            <span>
              {f.label} <span className="field-basis">({f.basis})</span>
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

      <p className="package-section-label">Installation / labour</p>
      <div className="package-rate-fields">
        {materialFields.map((f) => (
          <label
            key={f.installKey}
            className={`field package-rate-field package-rate-install ${unit === f.unit ? 'package-rate-active' : ''}`}
          >
            <span>
              Installation per {f.unit.toUpperCase()}{' '}
              <span className="field-basis">({f.basis})</span>
            </span>
            <div className="input-row">
              <span className="input-prefix">₹</span>
              <input
                type="number"
                min={0}
                step={1}
                value={rates[f.installKey] || ''}
                onChange={(e) => setRates({ [f.installKey]: Number(e.target.value) })}
                onFocus={() => setUnit(f.unit)}
              />
              <span className="unit">/{f.unit.toUpperCase()}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="package-quote-preview">
        <p>
          Selected: <strong>{pq.basisQty}</strong> {unit.toUpperCase()} ({pq.basisLabel})
        </p>
        <p className="package-rate-breakdown">
          Material {formatCurrency(pq.materialRate)}/{unit.toUpperCase()}
          {pq.installationRate > 0 ? (
            <>
              {' '}
              + Installation {formatCurrency(pq.installationRate)}/{unit.toUpperCase()}
            </>
          ) : null}{' '}
          = <strong>{formatCurrency(pq.rate)}</strong>/{unit.toUpperCase()} × {pq.basisQty} ={' '}
          <strong>{formatCurrency(pq.amountPerSet)}</strong> / set
        </p>
        <p className="package-quote-total">
          × {draft.quantity} set = <strong>{formatCurrency(total)}</strong>
        </p>
      </div>
    </div>
  )
}
