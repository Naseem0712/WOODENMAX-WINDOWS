import { COMPANY } from '../constants'
import {
  collectGlassPanelOrders,
  collectHardwareOrder,
  glassOrderTotals,
} from '../materialOrderDetails'
import { formatQuoteDate } from '../quotationFormat'
import type { DesignDraft, QuotationLine, QuotationMeta } from '../types'
import { CompanyLogo } from './CompanyLogo'

interface Props {
  meta: QuotationMeta
  lines: QuotationLine[]
  currentDraft: DesignDraft | null
}

function OrderClientHeader({ meta, title }: { meta: QuotationMeta; title: string }) {
  return (
    <header className="order-doc-header">
      <div className="order-doc-brand">
        <CompanyLogo size={48} />
        <div>
          <p className="order-doc-company">{COMPANY.name}</p>
          <h1 className="order-doc-title">{title}</h1>
        </div>
      </div>
      <table className="order-doc-meta">
        <tbody>
          <tr>
            <th>Client</th>
            <td>
              <strong>{meta.clientName?.trim() || '—'}</strong>
            </td>
          </tr>
          <tr>
            <th>Project</th>
            <td>{meta.projectName?.trim() || '—'}</td>
          </tr>
          <tr>
            <th>Quote #</th>
            <td>{meta.quoteNumber}</td>
          </tr>
          <tr>
            <th>Date</th>
            <td>{formatQuoteDate(meta.date)}</td>
          </tr>
          <tr>
            <th>Phone</th>
            <td>{meta.clientPhone?.trim() || '—'}</td>
          </tr>
        </tbody>
      </table>
    </header>
  )
}

export function OrderPrintDocument({ meta, lines, currentDraft }: Props) {
  const hardware = collectHardwareOrder(lines, currentDraft)
  const glassRows = collectGlassPanelOrders(lines, currentDraft)
  const glassTotals = glassOrderTotals(glassRows)

  return (
    <div className="order-doc">
      <section className="order-doc-page order-doc-hardware">
        <OrderClientHeader meta={meta} title="Hardware & rails order" />
        <table className="order-doc-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Item</th>
              <th>Specification</th>
              <th>Qty</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {hardware.length === 0 ? (
              <tr>
                <td colSpan={5}>No hardware in quotation yet.</td>
              </tr>
            ) : (
              hardware.map((r, i) => (
                <tr key={i}>
                  <td>{r.category}</td>
                  <td>{r.item}</td>
                  <td>{r.specification}</td>
                  <td>
                    <strong>{r.totalQty}</strong>
                  </td>
                  <td>{r.unit}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {hardware.length > 0 && (
          <p className="order-doc-footnote">
            Used in: {hardware.map((h) => h.sources.join(', ')).join(' · ')}
          </p>
        )}
      </section>

      <section className="order-doc-page order-doc-glass">
        <OrderClientHeader meta={meta} title="Glass order — sizes & area" />
        <table className="order-doc-table order-doc-glass-table">
          <thead>
            <tr>
              <th>Design</th>
              <th>Side</th>
              <th>#</th>
              <th>W mm</th>
              <th>H mm</th>
              <th>Type</th>
              <th>Colour</th>
              <th>Sets</th>
              <th>Pcs</th>
              <th>SFT/pc</th>
              <th>Total SFT</th>
            </tr>
          </thead>
          <tbody>
            {glassRows.length === 0 ? (
              <tr>
                <td colSpan={11}>No glass panels in quotation yet.</td>
              </tr>
            ) : (
              glassRows.map((g, i) => (
                <tr key={i}>
                  <td>{g.designName}</td>
                  <td>{g.segmentLabel}</td>
                  <td>{g.panelIndex}</td>
                  <td>{g.widthMm}</td>
                  <td>{g.heightMm}</td>
                  <td>{g.glassType}</td>
                  <td>{g.glassColor}</td>
                  <td>{g.setsQty}</td>
                  <td>{g.totalPanels}</td>
                  <td>{g.areaSftPerPanel}</td>
                  <td>
                    <strong>{g.totalAreaSft}</strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {glassRows.length > 0 && (
          <div className="order-doc-glass-totals">
            <p>
              <strong>Total panels:</strong> {glassTotals.totalPanels}
            </p>
            <p>
              <strong>Total glass area:</strong> {glassTotals.totalAreaSft} SFT
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
