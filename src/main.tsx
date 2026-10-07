import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { registerServiceWorker } from './sw.ts'
import { StoreProvider } from './state/StoreContext.tsx'
import { ToastProvider } from './state/ToastProvider.tsx'
import './styles.css'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
)
