import { useEffect, useRef } from 'react'
import { displayQtyForUnit } from '../costing'
import type { CostBreakdown, DesignDraft, PackageRates, RateDisplayUnit } from '../types'
import {
  bomSetRatesForBreakdown,
  DEFAULT_PACKAGE_RATES,
  normalizePackageRates,
  packageInstallationKey,
  packageLineTotal,
  packageMaterialKey,
  resolvePackageQuote,
  setRateForQuoteUnit,
} from '../packagePricing'
import { formatCurrency } from '../utils'

interface Props {
  draft: DesignDraft
  breakdown: CostBreakdown
  onChange: (patch: Partial<DesignDraft>) => void
}

const QUOTE_UNITS: RateDisplayUnit[] = ['rft', 'sft', 'rmt']

export function DesignQuoteRatePanel({ draft, breakdown, onChange }: Props) {
  const rates = normalizePackageRates(draft.packageRates ?? DEFAULT_PACKAGE_RATES)
  const unit = draft.packageQuoteUnit ?? 'rft'
  const pq = resolvePackageQuote(draft, breakdown)
  const total = packageLineTotal(draft, breakdown)
  const basis = displayQtyForUnit(breakdown, unit)
  const userEditedMaterial = useRef(false)

  const matKey = packageMaterialKey(unit)
  const instKey = packageInstallationKey(unit)
  const bomSetRates = bomSetRatesForBreakdown(breakdown)
  const costingMat = setRateForQuoteUnit(bomSetRates, unit)

  useEffect(() => {
    if (userEditedMaterial.current) return
    const nextMat = setRateForQuoteUnit(bomSetRates, unit) ?? 0
    if (nextMat <= 0) return
    if (rates[matKey] === nextMat) return
    onChange({ packageRates: { ...rates, [matKey]: nextMat } })
  }, [
    bomSetRates.perSft,
    bomSetRates.perRft,
    bomSetRates.perRmt,
    bomSetRates.railRftBasis,
    unit,
    rates[matKey],
    onChange,
  ])

  const setMaterialRate = (value: number) => {
    userEditedMaterial.current = true
    onChange({ packageRates: { ...rates, [matKey]: value } })
  }

  const setInstallRate = (value: number) => {
    onChange({ packageRates: { ...rates, [instKey]: value } })
  }

  const fillMaterialFromCosting = () => {
    userEditedMaterial.current = false
    const v = costingMat ?? 0
    if (v > 0) onChange({ packageRates: { ...rates, [matKey]: v } })
  }

  return (
    <div className="design-quote-rate-panel">
      <p className="hint">
        <strong>Quotation rates</strong> — glass is always costed in SFT (see costing strip above).
        Choose one unit for this quote (default RFT).
      </p>

      <div className="toggle-row">
        <span className="toggle-label">Quote unit:</span>
        {QUOTE_UNITS.map((u) => (
          <button
            key={u}
            type="button"
            className={unit === u ? 'toggle active' : 'toggle'}
            onClick={() => onChange({ packageQuoteUnit: u })}
          >
            Per {u.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="field-grid quote-rate-inputs">
        <label className="field package-rate-active">
          <span>
            Material ₹ / {unit.toUpperCase()}{' '}
            <span className="field-basis">
              ({basis.label}: {basis.qty} {unit.toUpperCase()})
            </span>
          </span>
          <div className="input-row">
            <span className="input-prefix">₹</span>
            <input
              type="number"
              min={0}
              step={1}
              value={rates[matKey] || ''}
              onChange={(e) => setMaterialRate(Number(e.target.value))}
            />
          </div>
          {costingMat != null && costingMat > 0 && (
            <small className="ref">
              From BOM: {formatCurrency(costingMat)}/{unit.toUpperCase()}
            </small>
          )}
        </label>

        <label className="field package-rate-install package-rate-active">
          <span>
            Installation ₹ / {unit.toUpperCase()}{' '}
            <span className="field-basis">(labour on quote basis)</span>
          </span>
          <div className="input-row">
            <span className="input-prefix">₹</span>
            <input
              type="number"
              min={0}
              step={1}
              value={rates[instKey] || ''}
              onChange={(e) => setInstallRate(Number(e.target.value))}
            />
          </div>
        </label>
      </div>

      <button type="button" className="btn-ghost btn-sm" onClick={fillMaterialFromCosting}>
        Fill material from costing ({unit.toUpperCase()})
      </button>

      <div className="package-quote-preview">
        <p className="package-rate-breakdown">
          {formatCurrency(pq.materialRate)}/{unit.toUpperCase()} material
          {pq.installationRate > 0 ? (
            <>
              {' '}
              + {formatCurrency(pq.installationRate)}/{unit.toUpperCase()} installation
            </>
          ) : (
            ' + installation (enter above)'
          )}{' '}
          = <strong>{formatCurrency(pq.rate)}</strong>/{unit.toUpperCase()} × {pq.basisQty}{' '}
          {unit.toUpperCase()} = <strong>{formatCurrency(pq.amountPerSet)}</strong> / set
        </p>
        <p className="package-quote-total">
          × {draft.quantity} set(s) = <strong>{formatCurrency(total)}</strong>
        </p>
      </div>
    </div>
  )
}
