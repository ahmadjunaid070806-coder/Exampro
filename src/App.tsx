import { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { AppBootstrapData, UserProfile } from './types';
import { apiFetch, getStoredSession, resolveApiUrl, setStoredSession } from './lib/api';
import { StudentPortal } from './components/StudentPortal';
import { AdminPanel } from './components/AdminPanel';
import { InstallWizard } from './components/InstallWizard';
import { OfflineIndicator } from './components/OfflineIndicator';

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unexpected rendering error.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ExamPro UI ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-lg space-y-3">
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Unable to Open ExamPro
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">{this.state.message}</p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => {
                  setStoredSession(null);
                  window.location.href = '/';
                }}
                className="flex-1 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Reset Session
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function isAdminPath(): boolean {
  return window.location.pathname === '/admin' || window.location.hash === '#admin';
}

function isInstallPath(): boolean {
  return window.location.pathname === '/install' || window.location.pathname.startsWith('/install/');
}

export default function App() {
  const [data, setData] = useState<AppBootstrapData | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<'student' | 'admin' | 'install'>(
    isInstallPath() ? 'install' : isAdminPath() ? 'admin' : 'student'
  );
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('exampro_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });
  const [kickedAlert, setKickedAlert] = useState(false);
  const [toast, setToast] = useState('');
  const [loadError, setLoadError] = useState('');

  const userRef = useRef<UserProfile | null>(null);
  userRef.current = user;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((cur) => (cur === msg ? '' : cur));
    }, 2800);
  }, []);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem('exampro_theme', dark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [dark]);

  // Dynamically sync canonical URL and og:url with current origin + pathname
  useEffect(() => {
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    const canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalEl) canonicalEl.href = canonicalUrl;
    const ogUrlEl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrlEl) ogUrlEl.content = canonicalUrl;
  }, [mode]);

  // Listen to URL changes for /install, /admin or #admin (strictly keep logged-in admins in admin mode)
  useEffect(() => {
    const onPop = () => {
      if (isInstallPath()) {
        setMode('install');
        return;
      }
      if (userRef.current?.role === 'admin') {
        setMode('admin');
        if (!isAdminPath()) {
          window.history.replaceState({}, '', '/admin');
        }
        return;
      }
      setMode(isAdminPath() ? 'admin' : 'student');
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await apiFetch<{
        data: AppBootstrapData;
        user: UserProfile | null;
        sessionInvalid?: boolean;
        installed?: boolean;
      }>('/api/bootstrap');
      setData(res.data);
      if (res.installed === false && !isInstallPath()) {
        setMode('install');
        window.history.replaceState({}, '', '/install');
      }
      if (res.sessionInvalid) {
        setStoredSession(null);
        setUser(null);
        setKickedAlert(true);
      } else {
        setUser(res.user);
        if (res.user?.role === 'admin' && !isInstallPath()) {
          setMode('admin');
          if (!isAdminPath()) {
            window.history.replaceState({}, '', '/admin');
          }
        }
      }
      setLoadError('');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Unable to connect to ExamPro server.');
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  // Real-time SSE Sync + Single-Device Lock Enforcement
  useEffect(() => {
    const session = getStoredSession();
    const qs = session
      ? `?userId=${session.userId}&token=${encodeURIComponent(session.sessionToken || '')}`
      : '';
    const es = new EventSource(resolveApiUrl(`/api/stream${qs}`));

    es.addEventListener('data_updated', () => {
      loadBootstrap();
    });

    es.addEventListener('announcement_broadcasted', (ev) => {
      loadBootstrap();
      try {
        const payload = JSON.parse(ev.data) as { announcement?: { title?: string } };
        if (payload.announcement?.title) {
          showToast(`📢 Broadcast: ${payload.announcement.title}`);
        }
      } catch {
        // ignore
      }
    });

    es.addEventListener('session_revoked', (ev) => {
      try {
        const payload = JSON.parse(ev.data) as { userId: number; activeToken: string };
        const current = userRef.current;
        const stored = getStoredSession();
        if (
          current &&
          current.role === 'student' &&
          current.id === payload.userId &&
          stored?.sessionToken !== payload.activeToken
        ) {
          setStoredSession(null);
          setUser(null);
          setKickedAlert(true);
          setMode('student');
        }
      } catch {
        // ignore parse errors
      }
    });

    return () => {
      es.close();
    };
  }, [loadBootstrap, showToast, user?.id, user?.sessionToken]);

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setStoredSession({
      userId: loggedInUser.id,
      sessionToken: loggedInUser.sessionToken,
    });
    setUser(loggedInUser);
    setKickedAlert(false);
    if (loggedInUser.role === 'admin') {
      setMode('admin');
      window.history.replaceState({}, '', '/admin');
    } else {
      setMode('student');
      if (isAdminPath()) {
        window.history.replaceState({}, '', '/');
      }
    }
    loadBootstrap();
  };

  const handleLogout = () => {
    const wasAdmin = user?.role === 'admin' || mode === 'admin';
    setStoredSession(null);
    setUser(null);
    if (wasAdmin) {
      setMode('admin');
      window.history.replaceState({}, '', '/admin');
    } else {
      setMode('student');
      if (isAdminPath()) {
        window.history.replaceState({}, '', '/');
      }
    }
  };

  const switchMode = (next: 'student' | 'admin' | 'install') => {
    if (next === 'install') {
      setMode('install');
      window.history.pushState({}, '', '/install');
      return;
    }
    if (user?.role === 'admin') {
      setMode('admin');
      window.history.replaceState({}, '', '/admin');
      return;
    }
    setMode(next);
    if (next === 'admin') {
      window.history.pushState({}, '', '/admin');
    } else {
      window.history.pushState({}, '', '/');
    }
  };

  if (mode === 'install') {
    return (
      <AppErrorBoundary>
        <InstallWizard
          onInstalled={() => {
            setMode('student');
            window.history.replaceState({}, '', '/');
            void loadBootstrap();
          }}
          onOpenAdmin={() => {
            setMode('admin');
            window.history.replaceState({}, '', '/admin');
            void loadBootstrap();
          }}
        />
        <OfflineIndicator />
      </AppErrorBoundary>
    );
  }

  if (loadError && !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            ExamPro Connection Issue
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{loadError}</p>
          <button
            type="button"
            onClick={loadBootstrap}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
            🎓
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Loading ExamPro...
          </p>
        </div>
      </div>
    );
  }

  const isStrictAdmin = mode === 'admin' || user?.role === 'admin';

  return (
    <AppErrorBoundary>
      {isStrictAdmin ? (
        <AdminPanel
          data={data}
          user={user}
          onLogout={handleLogout}
          onAdminAuthenticated={(adminUser) => {
            handleLoginSuccess(adminUser);
          }}
          onRefreshData={loadBootstrap}
          onToast={showToast}
        />
      ) : (
        <StudentPortal
          data={data}
          user={user}
          dark={dark}
          kickedAlert={kickedAlert}
          onToggleTheme={() => setDark((d) => !d)}
          onDismissKicked={() => setKickedAlert(false)}
          onLoginSuccess={handleLoginSuccess}
          onUserUpdate={(updated) => setUser(updated)}
          onLogout={handleLogout}
          onOpenAdmin={() => switchMode('admin')}
          onToast={showToast}
          onRefreshData={loadBootstrap}
        />
      )}

      <OfflineIndicator />

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-xs font-semibold shadow-xl">
          {toast}
        </div>
      )}
    </AppErrorBoundary>
  );
}
