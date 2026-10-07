/**
 * Sustituto de `virtual:pwa-register` para las pruebas: el módulo real solo
 * existe cuando vite-plugin-pwa está activo (build y dev), no en Vitest.
 */
export type RegisterSWOptions = {
  immediate?: boolean
  onNeedRefresh?: () => void
  onOfflineReady?: () => void
}

export function registerSW(_options?: RegisterSWOptions): (reload?: boolean) => Promise<void> {
  return async () => {}
}
