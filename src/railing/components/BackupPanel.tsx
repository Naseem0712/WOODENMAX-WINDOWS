import { useRef } from 'react'
import { buildBackup, downloadBackupJson, parseBackupJson } from '../backup'
import type { AppBackup } from '../backup'
import type { CostingRates, DesignDraft, QuotationLine, QuotationMeta } from '../types'
import type { QuotationPresets } from '../modePreset'

interface Props {
  meta: QuotationMeta
  lines: QuotationLine[]
  presets: QuotationPresets
  ratesNormal: CostingRates
  ratesStaircase: CostingRates
  draft: DesignDraft
  onRestore: (backup: AppBackup) => void
}

export function BackupPanel({
  meta,
  lines,
  presets,
  ratesNormal,
  ratesStaircase,
  draft,
  onRestore,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const backup = buildBackup(meta, lines, presets, ratesNormal, ratesStaircase, draft)
    downloadBackupJson(backup)
  }

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = parseBackupJson(reader.result as string)
        onRestore(raw)
      } catch {
        alert('Could not read backup file. Check JSON format.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="backup-panel">
      <h3>
        Backup <span className="hi">JSON</span>
      </h3>
      <p className="hint">
        Save quotation, rates, designs & current draft in one file.
      </p>
      <div className="backup-actions">
        <button type="button" className="btn-secondary" onClick={handleExport}>
          Export JSON
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => fileRef.current?.click()}
        >
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleImport(f)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
