import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (import.meta.env.PROD) {
  try {
    registerSW({
      immediate: false,
      onNeedReload() {
        // Avoid forced page reload loops on open tabs
      },
      onRegisterError() {
        // Ignore SW registration issues in restricted iframes
      },
    });
  } catch {
    // Ignore SW errors
  }
} else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      regs.forEach((reg) => {
        void reg.unregister();
      });
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
