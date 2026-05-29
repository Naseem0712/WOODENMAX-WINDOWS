import { useRef } from 'react'
import { readPrintDesignImageFile } from '../printDesignImage'
import type { DesignDraft } from '../types'

interface Props {
  draft: DesignDraft
  onChange: (patch: Partial<DesignDraft>) => void
  onToast?: (message: string) => void
}

export function PrintDesignImageUpload({ draft, onChange, onToast }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const result = await readPrintDesignImageFile(file)
    if (!result.ok) {
      onToast?.(result.error)
      return
    }
    onChange({ printImageUrl: result.dataUrl })
    onToast?.('Print photo set — CAD preview hidden; quotation will use this image.')
  }

  return (
    <div className="print-design-upload">
      <p className="section-desc">
        Can&apos;t draw this shape? Upload a photo or drawing — it replaces the schematic on print/PDF only.
        Rates, materials, and calculations stay the same.
      </p>
      <div className="print-design-upload-actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0]
            void handleFile(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className="btn-secondary print-design-upload-btn"
          onClick={() => inputRef.current?.click()}
        >
          {draft.printImageUrl ? 'Replace print photo' : 'Upload print photo'}
        </button>
        {draft.printImageUrl ? (
          <button
            type="button"
            className="btn-ghost print-design-clear-btn"
            onClick={() => {
              onChange({ printImageUrl: undefined })
              onToast?.('Print photo removed — CAD preview restored.')
            }}
          >
            Remove photo · show CAD
          </button>
        ) : null}
      </div>
      {draft.printImageUrl ? (
        <div className="print-design-upload-thumb-wrap">
          <img
            src={draft.printImageUrl}
            alt="Uploaded print design preview"
            className="print-design-upload-thumb"
          />
          <span className="print-design-upload-badge">Used on print/PDF</span>
        </div>
      ) : null}
    </div>
  )
}

export function PrintDesignCanvasPreview({ imageUrl, title }: { imageUrl: string; title?: string }) {
  return (
    <div className="cad-preview-shell print-design-canvas-preview">
      <div className="cad-toolbar print-design-canvas-toolbar">
        <span className="cad-hint">Custom print image — measurements &amp; rates unchanged</span>
      </div>
      <div className="cad-viewport print-design-canvas-viewport">
        <img
          src={imageUrl}
          alt={title?.trim() || 'Railing design for print'}
          className="print-design-canvas-img"
        />
      </div>
    </div>
  )
}
