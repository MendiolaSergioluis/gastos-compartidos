import { createContext } from 'react'

export type ToastTone = 'info' | 'good' | 'warn'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: string
  message: string
  tone: ToastTone
  action?: ToastAction
  duration: number
}

export interface ToastInput {
  message: string
  tone?: ToastTone
  action?: ToastAction
  /** milisegundos antes de desaparecer; 0 = no se cierra solo */
  duration?: number
}

export interface ToastApi {
  push: (toast: ToastInput) => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)
