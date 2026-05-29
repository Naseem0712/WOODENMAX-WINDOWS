import type { ExportContactProfile, ManufacturerProfile, UserMode, UserModeState } from '../types'

const STORAGE_KEY = 'wm-user-profile-v1'

const DEFAULT_STATE: UserModeState = {
  version: 1,
  mode: 'homeowner',
  flags: {},
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function normalizeManufacturerProfile(raw: unknown): ManufacturerProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const shopName = asString(o.shopName).trim()
  const gstNumber = asString(o.gstNumber).trim()
  const phone = asString(o.phone).trim()
  const address = asString(o.address).trim()
  if (!shopName && !gstNumber && !phone && !address) return undefined
  return { shopName, gstNumber, phone, address }
}

export function normalizeExportContactProfile(raw: unknown): ExportContactProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const name = asString(o.name).trim()
  const city = asString(o.city).trim()
  const pinCode = asString(o.pinCode).trim()
  const phone = asString(o.phone).trim()
  if (!name && !city && !pinCode && !phone) return undefined
  return { name, city, pinCode, phone }
}

export function isManufacturerUnlocked(p?: ManufacturerProfile): boolean {
  if (!p) return false
  return Boolean(p.shopName && p.gstNumber && p.phone && p.address)
}

export function isExportContactComplete(p?: ExportContactProfile): boolean {
  if (!p) return false
  return Boolean(p.name && p.city && p.pinCode && p.phone)
}

export function loadUserModeState(): UserModeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw) as Partial<UserModeState> & { mode?: unknown }
    const mode: UserMode =
      parsed.mode === 'architect' || parsed.mode === 'manufacturer' || parsed.mode === 'homeowner'
        ? parsed.mode
        : DEFAULT_STATE.mode
    return {
      version: 1,
      mode,
      manufacturer: normalizeManufacturerProfile(parsed.manufacturer),
      exportContact: normalizeExportContactProfile(parsed.exportContact),
      flags: typeof parsed.flags === 'object' && parsed.flags ? (parsed.flags as Record<string, boolean>) : {},
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function saveUserModeState(state: UserModeState): void {
  try {
    const payload: UserModeState = {
      version: 1,
      mode: state.mode,
      manufacturer: state.manufacturer,
      exportContact: state.exportContact,
      flags: state.flags ?? {},
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('saveUserModeState failed', err)
  }
}

