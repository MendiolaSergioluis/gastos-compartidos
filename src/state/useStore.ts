import { useContext } from 'react'
import { StoreContext, type StoreValue } from './context'

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore debe usarse dentro de StoreProvider')
  return value
}
