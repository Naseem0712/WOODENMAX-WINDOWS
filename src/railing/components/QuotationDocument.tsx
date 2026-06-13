import { COMPANY } from '../constants'
import { bankDetailsForQuote, parseTermsLines } from '../metaDefaults'
import { formatQuoteMoney } from '../utils'
import { formatQuoteDate, quoteTotals, resolveQuotationLine } from '../quotationFormat'
import type { QuotationLine, QuotationMeta } from '../types'
import { CompanyLogo } from './CompanyLogo'
import { RailingQuotationLinePrintBlock } from './RailingQuotationLinePrintBlock'

interface Props {
  meta: QuotationMeta
  lines: QuotationLine[]
}

function InfoRow({
  label,
  value,
  strong,
  alwaysShow,
}: {
  label: string
  value: string
  strong?: boolean
  alwaysShow?: boolean
}) {
  const trimmed = value?.trim()
  if (!alwaysShow && (!trimmed || trimmed === '—')) return null
  const display = trimmed || '—'
  return (
    <tr>
      <th scope="row" className="qdoc-info-label">
        {label}
      </th>
      <td className="qdoc-info-value">{strong ? <strong>{display}</strong> : display}</td>
    </tr>
  )
}

export function QuotationDocument({ meta, lines }: Props) {
  const displayLines = lines.map(resolveQuotationLine)
  const { subtotal, gst, grand } = quoteTotals(displayLines)
  const terms = parseTermsLines(meta.termsText ?? '')
  const bank = bankDetailsForQuote(meta)

  return (
    <div className="quotation-doc">
      <div className="qdoc-print-footer" aria-hidden="true">
        <span className="qdoc-page-num" />
      </div>
      <header className="qdoc-header-panels">
        <section className="qdoc-panel qdoc-panel-company" aria-label="Company details">
          <div className="qdoc-company-logo-bar">
            <CompanyLogo size={88} className="qdoc-logo-head" />
          </div>
          <div className="qdoc-company-intro">
            <p className="qdoc-brand-name">{COMPANY.name}</p>
            <p className="qdoc-tag">Glass Railings · Architectural Elements</p>
          </div>
          <table className="qdoc-info-table">
            <tbody>
              <InfoRow label="GSTIN" value={COMPANY.gst} />
              <InfoRow label="Address" value={COMPANY.address} />
              <tr>
                <th scope="row" className="qdoc-info-label">
                  Email
                </th>
                <td className="qdoc-info-value">
                  <a href={`mailto:${COMPANY.email}`} className="qdoc-link">
                    {COMPANY.email}
                  </a>
                </td>
              </tr>
              <tr>
                <th scope="row" className="qdoc-info-label">
                  Website
                </th>
                <td className="qdoc-info-value">
                  <a href={`https://${COMPANY.website}`} className="qdoc-link">
                    {COMPANY.website}
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="qdoc-panel qdoc-panel-client" aria-label="Client details">
          <h2 className="qdoc-panel-title">Client &amp; quotation details</h2>
          <table className="qdoc-info-table">
            <tbody>
              <InfoRow label="Quote no." value={meta.quoteNumber} strong alwaysShow />
              <InfoRow label="Date" value={formatQuoteDate(meta.date)} alwaysShow />
              <InfoRow label="M/s" value={meta.clientName} strong alwaysShow />
              <InfoRow label="Project" value={meta.projectName} alwaysShow />
              <InfoRow label="GSTIN" value={meta.clientGstin ?? ''} />
              <InfoRow label="Phone" value={meta.clientPhone ?? ''} />
              <InfoRow label="Address" value={meta.clientAddress ?? ''} />
            </tbody>
          </table>
        </section>
      </header>

      {meta.introText?.trim() && (
        <div className="qdoc-intro">
          <p>{meta.introText.trim()}</p>
        </div>
      )}

      {displayLines.length > 0 && (
        <section className="qdoc-products-section">
          <h2 className="qdoc-section-title">Products &amp; pricing</h2>
          {displayLines.map((line, i) => (
            <RailingQuotationLinePrintBlock key={line.id} line={line} index={i} />
          ))}

          <div className="qdoc-final-totals">
            <table className="qdoc-totals-table">
              <tbody>
                <tr>
                  <th scope="row">Subtotal</th>
                  <td className="qdoc-col-amount">
                    <strong>{formatQuoteMoney(subtotal)}</strong>
                  </td>
                </tr>
                <tr>
                  <th scope="row">GST @ 18%</th>
                  <td className="qdoc-col-amount">{formatQuoteMoney(gst)}</td>
                </tr>
                <tr className="grand-row">
                  <th scope="row">
                    <strong>Grand total</strong>
                  </th>
                  <td className="qdoc-col-amount">
                    <strong>{formatQuoteMoney(grand)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="qdoc-terms-section qdoc-print-block">
        <h2 className="qdoc-section-title">Terms &amp; conditions</h2>
        <ol className="qdoc-terms-list">
          {terms.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>

        <h2 className="qdoc-section-title">Bank details</h2>
        <table className="qdoc-bank-table">
          <tbody>
            <tr>
              <td>Account name</td>
              <td>{bank.accountName}</td>
            </tr>
            <tr>
              <td>Bank</td>
              <td>{bank.bankName}</td>
            </tr>
            <tr>
              <td>Account no.</td>
              <td>{bank.accountNo}</td>
            </tr>
            <tr>
              <td>IFSC</td>
              <td>{bank.ifsc}</td>
            </tr>
            <tr>
              <td>Branch</td>
              <td>{bank.branch}</td>
            </tr>
          </tbody>
        </table>

        <div className="qdoc-sign-block">
          <p>For {COMPANY.name}</p>
          <div className="qdoc-sign-line" />
          <p>Authorised signatory</p>
        </div>
      </section>
    </div>
  )
}
