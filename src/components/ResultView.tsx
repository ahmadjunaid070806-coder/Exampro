import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Flag,
  Share2,
  Trophy,
  XCircle,
} from 'lucide-react';
import type { AttemptSummary, MockTest, TestResultEntry, UserProfile } from '../types';
import { getPreviousExams } from '../types';
import { TopperPosterModal } from './TopperPosterModal';
import { apiFetch } from '../lib/api';

interface Props {
  test: MockTest;
  user: UserProfile;
  result: TestResultEntry;
  summary: AttemptSummary;
  allResults: TestResultEntry[];
  answers: Record<number, number>;
  onBackHome: () => void;
  onToast: (msg: string) => void;
}

const LABELS = ['A', 'B', 'C', 'D'];

export const ResultView: React.FC<Props> = ({
  test,
  user,
  result,
  summary,
  allResults,
  answers,
  onBackHome,
  onToast,
}) => {
  const [showSolutions, setShowSolutions] = useState(false);
  const [showPoster, setShowPoster] = useState(false);

  const testLeaderboard = useMemo(
    () =>
      allResults
        .filter((r) => r.testId === test.id)
        .sort((a, b) => b.score - a.score || a.timeSec - b.timeSec),
    [allResults, test.id]
  );

  const topperScore = testLeaderboard[0]?.score ?? result.score;
  const avgScore = testLeaderboard.length
    ? Number(
        (testLeaderboard.reduce((acc, r) => acc + r.score, 0) / testLeaderboard.length).toFixed(1)
      )
    : result.score;

  const isDistrictTopper = summary.districtRank === 1;

  const handleReportInSolution = async (questionId: string, questionText: string) => {
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          testId: test.id,
          testTitle: test.title,
          questionId,
          questionText,
          reason: 'Flagged from Solution Review',
        }),
      });
      onToast('🚩 Question reported to Admin');
    } catch {
      onToast('Failed to report question');
    }
  };

  const shareScoreUrl = `https://wa.me/?text=${encodeURIComponent(
    `📊 My ExamPro Scorecard!\nTest: ${test.title}\nScore: ${result.score}/${result.maxScore}\nAll-J&K Rank: #${summary.rank}\n${user.district} District Rank: #${summary.districtRank}\nPercentile: ${summary.percentile}%`
  )}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHome}
          className="btn-press inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <a
          href={shareScoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-2 text-xs font-semibold text-white"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share Scorecard</span>
        </a>
      </div>

      {/* Main Score Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center shadow-sm">
        {isDistrictTopper && (
          <div className="mb-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-1.5 text-xs font-extrabold text-amber-950 shadow-sm">
            <Trophy className="w-4 h-4" />
            <span>🏆 #1 District Topper ({user.district})</span>
          </div>
        )}

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{test.title}</div>
        <div className="mt-2 font-display text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tabular-nums">
          {result.score} <span className="text-xl text-slate-400">/ {result.maxScore}</span>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card-hover rounded-xl border border-transparent bg-slate-50 dark:bg-slate-800/70 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">All-J&amp;K Rank</div>
            <div className="font-display text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
              #{summary.rank} <span className="text-xs font-normal text-slate-400">/ {summary.totalParticipants}</span>
            </div>
          </div>
          <div className="card-hover rounded-xl border border-transparent bg-slate-50 dark:bg-slate-800/70 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{user.district} Rank</div>
            <div className="font-display text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              #{summary.districtRank} <span className="text-xs font-normal text-slate-400">/ {summary.districtTotal}</span>
            </div>
          </div>
          <div className="card-hover rounded-xl border border-transparent bg-slate-50 dark:bg-slate-800/70 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Percentile</div>
            <div className="font-display text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {summary.percentile}%
            </div>
          </div>
          <div className="card-hover rounded-xl border border-transparent bg-slate-50 dark:bg-slate-800/70 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Accuracy</div>
            <div className="font-display text-lg font-bold text-slate-900 dark:text-white tabular-nums">
              {result.correct + result.wrong > 0
                ? Math.round((result.correct / (result.correct + result.wrong)) * 100)
                : 0}
              %
            </div>
          </div>
        </div>

        {isDistrictTopper && (
          <button
            type="button"
            onClick={() => setShowPoster(true)}
            className="btn-press mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-amber-950 hover:bg-amber-400 cursor-pointer shadow-sm"
          >
            <Award className="w-4 h-4" />
            <span>📤 Share Topper Poster</span>
          </button>
        )}
      </div>

      {/* Correct / Wrong / Skipped + Topper Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white mb-4">
            Attempt Summary
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3">
              <div className="font-mono text-2xl font-bold text-emerald-600 tabular-nums">
                {result.correct}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">Correct</div>
            </div>
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3">
              <div className="font-mono text-2xl font-bold text-rose-600 tabular-nums">
                {result.wrong}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">Wrong</div>
            </div>
            <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3">
              <div className="font-mono text-2xl font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                {result.skipped}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Skipped</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white mb-4">
            Topper Comparison
          </h3>
          <div className="space-y-3 text-xs">
            {[
              { label: 'Your Score', val: result.score, cls: 'bg-indigo-600' },
              { label: 'Topper Score', val: topperScore, cls: 'bg-emerald-500' },
              { label: 'Average Score', val: avgScore, cls: 'bg-amber-500' },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                  <span>{row.label}</span>
                  <span className="tabular-nums">
                    {row.val} / {result.maxScore}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.cls}`}
                    style={{
                      width: `${Math.min(100, Math.max(4, (row.val / Math.max(1, result.maxScore)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subject-wise Accuracy */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white mb-4">
          Subject-Wise Accuracy
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(result.subjectBreakdown).map(([subj, stat]) => {
            const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
            return (
              <div key={subj} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                <div className="flex justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  <span>{subj}</span>
                  <span className="tabular-nums">
                    {stat.correct}/{stat.total} ({pct}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toggle Solutions */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setShowSolutions((s) => !s)}
          className="btn-press rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer"
        >
          {showSolutions ? 'Hide Detailed Solutions' : '✔ View Detailed Solutions & Explanations'}
        </button>
      </div>

      {showSolutions && (
        <div className="space-y-4">
          {test.qs.map((q, i) => {
            const picked = answers[i];
            const prevExams = getPreviousExams(q).slice(0, 3);
            return (
              <div
                key={q.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {q.subj}
                    </span>
                    {prevExams.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300"
                      >
                        <span>📌</span>
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReportInSolution(q.id, q.t)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report</span>
                  </button>
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Q{i + 1}. {q.t}
                </h4>

                <div className="space-y-2">
                  {q.o.map((opt, j) => {
                    const isCorrect = j === q.c;
                    const isWrongPick = picked === j && picked !== q.c;
                    return (
                      <div
                        key={j}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs font-medium ${
                          isCorrect
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                            : isWrongPick
                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                            : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="font-bold">{LABELS[j]}.</span>
                        <span className="flex-1">{opt}</span>
                        {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {isWrongPick && <XCircle className="w-4 h-4 text-rose-600" />}
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-300">
                  <strong>Explanation:</strong> {q.e}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPoster && (
        <TopperPosterModal
          studentName={user.name}
          district={user.district}
          testTitle={test.title}
          score={result.score}
          maxScore={result.maxScore}
          onClose={() => setShowPoster(false)}
          onToast={onToast}
        />
      )}
    </div>
  );
};
