/** Convert casement/ventilator grid dividers (0–1) ↔ panel sizes (mm). */

const MIN_PANEL_RATIO = 0.02;

export function panelSizesFromDividers(dividers: number[], totalMm: number): number[] {
  const sorted = (dividers ?? [])
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d > 0 && d < 1)
    .sort((a, b) => a - b);

  if (!Number.isFinite(totalMm) || totalMm <= 0) {
    return Array.from({ length: sorted.length + 1 }, () => 0);
  }

  const sizes: number[] = [];
  let prev = 0;
  for (const d of sorted) {
    sizes.push((d - prev) * totalMm);
    prev = d;
  }
  sizes.push((1 - prev) * totalMm);
  return sizes;
}

/**
 * Resolve optional per-panel mm drafts into concrete sizes that sum to `totalMm`.
 * Explicit values are kept; blank panels share the leftover equally.
 */
export function resolvePanelSizesMm(
  drafts: (number | '')[],
  totalMm: number,
  minMm?: number,
): number[] {
  const count = Math.max(1, drafts.length);
  const available = Math.max(0, Number(totalMm) || 0);
  if (count === 1) return [available];

  const floor = Math.max(
    1,
    minMm ?? Math.max(1, Math.round(available * MIN_PANEL_RATIO)),
  );

  const hasExplicit: boolean[] = [];
  const explicitVal: number[] = [];
  for (let i = 0; i < count; i++) {
    const raw = drafts[i];
    if (raw === '' || raw === undefined || raw === null) {
      hasExplicit.push(false);
      explicitVal.push(0);
    } else {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) {
        hasExplicit.push(true);
        explicitVal.push(n);
      } else {
        hasExplicit.push(false);
        explicitVal.push(0);
      }
    }
  }

  let sumExplicit = 0;
  for (let i = 0; i < count; i++) {
    if (hasExplicit[i]) sumExplicit += explicitVal[i];
  }

  const implicitIdx: number[] = [];
  for (let i = 0; i < count; i++) {
    if (!hasExplicit[i]) implicitIdx.push(i);
  }

  const out = Array.from({ length: count }, () => 0);

  if (implicitIdx.length === 0) {
    if (sumExplicit <= 0) {
      const w = available / count;
      return Array.from({ length: count }, () => w);
    }
    if (sumExplicit > available) {
      const scale = available / sumExplicit;
      return explicitVal.map((w) => w * scale);
    }
    const scaled = explicitVal.slice();
    scaled[count - 1] += available - sumExplicit;
    return scaled;
  }

  let remaining = available - sumExplicit;
  if (remaining < 0) {
    const scale = available / Math.max(sumExplicit, 0.0001);
    sumExplicit = 0;
    for (let i = 0; i < count; i++) {
      if (hasExplicit[i]) {
        explicitVal[i] *= scale;
        sumExplicit += explicitVal[i];
      }
    }
    remaining = Math.max(0, available - sumExplicit);
  }

  const share = remaining / implicitIdx.length;
  for (let i = 0; i < count; i++) {
    out[i] = hasExplicit[i] ? explicitVal[i] : share;
  }

  // Enforce a soft minimum without changing total.
  const minTotal = floor * count;
  if (available >= minTotal) {
    for (let pass = 0; pass < count; pass++) {
      let deficit = 0;
      const donors: number[] = [];
      for (let i = 0; i < count; i++) {
        if (out[i] < floor) {
          deficit += floor - out[i];
          out[i] = floor;
        } else if (out[i] > floor) {
          donors.push(i);
        }
      }
      if (deficit <= 0 || donors.length === 0) break;
      const donorSum = donors.reduce((a, i) => a + (out[i] - floor), 0);
      if (donorSum <= 0) break;
      for (const i of donors) {
        const spare = out[i] - floor;
        const take = deficit * (spare / donorSum);
        out[i] -= take;
      }
    }
  }

  return out;
}

/** Convert panel sizes (mm) into relative divider positions (0–1). */
export function dividersFromPanelSizes(sizes: number[], totalMm?: number): number[] {
  const count = sizes.length;
  if (count <= 1) return [];

  const positive = sizes.map((s) => Math.max(0, Number(s) || 0));
  let sum = positive.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const eq = 1 / count;
    return Array.from({ length: count - 1 }, (_, i) => (i + 1) * eq);
  }

  // Prefer normalizing to the given total when provided (floating error).
  if (Number.isFinite(totalMm) && (totalMm as number) > 0) {
    sum = totalMm as number;
  }

  const dividers: number[] = [];
  let cum = 0;
  for (let i = 0; i < count - 1; i++) {
    cum += positive[i] / sum;
    dividers.push(Math.max(MIN_PANEL_RATIO, Math.min(1 - MIN_PANEL_RATIO, cum)));
  }

  // Keep strictly increasing.
  for (let i = 1; i < dividers.length; i++) {
    if (dividers[i] <= dividers[i - 1]) {
      dividers[i] = Math.min(1 - MIN_PANEL_RATIO, dividers[i - 1] + MIN_PANEL_RATIO);
    }
  }
  return dividers;
}

export function formatPanelSizeMm(mm: number): string {
  if (!Number.isFinite(mm)) return '';
  const rounded = Math.round(mm * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
