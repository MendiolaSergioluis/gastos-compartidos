import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type Toast, type ToastApi, type ToastInput } from './toast-context'

/** Avisos efímeros con acción (deshacer): sustituyen al confirm() nativo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    ({ message, tone = 'info', action, duration = action ? 8000 : 3500 }: ToastInput) => {
      counter.current += 1
      const id = `t${counter.current}`
      setToasts((current) => [...current.slice(-2), { id, message, tone, action, duration }])
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        )
      }
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(() => ({ push, dismiss }), [push, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span className="toast-message">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.run()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className="toast-close"
              aria-label="Cerrar aviso"
              onClick={() => dismiss(toast.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
