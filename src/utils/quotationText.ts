export function normalizeWebsiteUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function alphaToNumber(value: string): number {
  let result = 0;
  const normalized = value.toUpperCase();
  for (let i = 0; i < normalized.length; i++) {
    result = result * 26 + (normalized.charCodeAt(i) - 64);
  }
  return result;
}

function numberToAlpha(value: number): string {
  let current = value;
  let result = '';
  while (current > 0) {
    const rem = (current - 1) % 26;
    result = String.fromCharCode(97 + rem) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

export function autoContinueTermsSerial(value: string): string {
  const lines = value.split('\n');
  const firstContentIndex = lines.findIndex((line) => line.trim() !== '');
  if (firstContentIndex === -1) return value;

  const seed = lines[firstContentIndex].match(/^\s*([A-Za-z]+|\d+)([.)])?\s+(.+)$/);
  if (!seed) return value;

  const token = seed[1];
  const delimiter = seed[2] || '.';
  const isNumeric = /^\d+$/.test(token);
  let serial = isNumeric ? Number(token) : alphaToNumber(token);
  if (serial <= 0) return value;

  const serialPrefix = /^\s*(?:[A-Za-z]+|\d+)(?:[.)])?\s+/;
  const updated = [...lines];
  for (let i = firstContentIndex; i < lines.length; i++) {
    const currentLine = lines[i];
    if (currentLine.trim() === '') {
      continue;
    }
    const content = currentLine.replace(serialPrefix, '').trim();
    const nextToken = isNumeric ? String(serial) : numberToAlpha(serial);
    updated[i] = `${nextToken}${delimiter} ${content}`;
    serial += 1;
  }
  return updated.join('\n');
}
