const PRINT_PHOTO_SESSION_KEY = 'woodenmax-print-elevation-photo';
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Resize & compress uploaded photo for print replacement (JPEG data URL). */
export function processPrintElevationPhotoFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Please choose an image file.'));
  }
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(new Error('Image is too large (max 8 MB).'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image.'));
      img.onload = () => {
        const maxPx = 2000;
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process image.'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function loadSessionPrintElevationPhoto(): string | undefined {
  try {
    const raw = sessionStorage.getItem(PRINT_PHOTO_SESSION_KEY);
    return raw && raw.startsWith('data:image') ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function saveSessionPrintElevationPhoto(dataUrl: string | undefined): void {
  try {
    if (!dataUrl) sessionStorage.removeItem(PRINT_PHOTO_SESSION_KEY);
    else sessionStorage.setItem(PRINT_PHOTO_SESSION_KEY, dataUrl);
  } catch {
    // ignore quota
  }
}
