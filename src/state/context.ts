import { createContext, type Dispatch } from 'react'
import type { AppState } from '../domain/types'
import type { Action } from './reducer'

export interface StoreValue {
  state: AppState
  dispatch: Dispatch<Action>
}

export const StoreContext = createContext<StoreValue | null>(null)
