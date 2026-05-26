import { useMemo } from 'react'
import {
  collectGlassPanelOrders,
  collectHardwareOrder,
  glassOrderTotals,
} from '../materialOrderDetails'
import type { DesignDraft, QuotationLine, QuotationMeta } from '../types'

interface Props {
  lines: QuotationLine[]
  currentDraft: DesignDraft
  meta: QuotationMeta
  onDownloadHardware: () => void
  onDownloadGlass: () => void
  onDownloadFullBom: () => void
  onPrintOrder: () => void
  canDownload: boolean
  embedded?: boolean
}

export function MaterialOrderPanel({
  lines,
  currentDraft,
  meta,
  onDownloadHardware,
  onDownloadGlass,
  onDownloadFullBom,
  onPrintOrder,
  canDownload,
  embedded = false,
}: Props) {
  const hardware = useMemo(
    () => collectHardwareOrder(lines, currentDraft),
    [lines, currentDraft],
  )
  const glassRows = useMemo(
    () => collectGlassPanelOrders(lines, currentDraft),
    [lines, currentDraft],
  )
  const glassTotals = useMemo(() => glassOrderTotals(glassRows), [glassRows])

  const clientLabel = meta.clientName?.trim() || 'Client name'

  if (hardware.length === 0 && glassRows.length === 0) {
    return (
      <div className={embedded ? 'order-panel-embedded' : 'order-panel'}>
        <p className="hint">
          Add designs to quotation — then download hardware / glass Excel or print 2-page order
          PDF ({clientLabel}).
        </p>
        <div className="order-download-row">
          <button type="button" className="btn-download-bom" disabled>
            Hardware Excel
          </button>
          <button type="button" className="btn-download-bom" disabled>
            Glass Excel
          </button>
          <button type="button" className="btn-ghost" disabled>
            Print order PDF
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={embedded ? 'order-panel-embedded' : 'order-panel'}>
      {!embedded && (
        <div className="order-panel-head">
          <h3>
            Order materials <span className="hi">ऑर्डर</span>
          </h3>
        </div>
      )}

      <p className="hint order-client-hint">
        Client: <strong>{clientLabel}</strong> · Quote {meta.quoteNumber}
      </p>

      <div className="order-download-row">
        <button
          type="button"
          className="btn-download-bom"
          onClick={onDownloadHardware}
          disabled={!canDownload}
        >
          📥 Hardware Excel
        </button>
        <button
          type="button"
          className="btn-download-bom"
          onClick={onDownloadGlass}
          disabled={!canDownload}
        >
          📥 Glass Excel
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onPrintOrder}
          disabled={!canDownload}
        >
          🖨 Print order PDF
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={onDownloadFullBom}
          disabled={!canDownload}
        >
          Full BOM CSV
        </button>
      </div>

      <p className="hint">
        Print/PDF: page 1 hardware &amp; rails, page 2 glass with size, qty, area SFT. Excel files
        open in Microsoft Excel.
      </p>

      <h4 className="order-section-title">Hardware &amp; rails (combined)</h4>
      <div className="table-scroll">
        <table className="order-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Spec</th>
              <th>Total qty</th>
              <th>From</th>
            </tr>
          </thead>
          <tbody>
            {hardware.map((r, i) => (
              <tr key={i}>
                <td>{r.item}</td>
                <td>{r.specification}</td>
                <td>
                  <strong>
                    {r.totalQty} {r.unit}
                  </strong>
                </td>
                <td className="order-sources">{r.sources.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="order-section-title">
        Glass panels — {glassTotals.totalAreaSft} SFT total
      </h4>
      <div className="table-scroll">
        <table className="order-table order-glass-detail-table">
          <thead>
            <tr>
              <th>Design</th>
              <th>Side</th>
              <th>W×H mm</th>
              <th>Type</th>
              <th>Sets</th>
              <th>Pcs</th>
              <th>SFT/pc</th>
              <th>Total SFT</th>
            </tr>
          </thead>
          <tbody>
            {glassRows.map((g, i) => (
              <tr key={i}>
                <td>{g.designName}</td>
                <td>{g.segmentLabel}</td>
                <td>
                  {g.widthMm}×{g.heightMm}
                </td>
                <td>{g.glassType}</td>
                <td>{g.setsQty}</td>
                <td>{g.totalPanels}</td>
                <td>{g.areaSftPerPanel}</td>
                <td>
                  <strong>{g.totalAreaSft}</strong>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} className="text-right">
                <strong>Total</strong>
              </td>
              <td>
                <strong>{glassTotals.totalAreaSft} SFT</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
