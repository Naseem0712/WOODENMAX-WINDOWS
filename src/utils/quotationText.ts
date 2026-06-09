import type { ClipboardEvent } from 'react';

export function normalizeWebsiteUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

/** Split pasted or typed multiline text without altering content. */
export function splitQuotationLines(value: string): string[] {
  return value.split(/\r?\n/);
}

/** Paste clipboard as plain text only — no rich-text / HTML reformatting. */
export function pastePlainTextIntoTextarea(
  e: ClipboardEvent<HTMLTextAreaElement>,
  onValue: (next: string) => void,
): void {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  const el = e.currentTarget;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  onValue(next);
  const cursor = start + text.length;
  requestAnimationFrame(() => {
    el.selectionStart = cursor;
    el.selectionEnd = cursor;
  });
}

/** Inline *bold* or **bold** markers (print/preview only — storage stays plain text). */
export function parseInlineBoldSegments(text: string): string[] {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).filter(Boolean);
}

export function isDoubleBoldSegment(part: string): boolean {
  return /^\*\*[^*\n]+\*\*$/.test(part);
}

export function isSingleBoldSegment(part: string): boolean {
  return /^\*[^*\n]+\*$/.test(part);
}

export function boldSegmentInner(part: string): string {
  if (isDoubleBoldSegment(part)) return part.slice(2, -2);
  if (isSingleBoldSegment(part)) return part.slice(1, -1);
  return part;
}
