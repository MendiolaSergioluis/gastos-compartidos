import { registerSW } from 'virtual:pwa-register'

type UpdateListener = (update: () => void) => void

const listeners = new Set<UpdateListener>()
let updateServiceWorker: ((reload?: boolean) => Promise<void>) | undefined

/** Avisa cuando hay una versión nueva esperando (por ejemplo tras un despliegue). */
export function onUpdateReady(listener: UpdateListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
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
  })
}
