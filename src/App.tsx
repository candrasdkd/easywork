import { useEffect } from 'react';
import AppRoutes from './routes'
import { usePWA } from './hooks/usePWA';

function App() {
  const { isInstallable, installApp } = usePWA();

  const handleInstallClick = async () => {
    const installed = await installApp();
    if (installed) {
      console.log('App installed successfully!');
    }
  };

  useEffect(() => {
    // Check if service worker is supported
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        console.log('App is ready for offline use');
      });
    }
  }, []);
  return <>
    {/* Install Button */}
    {isInstallable && (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={handleInstallClick}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          <span>Install App</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>
    )}
    <AppRoutes />
  </>
}

export default App
