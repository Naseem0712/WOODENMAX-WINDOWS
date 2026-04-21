import type { ProfileSeries, WindowConfig, WindowType } from '../types';

/** Full designer state for one window type (config without embedded series + selected profile series). */
export type DesignSnapshot = {
  config: Omit<WindowConfig, 'series'>;
  series: ProfileSeries;
};

const STORAGE_KEY = 'woodenmax-design-snapshots-by-window-type';

type StorageShape = Partial<Record<WindowType, DesignSnapshot>>;

function sanitizeConfig(config: DesignSnapshot['config']): DesignSnapshot['config'] {
  const c = JSON.parse(JSON.stringify(config)) as DesignSnapshot['config'];
  if (typeof c.profileColor === 'string' && c.profileColor.startsWith('data:image')) {
    c.profileColor = '#374151';
  }
  if (typeof c.profileTexture === 'string' && c.profileTexture.startsWith('data:image')) {
    c.profileTexture = '';
  }
  if (c.glassTexture) c.glassTexture = '';
  return c;
}

export function loadAllSnapshots(): StorageShape {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StorageShape;
  } catch {
    return {};
  }
}

export function saveSnapshotForType(windowType: WindowType, snapshot: DesignSnapshot): void {
  const all = loadAllSnapshots();
  all[windowType] = {
    config: sanitizeConfig(snapshot.config),
    series: JSON.parse(JSON.stringify(snapshot.series)) as ProfileSeries,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to persist design snapshots', e);
  }
}

export function getSnapshotForType(windowType: WindowType): DesignSnapshot | null {
  const all = loadAllSnapshots();
  return all[windowType] ?? null;
}

export function clearSnapshotForType(windowType: WindowType): void {
  const all = loadAllSnapshots();
  delete all[windowType];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Failed to update design snapshots', e);
  }
}
