// Safe localStorage sandboxing/polyfill for iframes and third-party-cookie-blocked browsers
try {
  const testKey = '__storage_test__';
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
} catch (e) {
  console.warn("localStorage is blocked or disabled in this environment. Using secure in-memory backup to prevent crash.", e);
  const memoryStore: Record<string, string> = {};
  const mockStorage: Storage = {
    get length() {
      return Object.keys(memoryStore).length;
    },
    clear: () => {
      for (const k in memoryStore) {
        delete memoryStore[k];
      }
    },
    getItem: (key: string) => {
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
    },
    key: (index: number) => {
      return Object.keys(memoryStore)[index] || null;
    },
    removeItem: (key: string) => {
      delete memoryStore[key];
    },
    setItem: (key: string, value: string) => {
      memoryStore[key] = String(value);
    }
  };
  try {
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (err) {
    console.error("Could not override localStorage:", err);
  }
}

import { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

try {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('Service Worker registration error:', error);
    },
  });
} catch (err) {
  console.warn('Service Worker registration skipped:', err);
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#fdf8ee] dark:bg-[#0c0a09] p-4 text-center font-sans" dir="rtl">
          <div className="bg-white/95 dark:bg-[#171412]/95 border border-amber-200/70 dark:border-amber-900/50 rounded-2xl p-8 max-w-md shadow-xl flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <AlertTriangle size={26} />
            </div>
            <h2 className="text-xl font-bold text-amber-950 dark:text-amber-100">حدث خطأ غير متوقع</h2>
            <p className="text-sm text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
              يرجى إعادة تحميل الصفحة لاستعادة استقرار التطبيق ومتابعة القراءة.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
