import React, { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Lock, Play, Sparkles } from 'lucide-react';
import type { MockTest, TestBundle, UserProfile } from '../types';

interface Props {
  bundle: TestBundle;
  tests: MockTest[];
  user: UserProfile;
  onBack: () => void;
  onUnlockBundle: (bundle: TestBundle) => void;
  onStartTest: (test: MockTest, previewOnly?: boolean) => void;
}

export const BundleDetailView: React.FC<Props> = ({
  bundle,
  tests,
  user,
  onBack,
  onUnlockBundle,
  onStartTest,
}) => {
  const [tab, setTab] = useState<'full' | 'sectional'>('full');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');

  const bundleTests = useMemo(
    () => tests.filter((t) => t.status !== 'draft' && (bundle.testIds.includes(t.id) || t.bundleId === bundle.id)),
    [tests, bundle]
  );

  const isOwned = user.ownedBundleIds.includes(bundle.id);
  const fullTests = bundleTests.filter((t) => t.testType === 'full');
  const sectionalTests = bundleTests.filter((t) => t.testType === 'sectional');

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    sectionalTests.forEach((t) => {
      if (t.subject) set.add(t.subject);
    });
    return ['All', ...Array.from(set)];
  }, [sectionalTests]);

  const displayedTests =
    tab === 'full'
      ? fullTests
      : sectionalTests.filter((t) => subjectFilter === 'All' || t.subject === subjectFilter);

  const discountPct = bundle.mrp > bundle.price ? Math.round(((bundle.mrp - bundle.price) / bundle.mrp) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="btn-press inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      {/* Bundle Hero */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {bundle.exam} · Validity: {bundle.validity} · {bundleTests.length} Included Tests
            </div>
            <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
              {bundle.title}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{bundle.desc}</p>
          </div>

          <div className="shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 min-w-[240px]">
            {isOwned ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Full Bundle Unlocked</span>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    ₹{bundle.price}
                  </span>
                  {bundle.mrp > bundle.price && (
                    <span className="text-sm text-slate-400 line-through tabular-nums">₹{bundle.mrp}</span>
                  )}
                  {discountPct > 0 && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Save {discountPct}%
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onUnlockBundle(bundle)}
                  className="btn-press mt-3 w-full rounded-xl bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Unlock Full Bundle</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: Full-Length Mocks vs Sectional Tests */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setTab('full')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              tab === 'full'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Full-Length Mocks ({fullTests.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('sectional')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              tab === 'sectional'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Sectional Tests ({sectionalTests.length})
          </button>
        </div>

        {tab === 'sectional' && (
          <div className="flex flex-wrap gap-1.5">
            {availableSubjects.map((subj) => (
              <button
                key={subj}
                type="button"
                onClick={() => setSubjectFilter(subj)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  subjectFilter === subj
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                }`}
              >
                {subj}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Included Tests Grid */}
      {displayedTests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
          No tests in this tab yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedTests.map((t) => {
            const unlocked = isOwned || !t.paid || user.ownedTestIds.includes(t.id);
            return (
              <div
                key={t.id}
                className="card-hover rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {t.subject ? `${t.subject} · ` : ''}
                    {t.syllabusTag}
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {t.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {t.dur} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" /> {t.qs.length} Qs
                    </span>
                    <span>⚠️ -{t.neg} Neg</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {unlocked ? (
                    <button
                      type="button"
                      disabled={t.status !== 'live'}
                      onClick={() => onStartTest(t, false)}
                      className="btn-press flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-45 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{t.status === 'live' ? 'Start Test' : 'Scheduled'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onStartTest(t, true)}
                        className="btn-press rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        Preview 2 Qs
                      </button>
                      <button
                        type="button"
                        onClick={() => onUnlockBundle(bundle)}
                        className="btn-press flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-indigo-600 py-2 text-xs font-semibold text-white cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Unlock Bundle</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
