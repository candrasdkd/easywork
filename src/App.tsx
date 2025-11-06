import { useEffect } from 'react';
import AppRoutes from './routes'

function App() {
  useEffect(() => {
    // Check if service worker is supported
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        console.log('App is ready for offline use');
      });
    }
  }, []);
  return <AppRoutes />
}

export default App
