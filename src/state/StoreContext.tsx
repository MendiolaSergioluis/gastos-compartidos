import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { createDemoState } from '../domain/defaults'
import { loadState, saveState } from '../domain/storage'
import type { AppState } from '../domain/types'
import { StoreContext } from './context'
import { reducer } from './reducer'

function init(): AppState {
  return loadState() ?? createDemoState()
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)

  useEffect(() => {
    saveState(state)
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
