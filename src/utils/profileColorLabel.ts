import type { SavedColor } from '../types';

const QUICK_COLOR_NAMES: Record<string, string> = {
  '#374151': 'Matt Black',
  '#4b5563': 'Dark Grey',
  '#f9fafb': 'White',
  '#d6a158': 'Champion Gold',
  '#6b7280': 'Grey',
  '#2f3238': 'Black',
  '#5c4033': 'Brown',
  '#d4a84b': 'Champion gold',
  '#f5f5f0': 'Off white',
};

function normalizeColorKey(value: string): string {
  const v = value.trim();
  if (v.startsWith('#')) return v.toLowerCase();
  return v;
}

function findSavedColorName(profileColor: string, savedColors?: SavedColor[]): string | undefined {
  if (!savedColors?.length || !profileColor) return undefined;
  const key = normalizeColorKey(profileColor);
  const hit = savedColors.find((c) => normalizeColorKey(c.value) === key);
  return hit?.name?.trim() || undefined;
}

/** Human-readable profile colour for print / quotation (never raw hex when a name exists). */
export function resolveProfileColorLabel(
  profileColor: string | undefined,
  profileColorName?: string,
  savedColors?: SavedColor[],
): string {
  const color = profileColor?.trim() || '';

  if (profileColorName) {
    const stored = profileColorName.trim();
    if (stored.startsWith('data:')) return 'Custom Texture';
    if (!stored.startsWith('#')) return stored;
    const fromSaved = findSavedColorName(stored, savedColors);
    if (fromSaved) return fromSaved;
    return QUICK_COLOR_NAMES[normalizeColorKey(stored)] || 'Custom Color';
  }

  if (!color) return 'Custom Color';
  if (color.startsWith('data:')) return 'Custom Texture';

  const fromSaved = findSavedColorName(color, savedColors);
  if (fromSaved) return fromSaved;

  if (color.startsWith('#')) {
    return QUICK_COLOR_NAMES[normalizeColorKey(color)] || 'Custom Color';
  }

  return color;
}
