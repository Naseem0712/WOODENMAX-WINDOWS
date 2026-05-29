const ALLOWED_PRINT_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
])

const MAX_PRINT_IMAGE_BYTES = 2.5 * 1024 * 1024

export function readPrintDesignImageFile(
  file: File,
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!ALLOWED_PRINT_IMAGE_TYPES.has(file.type)) {
    return Promise.resolve({
      ok: false,
      error: 'Use PNG, JPG, WebP, or SVG only.',
    })
  }
  if (file.size > MAX_PRINT_IMAGE_BYTES) {
    return Promise.resolve({
      ok: false,
      error: 'Image must be under 2.5 MB.',
    })
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl.startsWith('data:image/')) {
        resolve({ ok: false, error: 'Could not read image file.' })
        return
      }
      resolve({ ok: true, dataUrl })
    }
    reader.onerror = () => resolve({ ok: false, error: 'Could not read image file.' })
    reader.readAsDataURL(file)
  })
}
