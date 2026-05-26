interface Props {
  onDownloadBom: () => void
  canDownloadBom: boolean
}

export function QuickActionsBar({ onDownloadBom, canDownloadBom }: Props) {
  return (
    <div className="header-actions no-print" role="toolbar" aria-label="Quick actions">
      <button
        type="button"
        className="qa-btn qa-download"
        onClick={onDownloadBom}
        disabled={!canDownloadBom}
        title="Download CSV — glass sizes, hardware, client, colours for order"
      >
        <span className="qa-icon">📥</span>
        <span className="qa-label">Download order BOM</span>
      </button>
    </div>
  )
}
