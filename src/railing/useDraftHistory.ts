import { useCallback, useRef, useState } from 'react'
import { normalizeDraft } from './draftMigrate'
import type { DesignDraft } from './types'

const MAX_HISTORY = 80
const DEBOUNCE_MS = 450

function cloneDraft(d: DesignDraft): DesignDraft {
  return normalizeDraft(structuredClone(d))
}

function draftsEqual(a: DesignDraft, b: DesignDraft): boolean {
  return JSON.stringify(normalizeDraft(a)) === JSON.stringify(normalizeDraft(b))
}

export function useDraftHistory(initial: DesignDraft) {
  const [draft, setDraftState] = useState(() => normalizeDraft(initial))
  const pastRef = useRef<DesignDraft[]>([])
  const futureRef = useRef<DesignDraft[]>([])
  const draftRef = useRef(draft)
  const skipHistoryRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const burstPushedRef = useRef(false)
  const [pastCount, setPastCount] = useState(0)
  const [futureCount, setFutureCount] = useState(0)

  draftRef.current = draft

  const bump = () => {
    setPastCount(pastRef.current.length)
    setFutureCount(futureRef.current.length)
  }

  const setDraft = useCallback((next: DesignDraft | ((prev: DesignDraft) => DesignDraft)) => {
    if (skipHistoryRef.current) {
      const resolved =
        typeof next === 'function' ? next(draftRef.current) : next
      const normalized = normalizeDraft(resolved)
      draftRef.current = normalized
      setDraftState(normalized)
      return
    }

    const prev = draftRef.current
    const resolved = typeof next === 'function' ? next(prev) : next
    const normalized = normalizeDraft(resolved)
    if (draftsEqual(prev, normalized)) return

    draftRef.current = normalized
    setDraftState(normalized)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!burstPushedRef.current) {
      pastRef.current.push(cloneDraft(prev))
      if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift()
      futureRef.current = []
      burstPushedRef.current = true
      bump()
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      burstPushedRef.current = false
    }, DEBOUNCE_MS)
  }, [])

  const replaceDraft = useCallback((next: DesignDraft, clearHistory = true) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    burstPushedRef.current = false
    const normalized = normalizeDraft(next)
    skipHistoryRef.current = true
    draftRef.current = normalized
    setDraftState(normalized)
    skipHistoryRef.current = false
    if (clearHistory) {
      pastRef.current = []
      futureRef.current = []
      bump()
    }
  }, [])

  const undo = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      burstPushedRef.current = false
    }
    const past = pastRef.current
    if (past.length === 0) return false
    const prev = past.pop()!
    futureRef.current.push(cloneDraft(draftRef.current))
    skipHistoryRef.current = true
    draftRef.current = prev
    setDraftState(prev)
    skipHistoryRef.current = false
    bump()
    return true
  }, [])

  const redo = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      burstPushedRef.current = false
    }
    const future = futureRef.current
    if (future.length === 0) return false
    const next = future.pop()!
    pastRef.current.push(cloneDraft(draftRef.current))
    skipHistoryRef.current = true
    draftRef.current = next
    setDraftState(next)
    skipHistoryRef.current = false
    bump()
    return true
  }, [])

  return {
    draft,
    setDraft,
    replaceDraft,
    undo,
    redo,
    canUndo: pastCount > 0,
    canRedo: futureCount > 0,
  }
}
