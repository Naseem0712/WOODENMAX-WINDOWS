interface Props {
  onImportJson: () => void
  onExportJson: () => void
  onPrint: () => void
  onExportPdf: () => void
  quoteDisabled?: boolean
}

/** Compact import / export / print / PDF toolbar for AppHeader. */
export function QuotationQuickActions({
  onImportJson,
  onExportJson,
  onPrint,
  onExportPdf,
  quoteDisabled = false,
}: Props) {
  return (
    <div
      className="quotation-quick-actions quotation-quick-actions--header"
      role="toolbar"
      aria-label="Quotation export, import and print"
    >
      <button
        type="button"
        className="btn-secondary btn-sm qa-btn"
        onClick={onImportJson}
        aria-label="Import JSON"
        title="Import JSON"
      >
        <span className="qa-ico" aria-hidden="true">
          ↓
        </span>
        <span className="qa-txt">In</span>
      </button>
      <button
        type="button"
        className="btn-secondary btn-sm qa-btn"
        onClick={onExportJson}
        aria-label="Export JSON"
        title="Export JSON"
      >
        <span className="qa-ico" aria-hidden="true">
          ↑
        </span>
        <span className="qa-txt">Out</span>
      </button>
      <button
        type="button"
        className="btn-secondary btn-sm qa-btn"
        onClick={onPrint}
        disabled={quoteDisabled}
        aria-label="Print quotation"
        title={quoteDisabled ? 'Add items to quotation first' : 'Print quotation'}
      >
        <span className="qa-ico" aria-hidden="true">
          ⎙
        </span>
        <span className="qa-txt">Print</span>
      </button>
      <button
        type="button"
        className="btn-primary btn-sm qa-btn qa-btn-pdf"
        onClick={onExportPdf}
        disabled={quoteDisabled}
        aria-label="Download PDF"
        title={quoteDisabled ? 'Add items to quotation first' : 'Download PDF file'}
      >
        <span className="qa-txt">PDF</span>
      </button>
    </div>
  )
}
