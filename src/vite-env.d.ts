/// <reference types="vite/client" />

/**
 * Declaración propia del módulo virtual de vite-plugin-pwa.
 *
 * El plugin lo declara en `client.d.ts` reexportando los tipos del framework, y
 * eso deja de resolverse al separar el proyecto en varios tsconfig. Declararlo
 * aquí es explícito y además fija el contrato que usa `src/sw.ts`.
 */
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegisteredSW?: (swUrl: string, registration?: ServiceWorkerRegistration) => void
    onRegisterError?: (error: unknown) => void
  }

  export function registerSW(options?: RegisterSWOptions): (reload?: boolean) => Promise<void>
}
