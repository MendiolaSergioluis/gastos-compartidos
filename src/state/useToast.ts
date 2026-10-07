import { useContext } from 'react'
import { ToastContext, type ToastApi } from './toast-context'

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast debe usarse dentro de ToastProvider')
  return api
}
