import React, { useRef } from 'react';
import { Award, Download, Share2, X } from 'lucide-react';

interface Props {
  studentName: string;
  district: string;
  testTitle: string;
  score: number;
  maxScore: number;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const TopperPosterModal: React.FC<Props> = ({
  studentName,
  district,
  testTitle,
  score,
  maxScore,
  onClose,
  onToast,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownloadPoster = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.55, '#312e81');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1350);

    // Gold inner frame
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 8;
    ctx.strokeRect(48, 48, 984, 1254);
    ctx.strokeStyle = 'rgba(251,191,36,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(68, 68, 944, 1214);

    // Brand header
    ctx.fillStyle = '#e0e7ff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXAMPRO · J&K MOCK TESTS', 540, 150);

    // Certificate Title
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('🏆 #1 DISTRICT TOPPER', 540, 290);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '32px sans-serif';
    ctx.fillText('HALL OF FAME CERTIFICATE', 540, 355);

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 74px sans-serif';
    ctx.fillText(studentName.toUpperCase(), 540, 520);

    // District badge text
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(`District Rank #1 · ${district}, J&K`, 540, 610);

    // Score box
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(180, 700, 720, 220);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.strokeRect(180, 700, 720, 220);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '30px sans-serif';
    ctx.fillText('OFFICIAL SCORE ACHIEVED', 540, 768);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 88px monospace';
    ctx.fillText(`${score} / ${maxScore}`, 540, 875);

    // Test Name
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(testTitle.slice(0, 48), 540, 1040);

    // Footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = '26px sans-serif';
    ctx.fillText('Verified by ExamPro Automated District Leaderboard', 540, 1180);
    ctx.fillText(`© ${new Date().getFullYear()} ExamPro · Jammu & Kashmir`, 540, 1225);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `ExamPro_Topper_${district}_${studentName.replace(/\s+/g, '_')}.png`;
    a.click();
    onToast('Topper Poster downloaded!');
  };

  const whatsappText = encodeURIComponent(
    `🏆 Ranked #1 in ${district} on ExamPro!\n\nName: ${studentName}\nTest: ${testTitle}\nScore: ${score}/${maxScore}\n\nJoin ExamPro for J&K Mock Tests & District Ranks!`
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Shareable Topper Poster
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Certificate Preview */}
        <div
          ref={cardRef}
          className="rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 p-6 text-center text-white border-2 border-amber-400/80 shadow-xl"
        >
          <div className="text-[11px] font-bold tracking-widest text-indigo-200 uppercase">
            ExamPro · Jammu &amp; Kashmir
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/50 px-3 py-1 text-xs font-extrabold text-amber-300">
            🏆 #1 District Topper
          </div>
          <h4 className="font-display text-2xl font-extrabold text-white mt-3">{studentName}</h4>
          <p className="text-sm font-semibold text-amber-300 mt-1">
            Rank #1 in {district} District
          </p>

          <div className="mt-4 rounded-xl bg-white/10 border border-amber-300/30 py-3 px-4">
            <div className="text-[11px] text-slate-300">Score Achieved</div>
            <div className="font-mono text-3xl font-extrabold text-emerald-300 tabular-nums mt-0.5">
              {score} / {maxScore}
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-200 font-medium">{testTitle}</p>
          <p className="mt-3 text-[10px] text-slate-400">
            Auto-verified by ExamPro District Leaderboard
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleDownloadPoster}
            className="btn-press flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2.5 text-xs font-semibold text-white"
          >
            <Share2 className="w-4 h-4" />
            <span>Share on WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};
