import { registerSW } from 'virtual:pwa-register'

type UpdateListener = (update: () => void) => void
type ReadyListener = () => void

const listeners = new Set<UpdateListener>()
const readyListeners = new Set<ReadyListener>()
let updateServiceWorker: ((reload?: boolean) => Promise<void>) | undefined

/** Avisa cuando hay una versión nueva esperando (por ejemplo tras un despliegue). */
export function onUpdateReady(listener: UpdateListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Avisa la primera vez que la app queda disponible sin conexión. */
export function onOfflineReady(listener: ReadyListener): () => void {
  readyListeners.add(listener)
  return () => readyListeners.delete(listener)
}

export function registerServiceWorker(): void {
  const update = () => {
    void updateServiceWorker?.(true)
  }

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      for (const listener of listeners) listener(update)
    },
    onOfflineReady() {
      for (const listener of readyListeners) listener()
    },
  })
}
