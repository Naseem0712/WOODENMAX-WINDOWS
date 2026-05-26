import type { CustomCharge } from '../types'
import { formatCurrency } from '../utils'

interface Props {
  charges: CustomCharge[]
  onChange: (charges: CustomCharge[]) => void
}

export function CustomChargesEditor({ charges, onChange }: Props) {
  const total = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0)

  const update = (index: number, patch: Partial<CustomCharge>) => {
    onChange(charges.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  const add = () => onChange([...charges, { label: '', amount: 0 }])

  const remove = (index: number) => onChange(charges.filter((_, i) => i !== index))

  return (
    <div className="custom-charges-editor">
      <p className="section-desc">
        Extra charges (farma, chemical, transport…) — har set par add honge.
      </p>
      {charges.map((c, i) => (
        <div key={i} className="custom-charge-row">
          <label className="field flex-grow">
            <span>Description</span>
            <input
              type="text"
              placeholder="e.g. Farma / chemical"
              value={c.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
          </label>
          <label className="field charge-amt">
            <span>₹ / set</span>
            <input
              type="number"
              min={0}
              step={1}
              value={c.amount || ''}
              onChange={(e) => update(i, { amount: Number(e.target.value) })}
            />
          </label>
          <button type="button" className="btn-icon-text danger" onClick={() => remove(i)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn-ghost" onClick={add}>
        + Add extra charge
      </button>
      {total > 0 && (
        <p className="calc-result">
          Extras per set: <strong>{formatCurrency(total)}</strong>
        </p>
      )}
    </div>
  )
}
