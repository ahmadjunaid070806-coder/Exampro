import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Grid,
  Send,
  X,
} from 'lucide-react';
import type { MockTest, Question, UserProfile } from '../types';
import { getPreviousExams } from '../types';
import { apiFetch } from '../lib/api';

interface Props {
  test: MockTest;
  user: UserProfile;
  previewOnly?: boolean;
  onExit: () => void;
  onSubmitted: (payload: {
    result: unknown;
    summary: unknown;
    user: UserProfile;
    answers: Record<number, number>;
  }) => void;
  onBookmarkUpdated: (user: UserProfile) => void;
  onToast: (msg: string) => void;
}

const LABELS = ['A', 'B', 'C', 'D'];

export const MockTestEngine: React.FC<Props> = ({
  test,
  user,
  previewOnly = false,
  onExit,
  onSubmitted,
  onBookmarkUpdated,
  onToast,
}) => {
  const questions: Question[] = previewOnly ? test.qs.slice(0, 2) : test.qs;
  const storageKey = `exampro_autosave_${user.id}_${test.id}_${previewOnly ? 'prev' : 'full'}`;

  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved).answers || {} : {};
    } catch {
      return {};
    }
  });
  const [marked, setMarked] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved).marked || {} : {};
    } catch {
      return {};
    }
  });
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.secondsLeft === 'number' && parsed.secondsLeft > 0) {
          return parsed.secondsLeft;
        }
      }
    } catch {
      // ignore
    }
    return (previewOnly ? 5 : test.dur) * 60;
  });

  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-save answers & timer locally on every change
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ answers, marked, secondsLeft })
      );
    } catch {
      // ignore
    }
  }, [answers, marked, secondsLeft, storageKey]);

  // Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && !submitting) {
      handleFinalSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const currentQ = questions[qIdx];
  const selected = answers[qIdx];
  const isBookmarked = currentQ
    ? user.bookmarks.some((b) => b.t.toLowerCase() === currentQ.t.toLowerCase())
    : false;

  const formatTimer = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handlePick = (optIndex: number) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (next[qIdx] === optIndex) delete next[qIdx];
      else next[qIdx] = optIndex;
      return next;
    });
  };

  const handleClear = () => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[qIdx];
      return next;
    });
  };

  const handleToggleBookmark = async () => {
    if (!currentQ) return;
    try {
      const res = await apiFetch<{ user: UserProfile }>('/api/bookmarks/toggle', {
        method: 'POST',
        body: JSON.stringify({ question: currentQ, testTitle: test.title }),
      });
      onBookmarkUpdated(res.user);
      onToast(isBookmarked ? 'Bookmark removed' : 'Question bookmarked');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Failed to bookmark');
    }
  };

  const handleReportSubmit = async () => {
    if (!currentQ) return;
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          testId: test.id,
          testTitle: test.title,
          questionId: currentQ.id,
          questionText: currentQ.t,
          reason: reportReason.trim() || 'Answer or option needs review',
        }),
      });
      setReportModal(false);
      setReportReason('');
      onToast('🚩 Question reported to Admin. Thank you!');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Could not report question');
    }
  };

  const handleFinalSubmit = async () => {
    if (previewOnly) {
      localStorage.removeItem(storageKey);
      onToast('Preview completed! Unlock the full test to get your rank & solutions.');
      onExit();
      return;
    }
    setSubmitting(true);
    try {
      const totalDuration = test.dur * 60;
      const timeSec = Math.max(1, totalDuration - secondsLeft);
      const res = await apiFetch<{ result: unknown; summary: unknown; user: UserProfile }>(
        `/api/tests/${test.id}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ answers, timeSec }),
        }
      );
      localStorage.removeItem(storageKey);
      onSubmitted({ ...res, answers });
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Failed to submit test');
      setSubmitting(false);
    }
  };

  if (!currentQ) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600 dark:text-slate-300">No questions available in this test yet.</p>
        <button
          type="button"
          onClick={onExit}
          className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back
        </button>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const markedCount = Object.values(marked).filter(Boolean).length;

  const PaletteGrid = () => (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
          CBT Question Palette ({questions.length})
        </h3>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <i className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Answered ({answeredCount})
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" /> Review ({markedCount})
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="w-2.5 h-2.5 rounded-xs bg-slate-300 dark:bg-slate-700 inline-block" /> Unanswered
          </span>
        </div>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 max-h-[55vh] overflow-y-auto pr-1">
        {questions.map((_, i) => {
          const isCurrent = i === qIdx;
          const isMarked = marked[i];
          const isAnswered = answers[i] !== undefined;
          let boxCls = 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700';
          if (isMarked) boxCls = 'bg-amber-500 text-white hover:bg-amber-600';
          else if (isAnswered) boxCls = 'bg-emerald-600 text-white hover:bg-emerald-700';

          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                setQIdx(i);
                setShowMobilePalette(false);
              }}
              className={`chip-hover h-10 rounded-lg font-mono text-xs font-bold transition-all duration-150 cursor-pointer ${boxCls} ${
                isCurrent ? 'ring-2 ring-indigo-600 dark:ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900' : ''
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top CBT Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate">
              {previewOnly ? 'Free Sample Preview (2 Qs)' : test.title}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Question {qIdx + 1} of {questions.length} · +4 / -{test.neg} marks
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-bold tabular-nums ${
                secondsLeft <= 300
                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(secondsLeft)}</span>
            </div>

            <button
              type="button"
              onClick={handleToggleBookmark}
              title="Bookmark question"
              className={`rounded-xl border p-2 transition-colors cursor-pointer ${
                isBookmarked
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-950 text-amber-600'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Bookmark className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>

            <button
              type="button"
              onClick={() => setShowMobilePalette(true)}
              className="lg:hidden rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Question Palette"
            >
              <Grid className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowSubmitConfirm(true)}
              className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{previewOnly ? 'Finish Preview' : 'Submit'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main 70 / 30 Responsive CBT Split */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Left 70% Question Stage */}
        <section className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-xs">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Subject: <strong className="text-slate-800 dark:text-slate-200">{currentQ.subj}</strong>
                </span>
                {getPreviousExams(currentQ).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {getPreviousExams(currentQ)
                      .slice(0, 3)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300"
                        >
                          <span>📌</span>
                          <span>{tag}</span>
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setReportModal(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>🚩 Report Question</span>
              </button>
            </div>

            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white leading-relaxed mb-6">
              Q{qIdx + 1}. {currentQ.t}
            </h2>

            <div className="space-y-3">
              {currentQ.o.map((opt, idx) => {
                const isSel = selected === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePick(idx)}
                    className={`w-full flex items-center gap-3.5 rounded-xl border-2 p-4 text-left text-sm transition-all duration-150 cursor-pointer ${
                      isSel
                        ? 'border-indigo-600 bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-950 dark:text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-xs'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        isSel
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {LABELS[idx]}
                    </span>
                    <span className="font-medium leading-snug">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Navigation Bar inside Question Stage */}
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={qIdx === 0}
                onClick={() => setQIdx((i) => Math.max(0, i - 1))}
                className="btn-press inline-flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer min-h-[44px]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => setMarked((m) => ({ ...m, [qIdx]: !m[qIdx] }))}
                className={`btn-press rounded-xl border px-3.5 py-2.5 text-xs font-semibold cursor-pointer min-h-[44px] ${
                  marked[qIdx]
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {marked[qIdx] ? '🔖 Unmark Review' : '🔖 Mark Review'}
              </button>
              <button
                type="button"
                disabled={selected === undefined}
                onClick={handleClear}
                className="btn-press rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer min-h-[44px]"
              >
                Clear
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (qIdx < questions.length - 1) setQIdx((i) => i + 1);
                else setShowSubmitConfirm(true);
              }}
              className="btn-press inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer min-h-[44px]"
            >
              <span>{qIdx < questions.length - 1 ? 'Save & Next' : 'Review & Submit'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Right 30% Fixed Desktop CBT Question Palette */}
        <aside className="hidden lg:block lg:col-span-3">
          <div className="sticky top-20 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-5">
            <PaletteGrid />
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                className="btn-press w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 cursor-pointer"
              >
                {previewOnly ? 'Exit Preview' : 'Submit Mock Test'}
              </button>
              <button
                type="button"
                onClick={onExit}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Pause &amp; Save Progress
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* Mobile Palette Sheet */}
      {showMobilePalette && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60 lg:hidden"
          onClick={() => setShowMobilePalette(false)}
        >
          <div
            className="w-full rounded-t-2xl bg-white dark:bg-slate-900 p-5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setShowMobilePalette(false)}
                className="p-1.5 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <PaletteGrid />
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowSubmitConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {previewOnly ? 'Finish Sample Preview?' : 'Submit Test?'}
            </h3>
            <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Answered</span>
                <strong className="tabular-nums text-emerald-600">{answeredCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Unanswered</span>
                <strong className="tabular-nums">{questions.length - answeredCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Marked for Review</span>
                <strong className="tabular-nums text-amber-600">{markedCount}</strong>
              </div>
            </div>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinalSubmit}
                className="btn-press flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Question Modal */}
      {reportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setReportModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              🚩 Report Question to Admin
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {currentQ.t}
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the issue with this question"
              rows={3}
              className="mt-3 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setReportModal(false)}
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReportSubmit}
                className="btn-press flex-1 rounded-xl bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
