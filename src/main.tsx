import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { BrowserRouter } from 'react-router';
import NotificationsProvider from './hooks/useNotifications/NotificationsProvider.tsx';
import DialogsProvider from './hooks/useDialogs/DialogsProvider.tsx';
import ThemeModeProvider from './hooks/themes/ThemeContext.tsx'; // ⬅️ Ganti
import { AuthProvider } from './contexts/AuthContext.tsx';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Untuk custom service worker di public folder
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeModeProvider>
        <NotificationsProvider>
          <DialogsProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </DialogsProvider>
        </NotificationsProvider>
      </ThemeModeProvider>
    </BrowserRouter>
  </StrictMode>
);
