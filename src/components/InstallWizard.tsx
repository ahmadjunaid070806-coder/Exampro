import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface InstallStatusResponse {
  installed: boolean;
  locked: boolean;
  envExists: boolean;
  dbInitialized: boolean;
  suggestedAppUrl: string;
  defaults: {
    appName: string;
    dbConnection: string;
    dbHost: string;
    dbPort: string;
    dbDatabase: string;
    dbUsername: string;
    mailHost: string;
    mailPort: string;
    mailEncryption: string;
    mailFromName: string;
    adminEmail: string;
  };
}

interface InstallSetupResponse {
  success: boolean;
  installed: boolean;
  appKey: string;
  adminEmail: string;
  redirectUrl: string;
  steps: string[];
}

interface Props {
  onInstalled: () => void;
  onOpenAdmin: () => void;
}

export const InstallWizard: React.FC<Props> = ({ onInstalled, onOpenAdmin }) => {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [locked, setLocked] = useState(false);

  // 01. Application & Domain
  const [appName, setAppName] = useState('ExamPro');
  const [appUrl, setAppUrl] = useState(() =>
    typeof window !== 'undefined' ? window.location.origin : ''
  );

  // 02. Database Settings
  const [dbConnection, setDbConnection] = useState<'local' | 'mysql'>('mysql');
  const [dbHost, setDbHost] = useState('127.0.0.1');
  const [dbPort, setDbPort] = useState('3306');
  const [dbDatabase, setDbDatabase] = useState('exampro_v2');
  const [dbUsername, setDbUsername] = useState('');
  const [dbPassword, setDbPassword] = useState('');

  // 03. Mail / SMTP Settings
  const [mailHost, setMailHost] = useState('smtp.gmail.com');
  const [mailPort, setMailPort] = useState('587');
  const [mailUsername, setMailUsername] = useState('');
  const [mailPassword, setMailPassword] = useState('');
  const [mailFromName, setMailFromName] = useState('ExamPro');

  // 04. Optional Razorpay Settings
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');

  const [showSecrets, setShowSecrets] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<InstallSetupResponse | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<InstallStatusResponse>('/api/install/status')
      .then((res) => {
        if (!active) return;
        setLocked(Boolean(res.locked));
        if (res.suggestedAppUrl) setAppUrl(res.suggestedAppUrl);
        if (res.defaults) {
          setAppName(res.defaults.appName || 'ExamPro');
          setDbConnection(res.defaults.dbConnection === 'local' ? 'local' : 'mysql');
          setDbHost(res.defaults.dbHost || '127.0.0.1');
          setDbPort(res.defaults.dbPort || '3306');
          setDbDatabase(res.defaults.dbDatabase || 'exampro_v2');
          setDbUsername(res.defaults.dbUsername || '');
          setMailHost(res.defaults.mailHost || 'smtp.gmail.com');
          setMailPort(res.defaults.mailPort || '587');
          setMailFromName(res.defaults.mailFromName || 'ExamPro');
        }
      })
      .catch(() => {
        // fallback to client origin if status probe unavailable
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInstalling(true);
    try {
      const res = await apiFetch<InstallSetupResponse>('/api/install/setup', {
        method: 'POST',
        body: JSON.stringify({
          appName,
          appUrl,
          dbConnection,
          dbHost,
          dbPort,
          dbDatabase,
          dbUsername,
          dbPassword,
          mailHost,
          mailPort,
          mailEncryption: mailPort === '465' ? 'ssl' : 'tls',
          mailUsername,
          mailPassword,
          mailFromAddress: mailUsername,
          mailFromName,
          razorpayKeyId,
          razorpayKeySecret,
        }),
      });
      setResult(res);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete installation.');
    } finally {
      setInstalling(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
          <RefreshCw className="w-4 h-4 animate-spin text-[#4F46E5]" />
          <span>Checking ExamPro installation status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            ExamPro Installer
          </span>
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={onInstalled}
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Student Portal
            </button>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Admin Console
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        {locked && !result ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  ExamPro is Already Installed
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Setup is locked because <span className="font-mono">APP_INSTALLED=true</span> is configured in{' '}
                  <span className="font-mono">.env</span>. To rerun this installer on a new environment, set{' '}
                  <span className="font-mono">APP_INSTALLED=false</span>.
                </p>
              </div>
            </div>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onInstalled}
                className="btn-press inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white cursor-pointer"
              >
                <span>Open Homepage &amp; Login</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenAdmin}
                className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span>Open Admin Panel</span>
              </button>
            </div>
          </div>
        ) : result ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Installation Complete
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Your Hostinger / VPS environment is configured, database tables &amp; default admin are seeded, and the installer is now locked.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-2.5">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Executed Setup Tasks
              </h2>
              <ul className="space-y-2">
                {result.steps.map((step) => (
                  <li
                    key={step}
                    className="flex items-center gap-2.5 text-sm text-slate-800 dark:text-slate-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <div>
                Default Admin Email:{' '}
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {result.adminEmail}
                </span>
              </div>
              <div>
                Default Admin Password:{' '}
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  Loading@786
                </span>{' '}
                (change anytime inside Admin Settings)
              </div>
              <div className="truncate">
                Generated APP_KEY:{' '}
                <span className="font-mono text-slate-800 dark:text-slate-200">{result.appKey}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onInstalled}
                className="btn-press inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 px-6 py-3 text-sm font-bold text-white cursor-pointer"
              >
                <span>Launch ExamPro Homepage</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenAdmin}
                className="btn-press inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span>Sign in as Admin</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                ExamPro Quick Setup Wizard
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                Configure your live domain, database credentials, and Gmail/SMTP mail settings below. Submitting writes <span className="font-mono">.env</span>, generates your application security keys, seeds the default admin account (<span className="font-mono">jumee89@gmail.com</span>), and prepares storage folders automatically.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800"
            >
              {/* 01. Application & Domain */}
              <section className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-[#4F46E5]" />
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      01. Application &amp; Domain URL
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSecrets((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showSecrets ? 'Hide Passwords' : 'Show Passwords'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Application Name
                    </label>
                    <input
                      type="text"
                      required
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="ExamPro"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      App URL (Auto-detected)
                    </label>
                    <input
                      type="url"
                      required
                      value={appUrl}
                      onChange={(e) => setAppUrl(e.target.value)}
                      placeholder="https://yourdomain.com"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                </div>
              </section>

              {/* 02. Database Settings */}
              <section className="p-6 sm:p-8 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-[#4F46E5]" />
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      02. Database Configuration
                    </h2>
                  </div>

                  <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                    <button
                      type="button"
                      onClick={() => setDbConnection('mysql')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                        dbConnection === 'mysql'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Hostinger MySQL
                    </button>
                    <button
                      type="button"
                      onClick={() => setDbConnection('local')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                        dbConnection === 'local'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Zero-Config Local Store
                    </button>
                  </div>
                </div>

                {dbConnection === 'mysql' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Database Host
                      </label>
                      <input
                        type="text"
                        required
                        value={dbHost}
                        onChange={(e) => setDbHost(e.target.value)}
                        placeholder="127.0.0.1"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Port
                      </label>
                      <input
                        type="text"
                        required
                        value={dbPort}
                        onChange={(e) => setDbPort(e.target.value)}
                        placeholder="3306"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Database Name
                      </label>
                      <input
                        type="text"
                        required
                        value={dbDatabase}
                        onChange={(e) => setDbDatabase(e.target.value)}
                        placeholder="u123456789_exampro"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Database Username
                      </label>
                      <input
                        type="text"
                        required
                        value={dbUsername}
                        onChange={(e) => setDbUsername(e.target.value)}
                        placeholder="u123456789_admin"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Database Password
                      </label>
                      <input
                        type={showSecrets ? 'text' : 'password'}
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                        placeholder="Enter database password"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Uses ExamPro’s built-in persistent JSON engine inside <span className="font-mono">/data/db.json</span> — ideal for instant shared or VPS setup without provisioning an external MySQL database first.
                  </p>
                )}
              </section>

              {/* 03. SMTP Mail Settings */}
              <section className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#4F46E5]" />
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    03. SMTP Mail Settings (Student Gmail OTP)
                  </h2>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Leave Gmail credentials blank if you want to skip SMTP for now — Student OTP login will gracefully use fallback verification until you configure SMTP later.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={mailHost}
                      onChange={(e) => setMailHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      SMTP Port
                    </label>
                    <input
                      type="text"
                      value={mailPort}
                      onChange={(e) => setMailPort(e.target.value)}
                      placeholder="587"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Sender Name
                    </label>
                    <input
                      type="text"
                      value={mailFromName}
                      onChange={(e) => setMailFromName(e.target.value)}
                      placeholder="ExamPro"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Gmail / SMTP Username
                    </label>
                    <input
                      type="email"
                      value={mailUsername}
                      onChange={(e) => setMailUsername(e.target.value)}
                      placeholder="yourapp@gmail.com"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Gmail App Password / SMTP Password
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={mailPassword}
                      onChange={(e) => setMailPassword(e.target.value)}
                      placeholder="16-character Gmail App Password"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                </div>
              </section>

              {/* 04. Optional Razorpay Keys */}
              <section className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-[#4F46E5]" />
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    04. Razorpay Keys (Optional — editable later in Admin Panel)
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Razorpay Key ID
                    </label>
                    <input
                      type="text"
                      value={razorpayKeyId}
                      onChange={(e) => setRazorpayKeyId(e.target.value)}
                      placeholder="rzp_live_... or rzp_test_..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Razorpay Key Secret
                    </label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={razorpayKeySecret}
                      onChange={(e) => setRazorpayKeySecret(e.target.value)}
                      placeholder="Optional key secret"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                </div>
              </section>

              {/* Submit Bar */}
              <footer className="p-6 sm:p-8 bg-slate-50/70 dark:bg-slate-800/40 rounded-b-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                    <Lock className="w-3.5 h-3.5 text-[#4F46E5]" />
                    <span>Default Admin Seeded: jumee89@gmail.com</span>
                  </div>
                  <div>Writes .env, generates APP_KEY, initializes storage &amp; redirects home.</div>
                  {errorMsg && (
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 pt-1">
                      {errorMsg}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={installing}
                  className="btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 disabled:opacity-60 px-6 py-3 text-sm font-bold text-white cursor-pointer whitespace-nowrap shrink-0 min-h-[46px]"
                >
                  {installing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Installing ExamPro...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Setup &amp; Install</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </footer>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
