import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ExportContactProfile, ManufacturerProfile, UserMode, UserModeState } from '../types'
import { loadUserModeState, saveUserModeState } from '../utils/userModeStorage'

interface UserModeContextValue {
  state: UserModeState
  setMode: (mode: UserMode) => void
  setManufacturerProfile: (profile: ManufacturerProfile) => void
  setExportContactProfile: (profile: ExportContactProfile) => void
  setFlag: (key: string, value: boolean) => void
  getFlag: (key: string) => boolean
}

const Ctx = createContext<UserModeContextValue | null>(null)

export function useUserMode(): UserModeContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUserMode must be used inside UserModeProvider')
  return v
}

export function UserModeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UserModeState>(() => loadUserModeState())

  useEffect(() => {
    saveUserModeState(state)
  }, [state])

  const setMode = useCallback((mode: UserMode) => {
    setState((p) => ({ ...p, mode }))
  }, [])

  const setManufacturerProfile = useCallback((profile: ManufacturerProfile) => {
    setState((p) => ({ ...p, manufacturer: profile }))
  }, [])

  const setExportContactProfile = useCallback((profile: ExportContactProfile) => {
    setState((p) => ({ ...p, exportContact: profile }))
  }, [])

  const setFlag = useCallback((key: string, value: boolean) => {
    setState((p) => ({ ...p, flags: { ...(p.flags ?? {}), [key]: value } }))
  }, [])

  const getFlag = useCallback((key: string) => Boolean(state.flags?.[key]), [state.flags])

  const value = useMemo(
    () => ({
      state,
      setMode,
      setManufacturerProfile,
      setExportContactProfile,
      setFlag,
      getFlag,
    }),
    [state, setMode, setManufacturerProfile, setExportContactProfile, setFlag, getFlag],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
