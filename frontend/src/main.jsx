import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ui/ErrorBoundary';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { useAuthStore } from './stores/authStore';
import { useSyncStore } from './stores/syncStore';

// Registrar SW con notificación de actualización vía custom event
const updateSW = registerSW({
  onNeedRefresh() {
    window.__pwaUpdateSW = updateSW;
    window.dispatchEvent(new CustomEvent('sw-need-refresh'));
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('sw-offline-ready'));
  },
});

// Estado inicial de conectividad antes del primer render
useSyncStore.getState().setOnline(navigator.onLine);

// Cargar sesión guardada en IndexedDB antes del primer render
useAuthStore.getState().initialize().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
});
