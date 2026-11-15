import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Headphones,
  Image as ImageIcon,
  Lock,
  Megaphone,
  Menu,
  Package,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Users,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AppBootstrapData,
  AppSettings,
  Coupon,
  FlashNoticeSettings,
  MaintenanceSettings,
  MockTest,
  PromoBannerSettings,
  PromoBannerTargetScreen,
  Question,
  TestBundle,
  UserProfile,
} from '../types';
import {
  DEFAULT_CATEGORIES,
  JK_DISTRICTS,
  getNextMonthEndRefreshDate,
  getPreviousExams,
  normalizePreviousExams,
} from '../types';
import { apiFetch } from '../lib/api';
import { BackToTopButton } from './BackToTopButton';

type AdminTab =
  | 'dash'
  | 'banner'
  | 'broadcast'
  | 'tests'
  | 'results'
  | 'students'
  | 'exams'
  | 'bundles'
  | 'payments'
  | 'syllabus'
  | 'support'
  | 'settings';

interface Props {
  data: AppBootstrapData;
  user: UserProfile | null;
  onLogout: () => void;
  onAdminAuthenticated: (adminUser: UserProfile) => void;
  onRefreshData: () => void;
  onToast: (msg: string) => void;
}

const LABELS = ['A', 'B', 'C', 'D'];

export const AdminPanel: React.FC<Props> = ({
  data,
  user,
  onLogout,
  onAdminAuthenticated,
  onRefreshData,
  onToast,
}) => {
  const [tab, setTab] = useState<AdminTab>('dash');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Admin Login Form if not logged in as admin yet
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState('');

  // Test Editor state
  const [editingTest, setEditingTest] = useState<MockTest | null>(null);
  const [isNewTest, setIsNewTest] = useState(false);
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [builderPanel, setBuilderPanel] = useState<'manual' | 'ai' | 'bulk' | null>(null);
  const [qForm, setQForm] = useState<{
    t: string;
    o: [string, string, string, string];
    c: number;
    e: string;
    subj: string;
    previous_exams: string[];
    tagDraft: string;
    editIdx: number | null;
    aiReviewIdx: number | null;
  }>({
    t: '',
    o: ['', '', '', ''],
    c: 0,
    e: '',
    subj: data.subjects[0] || 'J&K General Knowledge',
    previous_exams: [],
    tagDraft: '',
    editIdx: null,
    aiReviewIdx: null,
  });

  // AI PDF Extraction state (up to 120 questions)
  const [aiFileName, setAiFileName] = useState('');
  const [aiPdfBase64, setAiPdfBase64] = useState('');
  const [aiUseSample, setAiUseSample] = useState(false);
  const [aiCount, setAiCount] = useState(10);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    extractedCount: number;
    targetCount: number;
  } | null>(null);
  const [aiErr, setAiErr] = useState('');
  const [aiQueue, setAiQueue] = useState<Array<Question & { reviewState?: 'pending' | 'approved' | 'rejected' }>>([]);

  // Bulk CSV / JSON state
  const [bulkMode, setBulkMode] = useState<'csv' | 'json'>('csv');
  const [bulkText, setBulkText] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');

  // Results & District Toppers Modal
  const [selectedResultTestId, setSelectedResultTestId] = useState<number>(data.tests[0]?.id || 1);
  const [showToppersExport, setShowToppersExport] = useState(false);

  // Exams & Subjects add inputs
  const [newExamName, setNewExamName] = useState('');

  // Bundles Manager state
  const [bundleDraft, setBundleDraft] = useState<Partial<TestBundle> | null>(null);

  // Payments & Coupons state
  const [paySubTab, setPaySubTab] = useState<'tx' | 'coupons' | 'gateway'>('tx');
  const [txSearch, setTxSearch] = useState('');
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [upiDraft, setUpiDraft] = useState(data.settings.upi);
  const [newCoupon, setNewCoupon] = useState<{
    code: string;
    type: 'percent' | 'flat' | 'free';
    value: string;
    maxUses: string;
    expiryDate: string;
  }>({ code: '', type: 'percent', value: '', maxUses: '', expiryDate: '' });
  const [manualUnlock, setManualUnlock] = useState({ userId: 0, itemType: 'test' as 'test' | 'bundle', itemId: 0 });

  // Broadcast Announcement state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastBusy, setBroadcastBusy] = useState(false);

  // Syllabus state
  const [sylForm, setSylForm] = useState({
    exam: data.exams[0] || 'JKSSB Junior Assistant',
    title: '',
    summary: '',
    fileName: '',
    pdfUrl: '',
  });

  // Support & Reports tab
  const [supTab, setSupTab] = useState<'tickets' | 'reports'>('tickets');

  // Sharing & Settings draft
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(data.settings);
  const [razorpayDraft, setRazorpayDraft] = useState({
    keyId: data.settings.razorpay?.keyId || '',
    keySecret: data.settings.razorpay?.keySecret || '',
  });
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false);
  const [savingRazorpay, setSavingRazorpay] = useState(false);

  const defaultBanner: PromoBannerSettings = {
    is_banner_active: data.settings.promoBanner?.is_banner_active ?? false,
    title: data.settings.promoBanner?.title || '',
    subtitle: data.settings.promoBanner?.subtitle || '',
    ctaLabel: data.settings.promoBanner?.ctaLabel || 'Explore Offers',
    imageUrl: data.settings.promoBanner?.imageUrl || '',
    targetScreen: data.settings.promoBanner?.targetScreen || 'upgrade',
    targetUrl: data.settings.promoBanner?.targetUrl || '',
  };
  const [promoBannerDraft, setPromoBannerDraft] = useState<PromoBannerSettings>(defaultBanner);
  const [savingPromoBanner, setSavingPromoBanner] = useState(false);

  const [maintenanceDraft, setMaintenanceDraft] = useState<MaintenanceSettings>({
    enabled: Boolean(data.settings.maintenance?.enabled),
    message:
      data.settings.maintenance?.message ||
      'ExamPro is currently undergoing scheduled maintenance to improve performance. Please check back shortly.',
  });
  const [flashNoticeDraft, setFlashNoticeDraft] = useState<FlashNoticeSettings>({
    enabled: Boolean(data.settings.flashNotice?.enabled),
    text: data.settings.flashNotice?.text || '',
  });
  const [savingControls, setSavingControls] = useState(false);

  // Admin Password Update state (inside Admin Credentials section)
  const [adminCurrentPw, setAdminCurrentPw] = useState('');
  const [adminNewPw, setAdminNewPw] = useState('');
  const [adminConfirmPw, setAdminConfirmPw] = useState('');
  const [showAdminPws, setShowAdminPws] = useState(false);
  const [savingAdminPw, setSavingAdminPw] = useState(false);
  const [adminPwMsg, setAdminPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // One-time Production Cleanup state
  const [cleanupPassword, setCleanupPassword] = useState('');
  const [showCleanupPw, setShowCleanupPw] = useState(false);
  const [cleaningDemoData, setCleaningDemoData] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setRazorpayDraft({
      keyId: data.settings.razorpay?.keyId || '',
      keySecret: data.settings.razorpay?.keySecret || '',
    });
  }, [data.settings.razorpay?.keyId, data.settings.razorpay?.keySecret]);

  useEffect(() => {
    if (data.settings.promoBanner) {
      setPromoBannerDraft({
        is_banner_active: Boolean(data.settings.promoBanner.is_banner_active),
        title: data.settings.promoBanner.title || '',
        subtitle: data.settings.promoBanner.subtitle || '',
        ctaLabel: data.settings.promoBanner.ctaLabel || 'Explore Offers',
        imageUrl: data.settings.promoBanner.imageUrl || '',
        targetScreen: data.settings.promoBanner.targetScreen || 'upgrade',
        targetUrl: data.settings.promoBanner.targetUrl || '',
      });
    }
  }, [data.settings.promoBanner]);

  useEffect(() => {
    if (data.settings.maintenance) {
      setMaintenanceDraft({
        enabled: Boolean(data.settings.maintenance.enabled),
        message:
          data.settings.maintenance.message ||
          'ExamPro is currently undergoing scheduled maintenance to improve performance. Please check back shortly.',
      });
    }
  }, [data.settings.maintenance]);

  useEffect(() => {
    if (data.settings.flashNotice) {
      setFlashNoticeDraft({
        enabled: Boolean(data.settings.flashNotice.enabled),
        text: data.settings.flashNotice.text || '',
      });
    }
  }, [data.settings.flashNotice]);

  const pendingTicketsCount = useMemo(
    () => data.supportTickets.filter((t) => t.status === 'pending').length,
    [data.supportTickets]
  );
  const pendingReportsCount = useMemo(
    () => data.reportedQuestions.filter((r) => r.status === 'pending').length,
    [data.reportedQuestions]
  );
  const totalPendingSupport = pendingTicketsCount + pendingReportsCount;

  // Auto-calculated District Toppers across all results
  const districtToppersList = useMemo(() => {
    const map = new Map<
      string,
      { district: string; name: string; score: number; maxScore: number; targetExam: string }
    >();
    data.results.forEach((r) => {
      const prev = map.get(r.district);
      if (!prev || r.score > prev.score) {
        map.set(r.district, {
          district: r.district,
          name: r.name,
          score: r.score,
          maxScore: r.maxScore,
          targetExam: r.targetExam,
        });
      }
    });
    return JK_DISTRICTS.map((d) => map.get(d)).filter(Boolean) as Array<{
      district: string;
      name: string;
      score: number;
      maxScore: number;
      targetExam: string;
    }>;
  }, [data.results]);

  // If not logged in as admin, render Dark Admin Login
  if (!user || user.role !== 'admin') {
    const handleAdminLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginErr('');
      try {
        const res = await apiFetch<{ user: UserProfile }>('/api/auth/admin-login', {
          method: 'POST',
          body: JSON.stringify({ identifier: loginId, password: loginPw }),
        });
        onAdminAuthenticated(res.user);
      } catch (err: unknown) {
        setLoginErr(err instanceof Error ? err.message : 'Invalid admin credentials.');
      }
    };

    return (
      <div className="min-h-screen bg-[#121218] text-[#ecebf4] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-6 shadow-2xl">
          <div className="text-center mb-5">
            <div className="text-4xl mb-2">🛡️</div>
            <h1 className="font-display text-xl font-extrabold">ExamPro Admin</h1>
            <p className="text-xs text-[#a09eb5] mt-1">
              Sign in with Admin Email or Mobile
            </p>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-3">
            <div>
              <label className="block text-xs text-[#a09eb5] mb-1">Admin Email or Mobile</label>
              <input
                type="text"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter admin email or mobile number"
                className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#a8a4ff]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#a09eb5] mb-1">Password</label>
              <input
                type="password"
                required
                value={loginPw}
                onChange={(e) => setLoginPw(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#a8a4ff]"
              />
            </div>
            {loginErr && <p className="text-xs text-rose-400 font-semibold">{loginErr}</p>}
            <button
              type="submit"
              className="btn-press w-full rounded-xl bg-[#4f46e5] py-3 text-sm font-bold text-white hover:bg-[#4338ca] cursor-pointer"
            >
              Login to Admin Console
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Helpers for Test Editor & Duplicate Check
  const normalizeQ = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
  const isDuplicateQuestion = (text: string, ignoreIdx: number | null = null) => {
    if (!editingTest) return false;
    const norm = normalizeQ(text);
    return editingTest.qs.some((q, idx) => idx !== ignoreIdx && normalizeQ(q.t) === norm);
  };

  const openNewTest = () => {
    setIsNewTest(true);
    setEditingTest({
      id: 0,
      cat: 'latest',
      exam: data.exams[0] || '',
      title: '',
      testType: 'full',
      subject: data.subjects[0] || '',
      paid: false,
      price: 0,
      dur: 60,
      neg: 0.25,
      sched: '',
      status: 'draft',
      desc: '',
      syllabusTag: '',
      language: 'English',
      attemptCount: 0,
      bundleId: null,
      qs: [],
    });
    setBuilderPanel(null);
    setAiQueue([]);
    setTab('tests');
  };

  const openEditTest = (t: MockTest) => {
    setIsNewTest(false);
    setEditingTest(JSON.parse(JSON.stringify(t)));
    setBuilderPanel(null);
    setAiQueue([]);
    setTab('tests');
  };

  const addPreviousExamTagToForm = (rawTag?: string) => {
    const candidate = (rawTag !== undefined ? rawTag : qForm.tagDraft).trim();
    if (!candidate) return;
    const pieces = candidate
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...qForm.previous_exams];
    for (const p of pieces) {
      if (next.length >= 3) {
        onToast('Maximum 3 previous exam tags allowed.');
        break;
      }
      if (!next.some((existing) => existing.toLowerCase() === p.toLowerCase())) {
        next.push(p);
      }
    }
    setQForm({
      ...qForm,
      previous_exams: next.slice(0, 3),
      tagDraft: rawTag !== undefined ? qForm.tagDraft : '',
    });
  };

  const removePreviousExamTagFromForm = (tagToRemove: string) => {
    setQForm({
      ...qForm,
      previous_exams: qForm.previous_exams.filter((t) => t !== tagToRemove),
    });
  };

  const handleSaveManualQuestion = () => {
    if (!editingTest) return;
    if (!qForm.t.trim() || qForm.o.some((x) => !x.trim()) || !qForm.e.trim()) {
      onToast('Fill question, all 4 options, and explanation.');
      return;
    }
    // Include any pending text in tagDraft if under 3 tags
    const combinedTags = [...qForm.previous_exams];
    if (qForm.tagDraft.trim()) {
      for (const part of qForm.tagDraft.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (combinedTags.length < 3 && !combinedTags.some((x) => x.toLowerCase() === part.toLowerCase())) {
          combinedTags.push(part);
        }
      }
    }
    if (combinedTags.length > 3) {
      onToast('Maximum 3 previous exam tags allowed.');
      return;
    }
    const normalizedPrev = normalizePreviousExams(combinedTags);

    const newQ: Question = {
      id: `q-${Date.now()}`,
      t: qForm.t.trim(),
      o: [qForm.o[0].trim(), qForm.o[1].trim(), qForm.o[2].trim(), qForm.o[3].trim()],
      c: qForm.c,
      e: qForm.e.trim(),
      subj: qForm.subj,
      src: 'manual',
      previous_exams: normalizedPrev,
      examRef: normalizedPrev ?? [],
    };

    if (qForm.aiReviewIdx !== null) {
      const nextQueue = [...aiQueue];
      const existingItem = nextQueue[qForm.aiReviewIdx];
      nextQueue[qForm.aiReviewIdx] = {
        ...newQ,
        id: existingItem?.id || newQ.id,
        src: 'ai',
        reviewState: 'pending',
      };
      setAiQueue(nextQueue);
      if (existingItem?.id) {
        apiFetch(`/api/admin/extraction-results/${existingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            t: newQ.t,
            o: newQ.o,
            c: newQ.c,
            e: newQ.e,
            subj: newQ.subj,
            previous_exams: normalizedPrev,
          }),
        }).catch(() => {});
      }
      setBuilderPanel('ai');
      setQForm({
        ...qForm,
        t: '',
        o: ['', '', '', ''],
        e: '',
        previous_exams: [],
        tagDraft: '',
        aiReviewIdx: null,
      });
      return;
    }

    if (isDuplicateQuestion(newQ.t, qForm.editIdx)) {
      onToast('⚠️ Duplicate question detected! This question already exists in the test.');
      return;
    }

    const updatedQs = [...editingTest.qs];
    if (qForm.editIdx !== null) {
      updatedQs[qForm.editIdx] = { ...updatedQs[qForm.editIdx], ...newQ, id: updatedQs[qForm.editIdx].id };
      setBuilderPanel(null);
      onToast('Question updated!');
    } else {
      updatedQs.push(newQ);
      onToast(`Question #${updatedQs.length} added!`);
    }
    setEditingTest({ ...editingTest, qs: updatedQs });
    setQForm({
      t: '',
      o: ['', '', '', ''],
      c: 0,
      e: '',
      subj: qForm.subj,
      previous_exams: [],
      tagDraft: '',
      editIdx: null,
      aiReviewIdx: null,
    });
  };

  const handleAiExtract = async () => {
    const CHUNK_SIZE = 20;
    const totalBatches = Math.ceil(aiCount / CHUNK_SIZE);
    setAiErr('');
    setAiBusy(true);
    setAiQueue([]);
    setAiProgress({
      currentBatch: 1,
      totalBatches,
      extractedCount: 0,
      targetCount: aiCount,
    });

    const collected: Array<Question & { reviewState?: 'pending' | 'approved' | 'rejected' }> = [];
    const seenTitles = new Set<string>(
      (editingTest?.qs || []).map((q) => normalizeQ(q.t))
    );

    try {
      for (let batchIdx = 1; batchIdx <= totalBatches && collected.length < aiCount; batchIdx++) {
        const remaining = aiCount - collected.length;
        const batchTarget = Math.min(CHUNK_SIZE, remaining);

        setAiProgress({
          currentBatch: batchIdx,
          totalBatches,
          extractedCount: collected.length,
          targetCount: aiCount,
        });

        const res = await apiFetch<{ questions: Question[] }>('/api/admin/ai-extract-pdf', {
          method: 'POST',
          body: JSON.stringify({
            count: batchTarget,
            pdfBase64: aiPdfBase64,
            useSample: aiUseSample,
            excludeQuestions: collected.map((q) => q.t),
            batchIndex: batchIdx,
            totalBatches,
          }),
        });

        for (const q of res.questions || []) {
          const norm = normalizeQ(q.t);
          if (!norm || seenTitles.has(norm)) continue;
          seenTitles.add(norm);
          collected.push({ ...q, reviewState: 'pending' });
        }

        setAiQueue([...collected]);
        setAiProgress({
          currentBatch: batchIdx,
          totalBatches,
          extractedCount: collected.length,
          targetCount: aiCount,
        });
      }

      if (collected.length === 0) {
        setAiErr('No unique questions could be extracted from this PDF.');
      } else {
        onToast(`Extracted ${collected.length} questions across ${totalBatches} batch${totalBatches > 1 ? 'es' : ''}.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI extraction failed.';
      setAiErr(
        collected.length > 0
          ? `${msg} (${collected.length} questions from completed batches were preserved below.)`
          : msg
      );
    } finally {
      setAiBusy(false);
    }
  };

  const approveAiItem = (idx: number) => {
    if (!editingTest) return;
    const item = aiQueue[idx];
    if (isDuplicateQuestion(item.t)) {
      onToast('Skipped duplicate question already in test.');
      const next = [...aiQueue];
      next[idx].reviewState = 'rejected';
      setAiQueue(next);
      return;
    }
    const { reviewState: _rs, ...cleanQ } = item;
    setEditingTest({ ...editingTest, qs: [...editingTest.qs, cleanQ] });
    const next = [...aiQueue];
    next[idx].reviewState = 'approved';
    setAiQueue(next);
  };

  const approveAllPendingAi = () => {
    if (!editingTest) return;
    const added: Question[] = [];
    const existingSet = new Set(editingTest.qs.map((q) => normalizeQ(q.t)));
    const nextQueue = aiQueue.map((item) => {
      if (item.reviewState !== 'pending') return item;
      const norm = normalizeQ(item.t);
      if (existingSet.has(norm)) {
        return { ...item, reviewState: 'rejected' as const };
      }
      existingSet.add(norm);
      const { reviewState: _rs, ...cleanQ } = item;
      added.push(cleanQ);
      return { ...item, reviewState: 'approved' as const };
    });
    setAiQueue(nextQueue);
    setEditingTest({ ...editingTest, qs: [...editingTest.qs, ...added] });
    onToast(`Approved ${added.length} unique questions!`);
  };

  const downloadSampleCsv = () => {
    const csv = [
      'question,optionA,optionB,optionC,optionD,correctIndex,explanation,subject,examRef',
      '"Which river flows through Srinagar?","Chenab","Jhelum","Ravi","Indus",1,"The Jhelum flows through Srinagar and Wular Lake.","J&K General Knowledge","JKSSB 2024, JKP 2025"',
      '"Who wrote Rajatarangini?","Kalhana","Bilhana","Banabhatta","Panini",0,"Kalhana composed Rajatarangini in 12th century CE.","History","JKPSC 2023"',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ExamPro_Sample_Questions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const handleBulkImport = () => {
    if (!editingTest || !bulkText.trim()) return;
    setBulkMsg('');
    const existingSet = new Set(editingTest.qs.map((q) => normalizeQ(q.t)));
    const imported: Question[] = [];
    let dupes = 0;

    try {
      if (bulkMode === 'json') {
        const arr = JSON.parse(bulkText) as Array<Record<string, unknown>>;
        arr.forEach((item, i) => {
          const text = String(item.t || item.question || '').trim();
          const norm = normalizeQ(text);
          if (!norm || existingSet.has(norm)) {
            if (norm) dupes++;
            return;
          }
          existingSet.add(norm);
          const opts = Array.isArray(item.o)
            ? item.o.map(String)
            : [
                String(item.optionA || 'Option A'),
                String(item.optionB || 'Option B'),
                String(item.optionC || 'Option C'),
                String(item.optionD || 'Option D'),
              ];
          const rawRef = item.previous_exams ?? item.examRef;
          const prevExams = normalizePreviousExams(rawRef);
          imported.push({
            id: `json-${Date.now()}-${i}`,
            t: text,
            o: [opts[0] || '', opts[1] || '', opts[2] || '', opts[3] || ''],
            c: Math.max(0, Math.min(3, Number(item.c ?? item.correctIndex ?? 0))),
            e: String(item.e || item.explanation || 'Verified answer.'),
            subj: String(item.subj || item.subject || data.subjects[0]),
            src: 'json',
            previous_exams: prevExams,
            examRef: prevExams ?? [],
          });
        });
      } else {
        const lines = bulkText.trim().split(/\r?\n/);
        lines.forEach((line, idx) => {
          if (idx === 0 && line.toLowerCase().includes('question')) return;
          const cols = parseCsvLine(line);
          if (cols.length < 6) return;
          const text = cols[0];
          const norm = normalizeQ(text);
          if (!norm || existingSet.has(norm)) {
            if (norm) dupes++;
            return;
          }
          existingSet.add(norm);
          const prevExams = normalizePreviousExams(cols[8] || '');
          imported.push({
            id: `csv-${Date.now()}-${idx}`,
            t: text,
            o: [cols[1] || '', cols[2] || '', cols[3] || '', cols[4] || ''],
            c: Math.max(0, Math.min(3, Number(cols[5] || 0))),
            e: cols[6] || 'Verified answer.',
            subj: cols[7] || data.subjects[0],
            src: 'csv',
            previous_exams: prevExams,
            examRef: prevExams ?? [],
          });
        });
      }

      setEditingTest({ ...editingTest, qs: [...editingTest.qs, ...imported] });
      setBulkMsg(`Imported ${imported.length} questions (${dupes} duplicates skipped).`);
      if (imported.length > 0) setBulkText('');
    } catch {
      setBulkMsg('Invalid format. Check CSV columns or JSON syntax.');
    }
  };

  const handleSaveTestToServer = async () => {
    if (!editingTest) return;
    if (!editingTest.title.trim()) {
      onToast('Enter a test title.');
      return;
    }
    if (editingTest.status !== 'draft' && editingTest.qs.length === 0) {
      onToast('Add at least 1 question or save as Draft.');
      return;
    }
    try {
      if (isNewTest) {
        await apiFetch('/api/admin/tests', {
          method: 'POST',
          body: JSON.stringify(editingTest),
        });
        onToast('Mock test created!');
      } else {
        await apiFetch(`/api/admin/tests/${editingTest.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingTest),
        });
        onToast('Mock test updated!');
      }
      setEditingTest(null);
      onRefreshData();
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const handleSendBroadcast = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = broadcastTitle.trim();
    const message = broadcastMessage.trim();
    if (!title || !message) {
      onToast('Please enter both an announcement title and message.');
      return;
    }
    setBroadcastBusy(true);
    try {
      await apiFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, message }),
      });
      setBroadcastTitle('');
      setBroadcastMessage('');
      onToast('📢 Broadcast sent to all active students!');
      onRefreshData();
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Failed to send broadcast.');
    } finally {
      setBroadcastBusy(false);
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    try {
      await apiFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
      onToast('Broadcast removed.');
      onRefreshData();
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Failed to delete broadcast.');
    }
  };

  const sidebarItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'dash', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
    {
      id: 'banner',
      label: 'Promotional Banner',
      icon: <Megaphone className="w-4 h-4" />,
    },
    {
      id: 'broadcast',
      label: 'Broadcast Message',
      icon: <Sparkles className="w-4 h-4" />,
      badge: (data.announcements?.length || 0) || undefined,
    },
    { id: 'tests', label: 'Mock Tests', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'results', label: 'Results', icon: <Trophy className="w-4 h-4" /> },
    { id: 'students', label: 'Students', icon: <Users className="w-4 h-4" /> },
    { id: 'exams', label: 'Exams', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'bundles', label: 'Test Bundles', icon: <Package className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments & Coupons', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'syllabus', label: 'Syllabus', icon: <FileText className="w-4 h-4" /> },
    { id: 'support', label: 'Support & Reports', icon: <Headphones className="w-4 h-4" />, badge: totalPendingSupport || undefined },
    { id: 'settings', label: 'Settings & Toggles', icon: <Settings className="w-4 h-4" /> },
  ];

  const totalRevenue = data.payments
    .filter((p) => p.status === 'PAID')
    .reduce((acc, p) => acc + p.finalAmount, 0);

  return (
    <div className="min-h-screen bg-[#121218] text-[#ecebf4] flex">
      {/* Left Sidebar (Desktop fixed, Mobile collapsible drawer) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 shrink-0 border-r border-[#2e2d3a] bg-[#1b1a22] flex flex-col transition-transform duration-200 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-4 border-b border-[#2e2d3a] flex items-center justify-between">
          <div className="font-display text-lg font-extrabold tracking-tight text-white">
            🎓 ExamPro <span className="text-xs font-medium text-[#a09eb5]">Admin</span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="lg:hidden text-[#a09eb5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {sidebarItems.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setEditingTest(null);
                  setDrawerOpen(false);
                }}
                className={`nav-hover w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  active
                    ? 'bg-[#35327a] text-white shadow-xs'
                    : 'text-[#a09eb5] hover:bg-[#25242f] hover:text-white'
                }`}
              >
                {item.icon}
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#2e2d3a]">
          <button
            type="button"
            onClick={onLogout}
            className="btn-press w-full rounded-xl border border-rose-500/30 bg-rose-950/30 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 cursor-pointer"
          >
            Sign Out of Admin Console
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 border-b border-[#2e2d3a] bg-[#1b1a22]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden rounded-lg p-1.5 text-[#a09eb5] hover:text-white cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display text-base font-bold text-white">
              {editingTest
                ? isNewTest
                  ? 'New Mock Test'
                  : `Edit: ${editingTest.title}`
                : sidebarItems.find((i) => i.id === tab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openNewTest}
              className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#4338ca] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Mock Test</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* ALERT BANNER FOR PENDING SUPPORT / REPORTS */}
          {totalPendingSupport > 0 && tab === 'dash' && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="text-xs sm:text-sm">
                  <strong className="text-amber-300">Action Needed:</strong>{' '}
                  <span>{totalPendingSupport} support ticket(s) / reported question(s) pending.</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab('support')}
                  className="btn-press rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                >
                  Open Support &amp; Reports
                </button>
              </div>
            </div>
          )}

          {/* ================= TAB: DASHBOARD ================= */}
          {tab === 'dash' && !editingTest && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Website Visitors', value: data.traffic.totalVisitors, icon: '🌐' },
                  { label: "Today's Active Students", value: data.traffic.todayActiveStudents, icon: '⚡' },
                  { label: 'Total Students', value: data.students?.length || 0, icon: '🎓' },
                  { label: 'Total Revenue', value: `₹${totalRevenue}`, icon: '💰' },
                  { label: 'Total Mock Tests', value: data.tests.length, icon: '📝' },
                  { label: 'Test Bundles', value: data.bundles.length, icon: '📦' },
                  {
                    label: 'Paid Transactions',
                    value: data.payments.filter((p) => p.status === 'PAID').length,
                    icon: '💳',
                  },
                  { label: 'Total Test Attempts', value: data.results.length, icon: '🧪' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="card-hover rounded-2xl border border-[#2e2d3a] bg-[#25242f] p-5"
                  >
                    <div className="text-xl mb-2">{stat.icon}</div>
                    <div className="font-mono text-2xl font-extrabold text-white tabular-nums">
                      {stat.value}
                    </div>
                    <div className="text-xs text-[#a09eb5] mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 space-y-3">
                  <h3 className="font-display text-sm font-bold text-white">
                    🏆 Toppers Snapshot
                  </h3>
                  {data.results
                    .slice()
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5)
                    .map((r, i) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between py-2 border-b border-[#2e2d3a] last:border-0 text-xs"
                      >
                        <span>
                          {['🥇', '🥈', '🥉'][i] || `#${i + 1}`} <strong>{r.name}</strong> ({r.district})
                        </span>
                        <span className="font-mono font-bold text-[#a8a4ff] tabular-nums">
                          {r.score}/{r.maxScore}
                        </span>
                      </div>
                    ))}
                </div>

                <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 space-y-3">
                  <h3 className="font-display text-sm font-bold text-white">
                    ⚡ Quick Admin Actions
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={openNewTest}
                      className="btn-press rounded-xl bg-[#4f46e5] py-3 px-3 text-xs font-bold text-white cursor-pointer"
                    >
                      ➕ Add New Mock Test
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('bundles')}
                      className="btn-press rounded-xl bg-[#25242f] border border-[#3a3848] py-3 px-3 text-xs font-bold text-white cursor-pointer"
                    >
                      📦 Manage Bundles
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('payments')}
                      className="btn-press rounded-xl bg-[#25242f] border border-[#3a3848] py-3 px-3 text-xs font-bold text-white cursor-pointer"
                    >
                      💳 Transaction History
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('broadcast')}
                      className="btn-press rounded-xl bg-[#25242f] border border-[#3a3848] py-3 px-3 text-xs font-bold text-white cursor-pointer"
                    >
                      📢 Broadcast Message
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Broadcast Announcement Box on Admin Dashboard */}
              <div className="rounded-2xl border border-[#35327a] bg-[#1b1a22] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">
                      📢 Broadcast Announcement to All Active Students
                    </h3>
                    <p className="text-xs text-[#a09eb5] mt-0.5">
                      Instantly delivers to the Student Home Banner &amp; Notification Inbox via real-time push
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('broadcast')}
                    className="text-xs font-semibold text-[#a8a4ff] hover:underline cursor-pointer"
                  >
                    Manage History ({data.announcements?.length || 0}) →
                  </button>
                </div>
                <form onSubmit={handleSendBroadcast} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Enter announcement title"
                    className="md:col-span-4 rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#a8a4ff]"
                  />
                  <input
                    type="text"
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Enter broadcast message"
                    className="md:col-span-6 rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#a8a4ff]"
                  />
                  <button
                    type="submit"
                    disabled={broadcastBusy}
                    className="btn-press md:col-span-2 rounded-xl bg-[#4f46e5] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#4338ca] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    {broadcastBusy ? 'Sending...' : '📢 Broadcast'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ================= TAB: PROMOTIONAL BANNER MANAGER ================= */}
          {tab === 'banner' && !editingTest && (
            <div className="max-w-4xl space-y-6">
              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 sm:p-6 space-y-5">
                {/* Header + Active / Inactive Toggle Switch */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2e2d3a]">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-[#a8a4ff]" />
                      <span>Promotional Banner Settings</span>
                    </h2>
                    <p className="text-xs text-[#a09eb5] mt-1">
                      Control the student dashboard promotional banner (`is_banner_active`). Turn OFF to hide completely with zero empty whitespace.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                        promoBannerDraft.is_banner_active
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {promoBannerDraft.is_banner_active ? 'Active on Dashboard' : 'Inactive (Hidden)'}
                    </span>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={promoBannerDraft.is_banner_active}
                      aria-label="Toggle promotional banner active state"
                      disabled={savingPromoBanner}
                      onClick={async () => {
                        const nextActive = !promoBannerDraft.is_banner_active;
                        if (nextActive && !promoBannerDraft.title.trim() && !promoBannerDraft.imageUrl.trim()) {
                          onToast('Enter a banner title or upload an image first.');
                          return;
                        }
                        const updated = { ...promoBannerDraft, is_banner_active: nextActive };
                        setPromoBannerDraft(updated);
                        setSavingPromoBanner(true);
                        try {
                          await apiFetch('/api/admin/promo-banner', {
                            method: 'PUT',
                            body: JSON.stringify(updated),
                          });
                          onRefreshData();
                          onToast(
                            nextActive
                              ? 'Promotional Banner turned ON!'
                              : 'Promotional Banner turned OFF and hidden.'
                          );
                        } catch (err: unknown) {
                          setPromoBannerDraft((prev) => ({ ...prev, is_banner_active: !nextActive }));
                          onToast(
                            err instanceof Error ? err.message : 'Failed to toggle banner status.'
                          );
                        } finally {
                          setSavingPromoBanner(false);
                        }
                      }}
                      className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${
                        promoBannerDraft.is_banner_active
                          ? 'bg-emerald-600 border-emerald-500'
                          : 'bg-[#25242f] border-[#3a3848]'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                          promoBannerDraft.is_banner_active ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Banner Copy & Target Link Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-[#a09eb5] mb-1">Banner Title</label>
                    <input
                      type="text"
                      value={promoBannerDraft.title}
                      onChange={(e) =>
                        setPromoBannerDraft({ ...promoBannerDraft, title: e.target.value })
                      }
                      placeholder="e.g., Festive Prep Sale — 30% Off JKSSB Full Mock Packs"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#a8a4ff]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs text-[#a09eb5] mb-1">
                      Subtitle / Offer Description
                    </label>
                    <textarea
                      rows={2}
                      value={promoBannerDraft.subtitle}
                      onChange={(e) =>
                        setPromoBannerDraft({ ...promoBannerDraft, subtitle: e.target.value })
                      }
                      placeholder="Short announcement or discount details shown inside the banner"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] p-3 text-sm text-white focus:outline-none focus:border-[#a8a4ff]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Action Button Label</label>
                    <input
                      type="text"
                      value={promoBannerDraft.ctaLabel}
                      onChange={(e) =>
                        setPromoBannerDraft({ ...promoBannerDraft, ctaLabel: e.target.value })
                      }
                      placeholder="Explore Offers"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#a8a4ff]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">
                      Target Screen / Link Action
                    </label>
                    <select
                      value={promoBannerDraft.targetScreen}
                      onChange={(e) =>
                        setPromoBannerDraft({
                          ...promoBannerDraft,
                          targetScreen: e.target.value as PromoBannerTargetScreen,
                        })
                      }
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#a8a4ff]"
                    >
                      <option value="upgrade">Upgrade &amp; Paid Courses Store</option>
                      <option value="courses">My Courses &amp; Bundles</option>
                      <option value="syllabus">Exam Syllabus PDFs</option>
                      <option value="results">My Results &amp; Rank</option>
                      <option value="external">Custom External Link URL</option>
                      <option value="none">Display Only (No Navigation)</option>
                    </select>
                  </div>

                  {promoBannerDraft.targetScreen === 'external' && (
                    <div className="md:col-span-2">
                      <label className="block text-xs text-[#a09eb5] mb-1">
                        Target Link URL
                      </label>
                      <input
                        type="url"
                        value={promoBannerDraft.targetUrl}
                        onChange={(e) =>
                          setPromoBannerDraft({ ...promoBannerDraft, targetUrl: e.target.value })
                        }
                        placeholder="https://example.com/offer"
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#a8a4ff]"
                      />
                    </div>
                  )}

                  {/* Banner Image Upload or URL */}
                  <div className="md:col-span-2 rounded-xl border border-[#2e2d3a] bg-[#25242f]/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <ImageIcon className="w-4 h-4 text-[#a8a4ff]" />
                        <span>Banner Artwork / Image (Optional)</span>
                      </div>
                      {promoBannerDraft.imageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setPromoBannerDraft({ ...promoBannerDraft, imageUrl: '' })
                          }
                          className="text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          Remove Image
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <label className="btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-[#3a3848] bg-[#1b1a22] px-4 py-2 text-xs font-bold text-white hover:border-[#a8a4ff] cursor-pointer shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Banner Image</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            if (f.size > 2.5 * 1024 * 1024) {
                              onToast('Image too large. Please upload an image under 2.5 MB.');
                              return;
                            }
                            const r = new FileReader();
                            r.onload = () => {
                              if (typeof r.result === 'string') {
                                setPromoBannerDraft({
                                  ...promoBannerDraft,
                                  imageUrl: r.result,
                                });
                              }
                            };
                            r.readAsDataURL(f);
                          }}
                        />
                      </label>
                      <input
                        type="text"
                        value={
                          promoBannerDraft.imageUrl.startsWith('data:')
                            ? 'Uploaded custom image'
                            : promoBannerDraft.imageUrl
                        }
                        onChange={(e) =>
                          setPromoBannerDraft({ ...promoBannerDraft, imageUrl: e.target.value })
                        }
                        readOnly={promoBannerDraft.imageUrl.startsWith('data:')}
                        placeholder="Or paste banner image URL (16:5 recommended)"
                        className="flex-1 rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#a8a4ff]"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    disabled={savingPromoBanner}
                    onClick={async () => {
                      setSavingPromoBanner(true);
                      try {
                        await apiFetch('/api/admin/promo-banner', {
                          method: 'PUT',
                          body: JSON.stringify(promoBannerDraft),
                        });
                        onRefreshData();
                        onToast('Promotional Banner settings saved & synced!');
                      } catch (err: unknown) {
                        onToast(
                          err instanceof Error ? err.message : 'Failed to save promotional banner.'
                        );
                      } finally {
                        setSavingPromoBanner(false);
                      }
                    }}
                    className="btn-press inline-flex items-center gap-2 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] px-5 py-2.5 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{savingPromoBanner ? 'Saving...' : 'Save Promotional Banner'}</span>
                  </button>
                </div>
              </div>

              {/* Live Student Dashboard Preview */}
              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Student Dashboard Live Preview</span>
                  <span className="text-[#a09eb5]">
                    {promoBannerDraft.is_banner_active
                      ? 'Currently visible at top of Student Dashboard'
                      : 'Hidden on Student Dashboard (zero empty space)'}
                  </span>
                </div>

                {promoBannerDraft.is_banner_active ? (
                  <div className="relative overflow-hidden rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-[#4F46E5] via-indigo-600 to-violet-700 p-5 sm:p-6 text-white shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 max-w-xl">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
                          <Sparkles className="w-3 h-3" />
                          <span>Featured Promotion</span>
                        </div>
                        <h3 className="font-display text-lg sm:text-xl font-extrabold leading-snug">
                          {promoBannerDraft.title || 'Promotional Banner Title'}
                        </h3>
                        {promoBannerDraft.subtitle && (
                          <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed">
                            {promoBannerDraft.subtitle}
                          </p>
                        )}
                        {promoBannerDraft.targetScreen !== 'none' &&
                          promoBannerDraft.ctaLabel.trim() && (
                            <div className="pt-1">
                              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-extrabold text-[#4F46E5]">
                                <span>{promoBannerDraft.ctaLabel}</span>
                                <ExternalLink className="w-3 h-3" />
                              </span>
                            </div>
                          )}
                      </div>
                      {promoBannerDraft.imageUrl && (
                        <img
                          src={promoBannerDraft.imageUrl}
                          alt={promoBannerDraft.title || 'Promotional Banner'}
                          className="h-28 sm:h-32 w-full sm:w-52 rounded-xl object-cover border border-white/20 shadow-md shrink-0"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#3a3848] bg-[#121218] p-6 text-center text-xs text-[#a09eb5]">
                    Banner is currently <strong className="text-white">OFF</strong> — students will not see any banner or blank placeholder space on their dashboard.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB: BROADCAST ANNOUNCEMENT MANAGER ================= */}
          {tab === 'broadcast' && !editingTest && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 space-y-4">
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    📢 Broadcast Announcement / Message Box
                  </h2>
                  <p className="text-xs text-[#a09eb5] mt-0.5">
                    Send real-time announcements to all active students (`announcements` table &amp; `/api/v1/announcements`)
                  </p>
                </div>
                <form onSubmit={handleSendBroadcast} className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Announcement Title *</label>
                    <input
                      type="text"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      placeholder="Enter announcement title"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#a8a4ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Broadcast Message *</label>
                    <textarea
                      rows={3}
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      placeholder="Enter announcement message"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] p-3.5 text-sm text-white focus:outline-none focus:border-[#a8a4ff]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={broadcastBusy}
                    className="btn-press rounded-xl bg-[#4f46e5] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#4338ca] disabled:opacity-50 cursor-pointer"
                  >
                    {broadcastBusy ? 'Broadcasting...' : '📢 Send / Broadcast to All Students'}
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 space-y-3">
                <h3 className="font-display text-sm font-bold text-white">
                  Sent Broadcasts ({data.announcements?.length || 0})
                </h3>
                <div className="space-y-3">
                  {(data.announcements || []).map((ann) => (
                    <div
                      key={ann.id}
                      className="rounded-xl border border-[#2e2d3a] bg-[#25242f] p-4 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#a8a4ff] font-semibold">
                          <span>Broadcast #{ann.id}</span>
                          <span>·</span>
                          <span>{ann.adminName || `Admin #${ann.admin_id}`}</span>
                          <span>·</span>
                          <span className="text-[#a09eb5]">{ann.created_at}</span>
                        </div>
                        <div className="text-sm font-bold text-white">{ann.title}</div>
                        <p className="text-xs text-[#ecebf4]/85 leading-relaxed">{ann.message}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="rounded-lg border border-[#3a3848] p-1.5 text-rose-400 hover:bg-rose-950/40 cursor-pointer shrink-0"
                        title="Delete Broadcast"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!data.announcements || data.announcements.length === 0) && (
                    <p className="text-xs text-[#a09eb5] py-4 text-center">
                      No announcements broadcasted yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB: MOCK TESTS + TEST EDITOR ================= */}
          {tab === 'tests' && editingTest && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-[#a09eb5] mb-1">Test Title *</label>
                    <input
                      value={editingTest.title}
                      onChange={(e) => setEditingTest({ ...editingTest, title: e.target.value })}
                      placeholder="Enter mock test title"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Exam</label>
                    <select
                      value={editingTest.exam}
                      onChange={(e) => setEditingTest({ ...editingTest, exam: e.target.value })}
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white"
                    >
                      {data.exams.map((ex) => (
                        <option key={ex} value={ex}>
                          {ex}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Home Section Category</label>
                    <select
                      value={editingTest.cat}
                      onChange={(e) => {
                        const c = e.target.value;
                        setEditingTest({
                          ...editingTest,
                          cat: c,
                          paid: c === 'free' ? false : editingTest.paid,
                          price: c === 'free' ? 0 : editingTest.price,
                        });
                      }}
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white"
                    >
                      {DEFAULT_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Test Type</label>
                    <select
                      value={editingTest.testType}
                      onChange={(e) =>
                        setEditingTest({
                          ...editingTest,
                          testType: e.target.value as 'full' | 'sectional',
                        })
                      }
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white"
                    >
                      <option value="full">Full-Length Mock</option>
                      <option value="sectional">Sectional / Subject Test</option>
                    </select>
                  </div>

                  {editingTest.testType === 'sectional' && (
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Sectional Subject</label>
                      <div className="flex gap-2">
                        <select
                          value={editingTest.subject || data.subjects[0]}
                          onChange={(e) => setEditingTest({ ...editingTest, subject: e.target.value })}
                          className="flex-1 rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white"
                        >
                          {data.subjects.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <input
                          value={newSubjectInput}
                          onChange={(e) => setNewSubjectInput(e.target.value)}
                          placeholder="Enter subject"
                          className="w-32 rounded-xl border border-[#3a3848] bg-[#25242f] px-2.5 py-2 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!newSubjectInput.trim()) return;
                            await apiFetch('/api/admin/subjects', {
                              method: 'POST',
                              body: JSON.stringify({ name: newSubjectInput.trim() }),
                            });
                            setEditingTest({ ...editingTest, subject: newSubjectInput.trim() });
                            setNewSubjectInput('');
                            onRefreshData();
                          }}
                          className="rounded-xl bg-[#4f46e5] px-3 text-xs font-bold text-white cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Bundle (Optional)</label>
                    <select
                      value={editingTest.bundleId || ''}
                      onChange={(e) =>
                        setEditingTest({
                          ...editingTest,
                          bundleId: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white"
                    >
                      <option value="">None (Standalone Test)</option>
                      {data.bundles.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Syllabus / Topics Tag</label>
                    <input
                      value={editingTest.syllabusTag}
                      onChange={(e) => setEditingTest({ ...editingTest, syllabusTag: e.target.value })}
                      placeholder="Enter syllabus or topic tags"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Duration (m)</label>
                      <input
                        type="number"
                        value={editingTest.dur}
                        onChange={(e) => setEditingTest({ ...editingTest, dur: Number(e.target.value) })}
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2.5 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Neg Mark</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingTest.neg}
                        onChange={(e) => setEditingTest({ ...editingTest, neg: Number(e.target.value) })}
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2.5 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Attempts</label>
                      <input
                        type="number"
                        value={editingTest.attemptCount}
                        onChange={(e) =>
                          setEditingTest({ ...editingTest, attemptCount: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2.5 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Pricing &amp; Status</label>
                    <div className="flex gap-2">
                      <select
                        value={editingTest.paid ? 'paid' : 'free'}
                        onChange={(e) =>
                          setEditingTest({
                            ...editingTest,
                            paid: e.target.value === 'paid',
                            price: e.target.value === 'paid' ? editingTest.price : 0,
                          })
                        }
                        className="rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2.5 text-sm text-white"
                      >
                        <option value="free">Free</option>
                        <option value="paid">Paid</option>
                      </select>
                      {editingTest.paid && (
                        <input
                          type="number"
                          value={editingTest.price || ''}
                          onChange={(e) =>
                            setEditingTest({ ...editingTest, price: Number(e.target.value) })
                          }
                          placeholder="Enter price"
                          className="w-24 rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2.5 text-sm text-white"
                        />
                      )}
                      <select
                        value={editingTest.status}
                        onChange={(e) =>
                          setEditingTest({
                            ...editingTest,
                            status: e.target.value as 'live' | 'scheduled' | 'draft',
                          })
                        }
                        className="flex-1 rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2.5 text-sm text-white"
                      >
                        <option value="live">Live</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="draft">Draft</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Builder Toolbar */}
              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-base font-bold text-white">
                    ❓ Questions ({editingTest.qs.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setBuilderPanel('ai')}
                      className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>📄 Upload PDF &amp; Generate with AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuilderPanel('bulk')}
                      className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[#25242f] border border-[#3a3848] px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>📤 Bulk Import (CSV / JSON)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQForm({
                          t: '',
                          o: ['', '', '', ''],
                          c: 0,
                          e: '',
                          subj: data.subjects[0],
                          previous_exams: [],
                          tagDraft: '',
                          editIdx: null,
                          aiReviewIdx: null,
                        });
                        setBuilderPanel('manual');
                      }}
                      className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>✍️ Add Question Manually</span>
                    </button>
                  </div>
                </div>

                {/* AI PDF Extractor Panel (up to 120 questions + ExamRef detection) */}
                {builderPanel === 'ai' && (
                  <div className="rounded-2xl border border-[#3a3848] bg-[#25242f] p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display text-sm font-bold text-white">
                        AI PDF Extractor (Gemini · Up to 120 Questions)
                      </h4>
                      <button
                        type="button"
                        onClick={() => setBuilderPanel(null)}
                        className="text-xs text-[#a09eb5]"
                      >
                        Close
                      </button>
                    </div>
                    <p className="text-xs text-[#a09eb5]">
                      Automatically extracts MCQs with 4 options, explanations, and detects previous exam tags (max 3 tags). Nothing is added until you approve.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setAiFileName(file.name);
                          setAiUseSample(false);
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') setAiPdfBase64(reader.result);
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="text-xs text-[#a09eb5]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAiFileName('JKSSB_JK_GK_Sample.pdf');
                          setAiUseSample(true);
                          setAiPdfBase64('');
                        }}
                        className="rounded-xl border border-[#3a3848] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                      >
                        Use Sample J&amp;K PDF
                      </button>
                    </div>

                    {aiFileName && (
                      <div className="space-y-3">
                        <div className="text-xs text-emerald-400">Selected: {aiFileName}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-[#a09eb5]">Number of Questions:</span>
                          {[10, 25, 50, 100, 120].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setAiCount(n)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${
                                aiCount === n
                                  ? 'bg-[#4f46e5] text-white'
                                  : 'bg-[#1b1a22] text-[#a09eb5] border border-[#3a3848]'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={aiBusy}
                          onClick={handleAiExtract}
                          className="btn-press rounded-xl bg-[#4f46e5] px-5 py-2.5 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                        >
                          {aiBusy && aiProgress
                            ? `⏳ Batch ${aiProgress.currentBatch}/${aiProgress.totalBatches} (${aiProgress.extractedCount}/${aiProgress.targetCount} Qs)...`
                            : aiBusy
                            ? `⏳ Extracting ${aiCount} questions...`
                            : `✨ Generate ${aiCount} Questions`}
                        </button>
                        {aiBusy && aiProgress && (
                          <div className="space-y-1">
                            <div className="h-1.5 w-full rounded-full bg-[#1b1a22] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#4f46e5] transition-all duration-300"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      (aiProgress.extractedCount / Math.max(1, aiProgress.targetCount)) * 100
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                            <p className="text-[11px] text-[#a09eb5]">
                              Processing in fast chunks of 20 to prevent timeouts. Partial results appear live below.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {aiErr && <div className="text-xs text-rose-400 font-semibold">{aiErr}</div>}

                    {aiQueue.length > 0 && (
                      <div className="space-y-3 pt-3 border-t border-[#3a3848]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">
                            Review Queue ({aiQueue.filter((x) => x.reviewState === 'pending').length} pending)
                          </span>
                          <button
                            type="button"
                            onClick={approveAllPendingAi}
                            className="btn-press rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer"
                          >
                            Approve All Pending
                          </button>
                        </div>
                        <div className="max-h-96 overflow-y-auto space-y-2.5">
                          {aiQueue.map((item, idx) => {
                            const itemTags = getPreviousExams(item);
                            return (
                              <div
                                key={item.id}
                                className="rounded-xl border border-[#3a3848] bg-[#1b1a22] p-3.5 space-y-2 text-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <strong className="text-white">
                                    {idx + 1}. {item.t}
                                  </strong>
                                  <span className="uppercase text-[10px] font-bold text-[#a8a4ff]">
                                    {item.reviewState}
                                  </span>
                                </div>
                                {itemTags.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {itemTags.map((tag) => (
                                      <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 rounded-md bg-amber-950/70 border border-amber-700/60 px-2 py-0.5 text-[11px] font-semibold text-amber-300"
                                      >
                                        <span>{tag}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextTags = itemTags.filter((t) => t !== tag);
                                            const normalized = normalizePreviousExams(nextTags);
                                            const nextQueue = [...aiQueue];
                                            nextQueue[idx] = {
                                              ...item,
                                              previous_exams: normalized,
                                              examRef: normalized ?? [],
                                            };
                                            setAiQueue(nextQueue);
                                            apiFetch(`/api/admin/extraction-results/${item.id}`, {
                                              method: 'PUT',
                                              body: JSON.stringify({ previous_exams: normalized }),
                                            }).catch(() => {});
                                          }}
                                          className="text-amber-400 hover:text-white cursor-pointer"
                                          title="Remove tag"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="text-emerald-400">
                                  ✔ {LABELS[item.c]}. {item.o[item.c]}
                                </div>
                                {item.reviewState === 'pending' && (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => approveAiItem(idx)}
                                      className="rounded-lg bg-emerald-600 px-3 py-1 text-white font-bold cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQForm({
                                          t: item.t,
                                          o: [...item.o],
                                          c: item.c,
                                          e: item.e,
                                          subj: item.subj,
                                          previous_exams: getPreviousExams(item),
                                          tagDraft: '',
                                          editIdx: null,
                                          aiReviewIdx: idx,
                                        });
                                        setBuilderPanel('manual');
                                      }}
                                      className="rounded-lg bg-[#25242f] border border-[#3a3848] px-3 py-1 text-white cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = [...aiQueue];
                                        next[idx].reviewState = 'rejected';
                                        setAiQueue(next);
                                      }}
                                      className="rounded-lg text-rose-400 px-2 py-1 cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bulk CSV / JSON Import */}
                {builderPanel === 'bulk' && (
                  <div className="rounded-2xl border border-[#3a3848] bg-[#25242f] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-display text-sm font-bold text-white">
                        📤 Bulk Import (CSV / JSON) with Duplicate Check
                      </h4>
                      <button
                        type="button"
                        onClick={downloadSampleCsv}
                        className="btn-press inline-flex items-center gap-1 rounded-xl bg-[#1b1a22] border border-[#3a3848] px-3 py-1.5 text-xs font-semibold text-[#a8a4ff] cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>📥 Download Sample CSV</span>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {(['csv', 'json'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setBulkMode(m)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase cursor-pointer ${
                            bulkMode === m ? 'bg-[#4f46e5] text-white' : 'bg-[#1b1a22] text-[#a09eb5]'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                      {bulkMode === 'csv' && (
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const r = new FileReader();
                            r.onload = () => {
                              if (typeof r.result === 'string') setBulkText(r.result);
                            };
                            r.readAsText(f);
                          }}
                          className="text-xs text-[#a09eb5]"
                        />
                      )}
                    </div>
                    <textarea
                      rows={5}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={
                        bulkMode === 'csv'
                          ? 'Paste CSV rows for bulk question import'
                          : 'Paste JSON array of questions'
                      }
                      className="w-full rounded-xl border border-[#3a3848] bg-[#1b1a22] p-3 text-xs font-mono text-white"
                    />
                    {bulkMsg && <p className="text-xs text-emerald-400 font-semibold">{bulkMsg}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleBulkImport}
                        className="btn-press rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                      >
                        Import Questions
                      </button>
                      <button
                        type="button"
                        onClick={() => setBuilderPanel(null)}
                        className="rounded-xl border border-[#3a3848] px-4 py-2 text-xs text-[#a09eb5] cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}

                {/* Manual Question Form */}
                {builderPanel === 'manual' && (
                  <div className="rounded-2xl border border-[#3a3848] bg-[#25242f] p-4 space-y-3">
                    <h4 className="font-display text-sm font-bold text-white">
                      {qForm.editIdx !== null ? 'Edit Question' : 'Add New Question'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#a09eb5] mb-1">Subject</label>
                        <select
                          value={qForm.subj}
                          onChange={(e) => setQForm({ ...qForm, subj: e.target.value })}
                          className="w-full rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-2 text-sm text-white"
                        >
                          {data.subjects.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs text-[#a09eb5]">
                            Previous Exam Tags (<code className="text-[#a8a4ff]">previous_exams</code> — Max 3)
                          </label>
                          <span className="text-[11px] font-mono text-[#a09eb5] tabular-nums">
                            {qForm.previous_exams.length}/3 tags
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={qForm.tagDraft}
                            disabled={qForm.previous_exams.length >= 3}
                            onChange={(e) => setQForm({ ...qForm, tagDraft: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                addPreviousExamTagToForm();
                              }
                            }}
                            placeholder={
                              qForm.previous_exams.length >= 3
                                ? 'Maximum 3 tags reached'
                                : 'Enter previous exam tag'
                            }
                            className="flex-1 rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-2 text-sm text-white disabled:opacity-50"
                          />
                          <button
                            type="button"
                            disabled={qForm.previous_exams.length >= 3 || !qForm.tagDraft.trim()}
                            onClick={() => addPreviousExamTagToForm()}
                            className="btn-press rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            + Add Tag
                          </button>
                        </div>

                        {/* Active Removable Tag Chips */}
                        {qForm.previous_exams.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {qForm.previous_exams.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1b1a22] border border-amber-500/50 px-2.5 py-1 text-xs font-semibold text-amber-300"
                              >
                                <span>{tag}</span>
                                <button
                                  type="button"
                                  onClick={() => removePreviousExamTagFromForm(tag)}
                                  className="text-amber-400 hover:text-rose-400 font-bold cursor-pointer"
                                  title={`Remove ${tag}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={qForm.t}
                      onChange={(e) => setQForm({ ...qForm, t: e.target.value })}
                      placeholder="Enter question text"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#1b1a22] p-3 text-sm text-white"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {qForm.o.map((opt, idx) => (
                        <input
                          key={idx}
                          value={opt}
                          onChange={(e) => {
                            const next: [string, string, string, string] = [...qForm.o];
                            next[idx] = e.target.value;
                            setQForm({ ...qForm, o: next });
                          }}
                          placeholder={`Enter Option ${LABELS[idx]}`}
                          className="w-full rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-2 text-sm text-white"
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <select
                        value={qForm.c}
                        onChange={(e) => setQForm({ ...qForm, c: Number(e.target.value) })}
                        className="rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-2 text-sm text-white"
                      >
                        {[0, 1, 2, 3].map((idx) => (
                          <option key={idx} value={idx}>
                            Correct: Option {LABELS[idx]}
                          </option>
                        ))}
                      </select>
                      <input
                        value={qForm.e}
                        onChange={(e) => setQForm({ ...qForm, e: e.target.value })}
                        placeholder="Enter answer explanation"
                        className="md:col-span-2 rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveManualQuestion}
                        className="btn-press rounded-xl bg-[#4f46e5] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                      >
                        {qForm.editIdx !== null ? 'Update Question' : 'Add Question'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBuilderPanel(null)}
                        className="rounded-xl border border-[#3a3848] px-4 py-2 text-xs text-[#a09eb5] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* List of Questions in Test */}
                <div className="space-y-2.5">
                  {editingTest.qs.map((q, idx) => {
                    const qTags = getPreviousExams(q);
                    return (
                      <div
                        key={q.id}
                        className="rounded-xl border border-[#2e2d3a] bg-[#25242f] p-3.5 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="text-xs font-bold text-white">
                            Q{idx + 1}. {q.t}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#a09eb5]">
                            <span>
                              {q.subj} · ✔ {LABELS[q.c]} ({q.o[q.c]})
                            </span>
                            {qTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-md bg-amber-950/60 border border-amber-700/50 px-2 py-0.5 text-[10px] font-semibold text-amber-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setQForm({
                                t: q.t,
                                o: [...q.o],
                                c: q.c,
                                e: q.e,
                                subj: q.subj,
                                previous_exams: getPreviousExams(q),
                                tagDraft: '',
                                editIdx: idx,
                                aiReviewIdx: null,
                              });
                              setBuilderPanel('manual');
                            }}
                            className="rounded-lg border border-[#3a3848] p-1.5 text-[#a09eb5] hover:text-white cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingTest({
                                ...editingTest,
                                qs: editingTest.qs.filter((_, i) => i !== idx),
                              })
                            }
                            className="rounded-lg border border-[#3a3848] p-1.5 text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-4 border-t border-[#2e2d3a]">
                  <button
                    type="button"
                    onClick={handleSaveTestToServer}
                    className="btn-press rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    💾 Save Mock Test
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTest(null)}
                    className="rounded-xl border border-[#3a3848] px-5 py-2.5 text-sm font-semibold text-[#a09eb5] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB: MOCK TESTS LIST ================= */}
          {tab === 'tests' && !editingTest && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.tests.map((t) => (
                  <div
                    key={t.id}
                    className="card-hover rounded-2xl border border-[#2e2d3a] bg-[#25242f] p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[#a8a4ff] font-semibold">{t.exam}</span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            t.status === 'live'
                              ? 'bg-emerald-950 text-emerald-300'
                              : t.status === 'scheduled'
                              ? 'bg-amber-950 text-amber-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <h3 className="font-display text-sm font-bold text-white">{t.title}</h3>
                      <div className="text-xs text-[#a09eb5] mt-1">
                        {t.qs.length} Qs · {t.dur}m · {t.paid ? `₹${t.price}` : 'Free'} · {t.testType}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-[#2e2d3a]">
                      <button
                        type="button"
                        onClick={() => openEditTest(t)}
                        className="flex-1 rounded-lg border border-[#3a3848] py-1.5 text-xs font-semibold text-white hover:bg-[#35327a] cursor-pointer"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/tests/${t.id}`, { method: 'DELETE' });
                          onRefreshData();
                          onToast('Test deleted');
                        }}
                        className="rounded-lg border border-[#3a3848] px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB: RESULTS & EXPORT DISTRICT TOPPERS ================= */}
          {tab === 'results' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-bold text-white">
                    Monthly Result Menu Auto-Refresh (Month-End Day at 11:55 PM)
                  </div>
                  <div className="text-[#a09eb5] mt-0.5 tabular-nums">
                    Next automatic refresh:{' '}
                    {data.resultCycle?.nextRefreshLabel ||
                      getNextMonthEndRefreshDate(new Date()).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    {data.resultCycle?.lastRefreshIso
                      ? ` · Last refreshed: ${new Date(data.resultCycle.lastRefreshIso).toLocaleString('en-IN')}`
                      : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiFetch('/api/admin/results/refresh', { method: 'POST' });
                      onRefreshData();
                      onToast('Result Menu archived & refreshed for the new cycle!');
                    } catch (err: unknown) {
                      onToast(err instanceof Error ? err.message : 'Refresh failed.');
                    }
                  }}
                  className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2 text-xs font-semibold text-white hover:border-[#6c63ff] cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Archive &amp; Refresh Now</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <select
                  value={selectedResultTestId}
                  onChange={(e) => setSelectedResultTestId(Number(e.target.value))}
                  className="rounded-xl border border-[#3a3848] bg-[#25242f] px-4 py-2.5 text-sm text-white"
                >
                  {data.tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowToppersExport(true)}
                  className="btn-press inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold text-amber-950 cursor-pointer"
                >
                  <Award className="w-4 h-4" />
                  <span>🏆 View &amp; Export District Toppers</span>
                </button>
              </div>

              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#2e2d3a] text-[#a09eb5]">
                    <tr>
                      <th className="p-3.5">#</th>
                      <th className="p-3.5">Student</th>
                      <th className="p-3.5">District</th>
                      <th className="p-3.5">Score</th>
                      <th className="p-3.5">✔ / ✖</th>
                      <th className="p-3.5">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e2d3a]">
                    {data.results
                      .filter((r) => r.testId === selectedResultTestId)
                      .sort((a, b) => b.score - a.score || a.timeSec - b.timeSec)
                      .map((r, i) => (
                        <tr key={r.id}>
                          <td className="p-3.5 font-bold">{['🥇', '🥈', '🥉'][i] || i + 1}</td>
                          <td className="p-3.5 font-semibold text-white">{r.name}</td>
                          <td className="p-3.5 text-[#a09eb5]">{r.district}</td>
                          <td className="p-3.5 font-mono font-bold text-[#a8a4ff] tabular-nums">
                            {r.score}/{r.maxScore}
                          </td>
                          <td className="p-3.5 tabular-nums">
                            {r.correct} / {r.wrong}
                          </td>
                          <td className="p-3.5 tabular-nums text-[#a09eb5]">
                            {Math.floor(r.timeSec / 60)}m {r.timeSec % 60}s
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {data.resultCycle && data.resultCycle.archivedCycles.length > 0 && (
                <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 space-y-3">
                  <h3 className="font-display text-sm font-bold text-white">
                    Archived Monthly Result Cycles ({data.resultCycle.archivedCycles.length})
                  </h3>
                  <div className="space-y-2">
                    {data.resultCycle.archivedCycles.map((arc) => (
                      <div
                        key={arc.cycleKey + arc.archivedAt}
                        className="flex items-center justify-between rounded-xl bg-[#25242f] px-4 py-2.5 text-xs"
                      >
                        <span className="font-semibold text-white">
                          {arc.cycleLabel} ({arc.cycleKey})
                        </span>
                        <span className="text-[#a09eb5] tabular-nums">
                          {arc.totalAttempts} attempts · Archived {arc.archivedAt}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showToppersExport && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                  onClick={() => setShowToppersExport(false)}
                >
                  <div
                    className="w-full max-w-xl rounded-2xl border border-[#3a3848] bg-[#1b1a22] p-6 space-y-4 max-h-[85vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-bold text-white">
                        🏆 J&amp;K District Toppers Hall of Fame
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowToppersExport(false)}
                        className="text-[#a09eb5]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {districtToppersList.map((d) => (
                        <div
                          key={d.district}
                          className="flex items-center justify-between rounded-xl bg-[#25242f] px-4 py-2.5 text-xs"
                        >
                          <span>
                            <strong className="text-amber-300">{d.district}:</strong> {d.name} ({d.targetExam})
                          </span>
                          <span className="font-mono font-bold text-emerald-400">
                            {d.score}/{d.maxScore}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const text =
                            '🏆 ExamPro J&K District Toppers:\n\n' +
                            districtToppersList
                              .map((d) => `🥇 ${d.district}: ${d.name} (${d.score}/${d.maxScore})`)
                              .join('\n');
                          navigator.clipboard.writeText(text);
                          onToast('Toppers list copied for WhatsApp / Telegram!');
                        }}
                        className="btn-press flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4f46e5] py-2.5 text-xs font-bold text-white cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Copy for Telegram / WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const csv =
                            'District,Topper Name,Target Exam,Score,Max Score\n' +
                            districtToppersList
                              .map((d) => `"${d.district}","${d.name}","${d.targetExam}",${d.score},${d.maxScore}`)
                              .join('\n');
                          const blob = new Blob([csv], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'ExamPro_JK_District_Toppers.csv';
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>CSV</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB: STUDENTS ================= */}
          {tab === 'students' && (
            <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#2e2d3a] text-[#a09eb5]">
                  <tr>
                    <th className="p-3.5">Student</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Mobile</th>
                    <th className="p-3.5">District</th>
                    <th className="p-3.5">Target Exam</th>
                    <th className="p-3.5">Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2e2d3a]">
                  {(data.students || []).map((s) => (
                    <tr key={s.id}>
                      <td className="p-3.5 font-semibold text-white">{s.name}</td>
                      <td className="p-3.5 text-[#a09eb5]">{s.email}</td>
                      <td className="p-3.5 font-mono">{s.phone}</td>
                      <td className="p-3.5">{s.district}</td>
                      <td className="p-3.5 text-[#a09eb5]">{s.exam}</td>
                      <td className="p-3.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            s.ownedTestIds.length > 0
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {s.ownedTestIds.length > 0 ? 'Paid' : 'Free'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= TAB: EXAMS ================= */}
          {tab === 'exams' && (
            <div className="max-w-2xl space-y-4">
              <div className="flex gap-2">
                <input
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  placeholder="Enter exam name"
                  className="flex-1 rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2.5 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newExamName.trim()) return;
                    await apiFetch('/api/admin/exams', {
                      method: 'POST',
                      body: JSON.stringify({ name: newExamName.trim() }),
                    });
                    setNewExamName('');
                    onRefreshData();
                    onToast('Exam added!');
                  }}
                  className="btn-press rounded-xl bg-[#4f46e5] px-5 py-2.5 text-xs font-bold text-white cursor-pointer"
                >
                  Add Exam
                </button>
              </div>
              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] divide-y divide-[#2e2d3a]">
                {data.exams.map((ex) => (
                  <div key={ex} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{ex}</span>
                    {ex !== 'Other' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/exams/${encodeURIComponent(ex)}`, {
                            method: 'DELETE',
                          });
                          onRefreshData();
                        }}
                        className="text-xs text-rose-400 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB: TEST BUNDLES ================= */}
          {tab === 'bundles' && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <p className="text-xs text-[#a09eb5]">
                  Group Full-Length &amp; Sectional Mocks into discounted bundles.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setBundleDraft({
                      title: '',
                      exam: data.exams[0] || '',
                      desc: '',
                      price: 0,
                      mrp: 0,
                      validity: '',
                      bundleOnly: false,
                      testIds: [],
                    })
                  }
                  className="btn-press rounded-xl bg-[#4f46e5] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  + Create Bundle
                </button>
              </div>

              {bundleDraft && (
                <div className="rounded-2xl border border-[#3a3848] bg-[#25242f] p-5 space-y-3">
                  <h3 className="font-display text-sm font-bold text-white">
                    {bundleDraft.id ? 'Edit Bundle' : 'New Test Bundle'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={bundleDraft.title || ''}
                      onChange={(e) => setBundleDraft({ ...bundleDraft, title: e.target.value })}
                      placeholder="Enter bundle title"
                      className="rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-2 text-sm text-white"
                    />
                    <select
                      value={bundleDraft.exam || data.exams[0] || ''}
                      onChange={(e) => setBundleDraft({ ...bundleDraft, exam: e.target.value })}
                      className="rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-2 text-sm text-white"
                    >
                      {data.exams.length === 0 && (
                        <option value="">Create an exam category first</option>
                      )}
                      {data.exams.map((ex) => (
                        <option key={ex} value={ex}>
                          {ex}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={bundleDraft.price || ''}
                      onChange={(e) => setBundleDraft({ ...bundleDraft, price: Number(e.target.value) })}
                      placeholder="Enter selling price (₹)"
                      className="rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="number"
                      value={bundleDraft.mrp || ''}
                      onChange={(e) => setBundleDraft({ ...bundleDraft, mrp: Number(e.target.value) })}
                      placeholder="Enter MRP (₹)"
                      className="rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={bundleDraft.validity || ''}
                      onChange={(e) => setBundleDraft({ ...bundleDraft, validity: e.target.value })}
                      placeholder="Enter validity period"
                      className="rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-2 text-sm text-white"
                    />
                    <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(bundleDraft.bundleOnly)}
                        onChange={(e) =>
                          setBundleDraft({ ...bundleDraft, bundleOnly: e.target.checked })
                        }
                      />
                      Bundle-Only Exclusive
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={bundleDraft.desc || ''}
                    onChange={(e) => setBundleDraft({ ...bundleDraft, desc: e.target.value })}
                    placeholder="Enter bundle description"
                    className="w-full rounded-xl border border-[#3a3848] bg-[#1b1a22] p-3 text-sm text-white"
                  />
                  <div>
                    <div className="text-xs text-[#a09eb5] mb-2">Select Included Mock Tests:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {data.tests.map((t) => {
                        const checked = (bundleDraft.testIds || []).includes(t.id);
                        return (
                          <label
                            key={t.id}
                            className="flex items-center gap-2 text-xs rounded-lg bg-[#1b1a22] px-3 py-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const cur = bundleDraft.testIds || [];
                                setBundleDraft({
                                  ...bundleDraft,
                                  testIds: checked ? cur.filter((x) => x !== t.id) : [...cur, t.id],
                                });
                              }}
                            />
                            <span className="truncate">{t.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!bundleDraft.title?.trim()) return;
                        if (bundleDraft.id) {
                          await apiFetch(`/api/admin/bundles/${bundleDraft.id}`, {
                            method: 'PUT',
                            body: JSON.stringify(bundleDraft),
                          });
                        } else {
                          await apiFetch('/api/admin/bundles', {
                            method: 'POST',
                            body: JSON.stringify(bundleDraft),
                          });
                        }
                        setBundleDraft(null);
                        onRefreshData();
                        onToast('Bundle saved!');
                      }}
                      className="btn-press rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      Save Bundle
                    </button>
                    <button
                      type="button"
                      onClick={() => setBundleDraft(null)}
                      className="rounded-xl border border-[#3a3848] px-4 py-2 text-xs text-[#a09eb5] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.bundles.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-[#2e2d3a] bg-[#25242f] p-4 space-y-2"
                  >
                    <div className="text-xs text-[#a8a4ff] font-semibold">
                      {b.exam} · {b.validity}
                    </div>
                    <h4 className="font-display text-sm font-bold text-white">{b.title}</h4>
                    <div className="text-xs text-[#a09eb5]">
                      ₹{b.price} <span className="line-through">₹{b.mrp}</span> · {b.testIds.length} tests
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setBundleDraft(b)}
                        className="flex-1 rounded-lg border border-[#3a3848] py-1.5 text-xs text-white cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/bundles/${b.id}`, { method: 'DELETE' });
                          onRefreshData();
                        }}
                        className="rounded-lg border border-[#3a3848] px-3 py-1.5 text-xs text-rose-400 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB: AUTOMATED RAZORPAY TRANSACTIONS & COUPONS ================= */}
          {tab === 'payments' && (
            <div className="space-y-6">
              {/* 4 Dark Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Revenue', val: `₹${totalRevenue}` },
                  {
                    label: 'Razorpay Auto-Paid',
                    val: data.payments.filter((p) => p.status === 'PAID' && p.paymentMethod === 'RAZORPAY').length,
                  },
                  { label: 'Total Paid Orders', val: data.payments.filter((p) => p.status === 'PAID').length },
                  { label: 'Active Coupons', val: data.coupons.filter((c) => c.active).length },
                ].map((c) => (
                  <div key={c.label} className="rounded-2xl border border-[#2e2d3a] bg-[#25242f] p-4">
                    <div className="font-mono text-2xl font-extrabold text-white tabular-nums">
                      {c.val}
                    </div>
                    <div className="text-xs text-[#a09eb5] mt-1">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Automated Razorpay Gateway Banner */}
              <div className="rounded-2xl border border-emerald-500/30 bg-[#1b1a22] p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <h3 className="font-display text-sm font-bold text-white">
                      Automated Razorpay Payment Gateway Active
                    </h3>
                  </div>
                  <p className="text-xs text-[#a09eb5]">
                    All student UPI payments (UPI QR, Google Pay, PhonePe) are verified automatically
                    via Razorpay HMAC SHA256 callbacks and unlock access instantaneously without manual approval.
                  </p>
                </div>
                <div className="rounded-xl border border-[#3a3848] bg-[#25242f] px-3.5 py-2 text-xs font-mono text-emerald-300">
                  Mode: Auto-Verify &amp; Unlock
                </div>
              </div>

              {/* Sub-tabs: Transaction History vs Coupons vs Payment Settings */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPaySubTab('tx')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer ${
                    paySubTab === 'tx' ? 'bg-[#4f46e5] text-white' : 'bg-[#25242f] text-[#a09eb5]'
                  }`}
                >
                  Transaction History ({data.payments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPaySubTab('coupons')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer ${
                    paySubTab === 'coupons' ? 'bg-[#4f46e5] text-white' : 'bg-[#25242f] text-[#a09eb5]'
                  }`}
                >
                  Coupons ({data.coupons.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPaySubTab('gateway')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer ${
                    paySubTab === 'gateway' ? 'bg-[#4f46e5] text-white' : 'bg-[#25242f] text-[#a09eb5]'
                  }`}
                >
                  Payment Settings (Razorpay)
                </button>
              </div>

              {paySubTab === 'tx' ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="w-4 h-4 text-[#a09eb5] absolute left-3 top-2.5" />
                      <input
                        value={txSearch}
                        onChange={(e) => setTxSearch(e.target.value)}
                        placeholder="Search by student name, test name, or payment ID"
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] pl-9 pr-3 py-2 text-xs text-white"
                      />
                    </div>

                    {/* Manual Grant Access Utility */}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={manualUnlock.userId}
                        onChange={(e) => setManualUnlock({ ...manualUnlock, userId: Number(e.target.value) })}
                        className="rounded-xl border border-[#3a3848] bg-[#25242f] px-2.5 py-2 text-xs text-white"
                      >
                        <option value={0}>Select Student</option>
                        {(data.students || []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.phone})
                          </option>
                        ))}
                      </select>
                      <select
                        value={manualUnlock.itemId}
                        onChange={(e) => setManualUnlock({ ...manualUnlock, itemId: Number(e.target.value) })}
                        className="rounded-xl border border-[#3a3848] bg-[#25242f] px-2.5 py-2 text-xs text-white"
                      >
                        <option value={0}>Select Test</option>
                        {data.tests.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!manualUnlock.userId || !manualUnlock.itemId) return;
                          await apiFetch('/api/admin/payments/manual-unlock', {
                            method: 'POST',
                            body: JSON.stringify(manualUnlock),
                          });
                          onRefreshData();
                          onToast('Access granted to student!');
                        }}
                        className="btn-press rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white cursor-pointer"
                      >
                        Grant Access
                      </button>
                    </div>
                  </div>

                  {/* Clean Transaction History Table */}
                  <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#25242f] text-[#a09eb5] border-b border-[#2e2d3a]">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Student Name</th>
                            <th className="px-4 py-3 font-semibold">Test Name</th>
                            <th className="px-4 py-3 font-semibold">Gateway / Ref ID</th>
                            <th className="px-4 py-3 font-semibold text-right">Amount</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Date</th>
                            <th className="px-4 py-3 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2e2d3a]">
                          {data.payments
                            .filter((p) => {
                              const q = txSearch.toLowerCase();
                              return (
                                !q ||
                                p.userName.toLowerCase().includes(q) ||
                                p.userPhone.includes(q) ||
                                p.itemTitle.toLowerCase().includes(q) ||
                                (p.razorpayPaymentId || '').toLowerCase().includes(q) ||
                                (p.razorpayOrderId || '').toLowerCase().includes(q) ||
                                (p.utrNumber || '').toLowerCase().includes(q) ||
                                p.orderNumber.toLowerCase().includes(q)
                              );
                            })
                            .map((p) => (
                              <tr key={p.id} className="hover:bg-[#25242f]/60">
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-white">{p.userName}</div>
                                  <div className="text-[11px] text-[#a09eb5]">+91 {p.userPhone}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-white">{p.itemTitle}</div>
                                  <div className="text-[11px] text-[#a09eb5]">
                                    {p.itemType === 'bundle' ? 'Bundle' : 'Mock Test'}
                                    {p.couponCode ? ` · Coupon: ${p.couponCode}` : ''}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-[11px] text-[#a8a4ff]">
                                  <div>{p.razorpayPaymentId || p.utrNumber || p.orderNumber}</div>
                                  <div className="text-[10px] text-[#a09eb5]">
                                    {p.paymentMethod}
                                    {p.razorpayOrderId ? ` · ${p.razorpayOrderId}` : ''}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-white tabular-nums">
                                  ₹{p.finalAmount}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                      p.status === 'PAID'
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/40'
                                        : p.status === 'PENDING_VERIFICATION' || p.status === 'CREATED'
                                        ? 'bg-amber-950 text-amber-300 border border-amber-700/40'
                                        : 'bg-rose-950 text-rose-300 border border-rose-700/40'
                                    }`}
                                  >
                                    {p.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-[#a09eb5] whitespace-nowrap">
                                  {p.createdAt}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-[11px] font-medium text-emerald-300/80">
                                    {p.status === 'PAID' ? 'Auto-Unlocked' : 'Auto-Tracked'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          {data.payments.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-[#a09eb5]">
                                No payment transactions recorded yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : paySubTab === 'coupons' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Code</label>
                      <input
                        value={newCoupon.code}
                        onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                        placeholder="Enter coupon code"
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-xs text-white uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Type</label>
                      <select
                        value={newCoupon.type}
                        onChange={(e) =>
                          setNewCoupon({
                            ...newCoupon,
                            type: e.target.value as 'percent' | 'flat' | 'free',
                          })
                        }
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-xs text-white"
                      >
                        <option value="percent">% Off</option>
                        <option value="flat">Flat ₹ Off</option>
                        <option value="free">100% Free</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Value</label>
                      <input
                        type="number"
                        value={newCoupon.value}
                        onChange={(e) => setNewCoupon({ ...newCoupon, value: e.target.value })}
                        placeholder="Enter discount value"
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Expiry</label>
                      <input
                        type="date"
                        value={newCoupon.expiryDate}
                        onChange={(e) => setNewCoupon({ ...newCoupon, expiryDate: e.target.value })}
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newCoupon.code.trim()) return;
                        await apiFetch('/api/admin/coupons', {
                          method: 'POST',
                          body: JSON.stringify({
                            ...newCoupon,
                            value: Number(newCoupon.value || 0),
                            maxUses: Number(newCoupon.maxUses || 100),
                          }),
                        });
                        setNewCoupon({ code: '', type: 'percent', value: '', maxUses: '', expiryDate: '' });
                        onRefreshData();
                        onToast('Coupon created!');
                      }}
                      className="btn-press rounded-xl bg-[#4f46e5] py-2.5 text-xs font-bold text-white cursor-pointer"
                    >
                      + Create Coupon
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.coupons.map((c: Coupon) => (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-[#2e2d3a] bg-[#25242f] p-4 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-mono text-sm font-extrabold text-white">{c.code}</div>
                          <div className="text-xs text-[#a09eb5]">
                            {c.type === 'free'
                              ? '100% Free'
                              : c.type === 'percent'
                              ? `${c.value}% Off`
                              : `₹${c.value} Off`}{' '}
                            · Used {c.usedCount}/{c.maxUses}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/coupons/${c.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ active: !c.active }),
                            });
                            onRefreshData();
                          }}
                          className={`rounded-lg px-3 py-1 text-xs font-bold cursor-pointer ${
                            c.active ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {c.active ? 'Active' : 'Off'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#35327a] bg-[#1b1a22] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-bold text-white">
                        💳 Razorpay Configuration (Payment Settings)
                      </h3>
                      <p className="text-xs text-[#a09eb5] mt-0.5">
                        Configure Razorpay Key ID &amp; Secret dynamically in database storage (falls back to .env when blank).
                      </p>
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                        data.settings.razorpay?.keyId
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-indigo-950 text-indigo-300'
                      }`}
                    >
                      {data.settings.razorpay?.keyId ? 'Database Override Active' : 'Using .env Fallback'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Razorpay Key ID</label>
                      <input
                        type="text"
                        value={razorpayDraft.keyId}
                        onChange={(e) =>
                          setRazorpayDraft({ ...razorpayDraft, keyId: e.target.value })
                        }
                        placeholder="Enter Razorpay Key ID"
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#4f46e5]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Razorpay Secret Key</label>
                      <div className="relative">
                        <input
                          type={showRazorpaySecret ? 'text' : 'password'}
                          value={razorpayDraft.keySecret}
                          onChange={(e) =>
                            setRazorpayDraft({ ...razorpayDraft, keySecret: e.target.value })
                          }
                          placeholder="Enter Razorpay Secret Key"
                          className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] pl-3 pr-10 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#4f46e5]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRazorpaySecret((v) => !v)}
                          aria-label={showRazorpaySecret ? 'Hide secret key' : 'Show secret key'}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a09eb5] hover:text-white cursor-pointer"
                        >
                          {showRazorpaySecret ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={savingRazorpay}
                      onClick={async () => {
                        setSavingRazorpay(true);
                        try {
                          await apiFetch('/api/admin/razorpay-settings', {
                            method: 'PUT',
                            body: JSON.stringify({
                              razorpay_key: razorpayDraft.keyId.trim(),
                              razorpay_secret: razorpayDraft.keySecret.trim(),
                            }),
                          });
                          onRefreshData();
                          onToast('Razorpay configuration saved!');
                        } catch (err: unknown) {
                          onToast(
                            err instanceof Error ? err.message : 'Could not save Razorpay settings.'
                          );
                        } finally {
                          setSavingRazorpay(false);
                        }
                      }}
                      className="btn-press inline-flex items-center gap-2 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] px-5 py-2.5 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{savingRazorpay ? 'Saving...' : 'Save Settings'}</span>
                    </button>

                    {data.settings.razorpay?.keyId && (
                      <button
                        type="button"
                        disabled={savingRazorpay}
                        onClick={async () => {
                          setSavingRazorpay(true);
                          try {
                            await apiFetch('/api/admin/razorpay-settings', {
                              method: 'PUT',
                              body: JSON.stringify({ razorpay_key: '', razorpay_secret: '' }),
                            });
                            setRazorpayDraft({ keyId: '', keySecret: '' });
                            onRefreshData();
                            onToast('Cleared database override; reverted to .env keys.');
                          } finally {
                            setSavingRazorpay(false);
                          }
                        }}
                        className="rounded-xl border border-[#3a3848] px-4 py-2.5 text-xs font-semibold text-[#a09eb5] hover:text-white cursor-pointer"
                      >
                        Reset to .env Fallback
                      </button>
                    )}
                  </div>
                </div>
              )}

              {previewScreenshot && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                  onClick={() => setPreviewScreenshot(null)}
                >
                  <img
                    src={previewScreenshot}
                    alt="Payment screenshot"
                    className="max-h-[85vh] max-w-full rounded-2xl border border-white/20"
                  />
                </div>
              )}
            </div>
          )}

          {/* ================= TAB: SYLLABUS ================= */}
          {tab === 'syllabus' && (
            <div className="space-y-5 max-w-3xl">
              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 space-y-3">
                <h3 className="font-display text-base font-bold text-white">
                  📄 Upload Official Syllabus PDF
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={sylForm.exam}
                    onChange={(e) => setSylForm({ ...sylForm, exam: e.target.value })}
                    className="rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white"
                  >
                    {data.exams.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
                  <input
                    value={sylForm.title}
                    onChange={(e) => setSylForm({ ...sylForm, title: e.target.value })}
                    placeholder="Enter syllabus title"
                    className="rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white"
                  />
                </div>
                <input
                  value={sylForm.summary}
                  onChange={(e) => setSylForm({ ...sylForm, summary: e.target.value })}
                  placeholder="Enter syllabus summary"
                  className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white"
                />
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => {
                      if (typeof r.result === 'string') {
                        setSylForm({ ...sylForm, fileName: f.name, pdfUrl: r.result });
                      }
                    };
                    r.readAsDataURL(f);
                  }}
                  className="text-xs text-[#a09eb5]"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!sylForm.title.trim()) return;
                    await apiFetch('/api/admin/syllabus', {
                      method: 'POST',
                      body: JSON.stringify(sylForm),
                    });
                    setSylForm({ ...sylForm, title: '', summary: '', fileName: '', pdfUrl: '' });
                    onRefreshData();
                    onToast('Syllabus uploaded!');
                  }}
                  className="btn-press rounded-xl bg-[#4f46e5] px-5 py-2.5 text-xs font-bold text-white cursor-pointer"
                >
                  Save Syllabus
                </button>
              </div>

              <div className="space-y-3">
                {data.syllabi.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-[#2e2d3a] bg-[#25242f] p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs text-[#a8a4ff] font-semibold">{s.exam}</div>
                      <div className="font-bold text-sm text-white">{s.title}</div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/syllabus/${s.id}`, { method: 'DELETE' });
                        onRefreshData();
                      }}
                      className="text-xs text-rose-400 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB: SUPPORT & REPORTS ================= */}
          {tab === 'support' && (
            <div className="space-y-5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSupTab('tickets')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer ${
                    supTab === 'tickets' ? 'bg-[#4f46e5] text-white' : 'bg-[#25242f] text-[#a09eb5]'
                  }`}
                >
                  Student Support / Payment Issues ({pendingTicketsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSupTab('reports')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer ${
                    supTab === 'reports' ? 'bg-[#4f46e5] text-white' : 'bg-[#25242f] text-[#a09eb5]'
                  }`}
                >
                  Reported Questions ({pendingReportsCount})
                </button>
              </div>

              {supTab === 'tickets' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.supportTickets.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-2xl border border-[#2e2d3a] bg-[#25242f] p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <strong className="text-white">{t.subject}</strong>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            t.status === 'resolved'
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-amber-950 text-amber-300'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#a09eb5]">{t.message}</p>
                      <div className="text-[11px] text-[#a09eb5]">
                        {t.userName} · +91 {t.userPhone}
                        {t.orderId ? ` · Order: ${t.orderId}` : ''}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <a
                          href={`https://wa.me/91${t.userPhone}?text=${encodeURIComponent(
                            `Hi ${t.userName}, regarding your ExamPro ticket (${t.subject}): `
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-press rounded-xl bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          💬 Reply on WhatsApp
                        </a>
                        {t.status === 'pending' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/admin/support/${t.id}/resolve`, {
                                method: 'POST',
                              });
                              onRefreshData();
                              onToast('Ticket resolved!');
                            }}
                            className="btn-press rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                          >
                            ✅ Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.reportedQuestions.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-[#2e2d3a] bg-[#25242f] p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#a8a4ff] font-semibold">{r.testTitle}</span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            r.status === 'resolved'
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-rose-950 text-rose-300'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white">{r.questionText}</div>
                      <div className="text-xs text-rose-300">Reason: {r.reason}</div>
                      <div className="text-[11px] text-[#a09eb5]">
                        Reported by {r.reporterName} · {r.createdAt}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const found = data.tests.find((t) => t.id === r.testId);
                            if (found) openEditTest(found);
                          }}
                          className="btn-press rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                        >
                          ✏️ Edit Question
                        </button>
                        {r.status === 'pending' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/admin/reports/${r.id}/resolve`, {
                                method: 'POST',
                              });
                              onRefreshData();
                              onToast('Report marked resolved!');
                            }}
                            className="btn-press rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                          >
                            ✅ Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB: UNIFIED SETTINGS & PLATFORM TOGGLES ================= */}
          {tab === 'settings' && (
            <div className="max-w-3xl space-y-6">
              {/* Platform Toggles: Maintenance Mode & Flash Notice Marquee */}
              <div className="rounded-2xl border border-[#35327a] bg-[#1b1a22] p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#2e2d3a]">
                  <div>
                    <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-[#a8a4ff]" />
                      <span>Platform Toggles &amp; Flash Notice</span>
                    </h3>
                    <p className="text-xs text-[#a09eb5] mt-0.5">
                      Control Maintenance Mode and live scrolling Flash Announcements in real time across student apps
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('banner')}
                    className="btn-press rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-1.5 text-[11px] font-bold text-[#a8a4ff] hover:border-[#a8a4ff] cursor-pointer"
                  >
                    Manage Promo Banner →
                  </button>
                </div>

                {/* Maintenance Mode Switch */}
                <div className="rounded-xl border border-[#2e2d3a] bg-[#25242f]/70 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Maintenance Mode</span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            maintenanceDraft.enabled
                              ? 'bg-amber-950 text-amber-300'
                              : 'bg-emerald-950 text-emerald-300'
                          }`}
                        >
                          {maintenanceDraft.enabled ? 'ON · Students Blocked' : 'OFF · Live'}
                        </span>
                      </div>
                      <p className="text-xs text-[#a09eb5] mt-0.5">
                        When ON, students see a maintenance screen across app and web views (Admin Console remains accessible)
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={maintenanceDraft.enabled}
                      aria-label="Toggle Maintenance Mode"
                      disabled={savingControls}
                      onClick={async () => {
                        const nextEnabled = !maintenanceDraft.enabled;
                        setMaintenanceDraft((prev) => ({ ...prev, enabled: nextEnabled }));
                        setSavingControls(true);
                        try {
                          await apiFetch('/api/admin/platform-controls', {
                            method: 'PUT',
                            body: JSON.stringify({
                              maintenance_mode: nextEnabled,
                              maintenance_message: maintenanceDraft.message,
                              flash_notice_enabled: flashNoticeDraft.enabled,
                              flash_notice_text: flashNoticeDraft.text,
                            }),
                          });
                          onRefreshData();
                          onToast(
                            nextEnabled
                              ? 'Maintenance Mode turned ON across student views.'
                              : 'Maintenance Mode turned OFF. Student portal is live!'
                          );
                        } catch (err: unknown) {
                          setMaintenanceDraft((prev) => ({ ...prev, enabled: !nextEnabled }));
                          onToast(
                            err instanceof Error ? err.message : 'Failed to toggle Maintenance Mode.'
                          );
                        } finally {
                          setSavingControls(false);
                        }
                      }}
                      className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${
                        maintenanceDraft.enabled
                          ? 'bg-amber-500 border-amber-400'
                          : 'bg-[#1b1a22] border-[#3a3848]'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                          maintenanceDraft.enabled ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">
                      Maintenance Notice Message
                    </label>
                    <textarea
                      rows={2}
                      value={maintenanceDraft.message}
                      onChange={(e) =>
                        setMaintenanceDraft({ ...maintenanceDraft, message: e.target.value })
                      }
                      placeholder="Enter message displayed to students during maintenance"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#1b1a22] p-3 text-xs text-white focus:outline-none focus:border-[#a8a4ff]"
                    />
                  </div>
                </div>

                {/* Flash Notice / Marquee Announcement */}
                <div className="rounded-xl border border-[#2e2d3a] bg-[#25242f]/70 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold text-white">
                          Flash Notice / Marquee Announcement
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            flashNoticeDraft.enabled
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {flashNoticeDraft.enabled ? 'ON · Scrolling' : 'OFF · Hidden'}
                        </span>
                      </div>
                      <p className="text-xs text-[#a09eb5] mt-0.5">
                        Shows a scrolling live notice ticker bar at the top of the Student Dashboard
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={flashNoticeDraft.enabled}
                      aria-label="Toggle Flash Notice Marquee"
                      disabled={savingControls}
                      onClick={async () => {
                        const nextFlash = !flashNoticeDraft.enabled;
                        if (nextFlash && !flashNoticeDraft.text.trim()) {
                          onToast('Enter a flash notice message before turning it ON.');
                          return;
                        }
                        setFlashNoticeDraft((prev) => ({ ...prev, enabled: nextFlash }));
                        setSavingControls(true);
                        try {
                          await apiFetch('/api/admin/platform-controls', {
                            method: 'PUT',
                            body: JSON.stringify({
                              maintenance_mode: maintenanceDraft.enabled,
                              maintenance_message: maintenanceDraft.message,
                              flash_notice_enabled: nextFlash,
                              flash_notice_text: flashNoticeDraft.text,
                            }),
                          });
                          onRefreshData();
                          onToast(
                            nextFlash
                              ? 'Flash Notice ticker turned ON!'
                              : 'Flash Notice ticker turned OFF.'
                          );
                        } catch (err: unknown) {
                          setFlashNoticeDraft((prev) => ({ ...prev, enabled: !nextFlash }));
                          onToast(
                            err instanceof Error ? err.message : 'Failed to toggle Flash Notice.'
                          );
                        } finally {
                          setSavingControls(false);
                        }
                      }}
                      className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${
                        flashNoticeDraft.enabled
                          ? 'bg-emerald-600 border-emerald-500'
                          : 'bg-[#1b1a22] border-[#3a3848]'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                          flashNoticeDraft.enabled ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">
                      Scrolling Announcement Text
                    </label>
                    <input
                      type="text"
                      value={flashNoticeDraft.text}
                      onChange={(e) =>
                        setFlashNoticeDraft({ ...flashNoticeDraft, text: e.target.value })
                      }
                      placeholder="e.g., Sunday Mega Mock registration closes tonight at 11 PM!"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#1b1a22] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#a8a4ff]"
                    />
                  </div>

                  {flashNoticeDraft.enabled && flashNoticeDraft.text.trim() && (
                    <div className="marquee-container overflow-hidden rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 flex items-center gap-2.5">
                      <span className="shrink-0 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-950">
                        Flash
                      </span>
                      <div className="flex-1 overflow-hidden">
                        <div className="animate-flash-marquee text-xs font-semibold text-amber-200 whitespace-nowrap">
                          <span className="pr-12">{flashNoticeDraft.text}</span>
                          <span className="pr-12" aria-hidden="true">
                            {flashNoticeDraft.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={savingControls}
                  onClick={async () => {
                    setSavingControls(true);
                    try {
                      await apiFetch('/api/admin/platform-controls', {
                        method: 'PUT',
                        body: JSON.stringify({
                          maintenance_mode: maintenanceDraft.enabled,
                          maintenance_message: maintenanceDraft.message,
                          flash_notice_enabled: flashNoticeDraft.enabled,
                          flash_notice_text: flashNoticeDraft.text,
                        }),
                      });
                      onRefreshData();
                      onToast('Maintenance & Flash Notice settings saved!');
                    } catch (err: unknown) {
                      onToast(
                        err instanceof Error ? err.message : 'Failed to save platform controls.'
                      );
                    } finally {
                      setSavingControls(false);
                    }
                  }}
                  className="btn-press inline-flex items-center gap-2 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] px-5 py-2.5 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingControls ? 'Saving...' : 'Save Toggles & Flash Notice'}</span>
                </button>
              </div>

              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 space-y-4">
                <h3 className="font-display text-base font-bold text-white">
                  🔗 Social Share Bar &amp; Invite Message
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Share Message</label>
                    <input
                      value={settingsDraft.shareMessage}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, shareMessage: e.target.value })
                      }
                      placeholder="Enter share message"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">App Link</label>
                    <input
                      value={settingsDraft.shareAppUrl}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, shareAppUrl: e.target.value })
                      }
                      placeholder="Enter official ExamPro app URL"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {(
                    [
                      ['wa', 'WhatsApp'],
                      ['fb', 'Facebook'],
                      ['ig', 'Instagram'],
                      ['yt', 'YouTube'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-24 text-xs font-semibold text-white">{label}</span>
                      <input
                        value={settingsDraft.social[key].url}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            social: {
                              ...settingsDraft.social,
                              [key]: { ...settingsDraft.social[key], url: e.target.value },
                            },
                          })
                        }
                        placeholder={`Enter ${label} URL`}
                        className="flex-1 rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSettingsDraft({
                            ...settingsDraft,
                            social: {
                              ...settingsDraft.social,
                              [key]: {
                                ...settingsDraft.social[key],
                                on: !settingsDraft.social[key].on,
                              },
                            },
                          })
                        }
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                          settingsDraft.social[key].on
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {settingsDraft.social[key].on ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-semibold text-white">Copy Link Icon</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSettingsDraft({
                          ...settingsDraft,
                          social: {
                            ...settingsDraft.social,
                            cp: { on: !settingsDraft.social.cp.on },
                          },
                        })
                      }
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                        settingsDraft.social.cp.on
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {settingsDraft.social.cp.on ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#2e2d3a] bg-[#1b1a22] p-5 space-y-4">
                <h3 className="font-display text-base font-bold text-white">
                  🛡️ Admin Credentials &amp; WhatsApp Support
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Admin Email</label>
                    <input
                      value={settingsDraft.adminEmail}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, adminEmail: e.target.value })
                      }
                      placeholder="Enter admin email"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Admin Phone</label>
                    <input
                      value={settingsDraft.adminPhone}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, adminPhone: e.target.value })
                      }
                      placeholder="Enter admin mobile number"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">
                      WhatsApp Support Number (with 91)
                    </label>
                    <input
                      value={settingsDraft.whatsappSupportNumber}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          whatsappSupportNumber: e.target.value,
                        })
                      }
                      placeholder="Enter WhatsApp support number"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">
                      WhatsApp Default Message
                    </label>
                    <input
                      value={settingsDraft.whatsappSupportMessage}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          whatsappSupportMessage: e.target.value,
                        })
                      }
                      placeholder="Enter default WhatsApp message"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch('/api/admin/settings', {
                      method: 'PUT',
                      body: JSON.stringify(settingsDraft),
                    });
                    onRefreshData();
                    onToast('All settings saved & synced!');
                  }}
                  className="btn-press inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Settings</span>
                </button>

                <div className="pt-4 border-t border-[#2e2d3a] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-indigo-400" />
                      <h4 className="font-display text-sm font-bold text-white">
                        Update Admin Password
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdminPws((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#3a3848] bg-[#25242f] px-2.5 py-1 text-[11px] font-semibold text-[#c8c6da] hover:text-white cursor-pointer"
                    >
                      {showAdminPws ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showAdminPws ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#a09eb5]">
                    Verify your current admin password to set a new hashed credential (minimum 6 characters).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Current Password</label>
                      <input
                        type={showAdminPws ? 'text' : 'password'}
                        value={adminCurrentPw}
                        onChange={(e) => {
                          setAdminCurrentPw(e.target.value);
                          setAdminPwMsg(null);
                        }}
                        placeholder="Current password"
                        autoComplete="current-password"
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">New Password</label>
                      <input
                        type={showAdminPws ? 'text' : 'password'}
                        value={adminNewPw}
                        onChange={(e) => {
                          setAdminNewPw(e.target.value);
                          setAdminPwMsg(null);
                        }}
                        placeholder="New password (min 6 chars)"
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#a09eb5] mb-1">Confirm New Password</label>
                      <input
                        type={showAdminPws ? 'text' : 'password'}
                        value={adminConfirmPw}
                        onChange={(e) => {
                          setAdminConfirmPw(e.target.value);
                          setAdminPwMsg(null);
                        }}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>
                  {adminPwMsg && (
                    <p
                      className={`text-xs font-semibold ${
                        adminPwMsg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {adminPwMsg.text}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={savingAdminPw}
                    onClick={async () => {
                      setAdminPwMsg(null);
                      if (!adminCurrentPw) {
                        setAdminPwMsg({ type: 'err', text: 'Enter your current password.' });
                        return;
                      }
                      if (adminNewPw.length < 6) {
                        setAdminPwMsg({ type: 'err', text: 'New password must be at least 6 characters.' });
                        return;
                      }
                      if (adminNewPw !== adminConfirmPw) {
                        setAdminPwMsg({ type: 'err', text: 'New password and confirmation do not match.' });
                        return;
                      }
                      setSavingAdminPw(true);
                      try {
                        const res = await apiFetch<{ ok: boolean; message?: string }>('/api/admin/password', {
                          method: 'PUT',
                          body: JSON.stringify({
                            currentPassword: adminCurrentPw,
                            newPassword: adminNewPw,
                            confirmPassword: adminConfirmPw,
                          }),
                        });
                        setAdminCurrentPw('');
                        setAdminNewPw('');
                        setAdminConfirmPw('');
                        setAdminPwMsg({
                          type: 'ok',
                          text: res.message || 'Admin password updated securely.',
                        });
                        onToast('Admin password updated!');
                      } catch (err: unknown) {
                        setAdminPwMsg({
                          type: 'err',
                          text: err instanceof Error ? err.message : 'Failed to update admin password.',
                        });
                      } finally {
                        setSavingAdminPw(false);
                      }
                    }}
                    className="btn-press inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{savingAdminPw ? 'Updating Password...' : 'Update Password'}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Razorpay Configuration */}
              <div className="rounded-2xl border border-[#35327a] bg-[#1b1a22] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-white">
                      💳 Razorpay Configuration (Payment Settings)
                    </h3>
                    <p className="text-xs text-[#a09eb5] mt-0.5">
                      Stored dynamically in database settings (falls back to .env credentials when blank)
                    </p>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                      data.settings.razorpay?.keyId
                        ? 'bg-emerald-950 text-emerald-300'
                        : 'bg-indigo-950 text-indigo-300'
                    }`}
                  >
                    {data.settings.razorpay?.keyId ? 'Database Override Active' : 'Using .env Fallback'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Razorpay Key ID</label>
                    <input
                      type="text"
                      value={razorpayDraft.keyId}
                      onChange={(e) =>
                        setRazorpayDraft({ ...razorpayDraft, keyId: e.target.value })
                      }
                      placeholder="Enter Razorpay Key ID"
                      className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#4f46e5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">Razorpay Secret Key</label>
                    <div className="relative">
                      <input
                        type={showRazorpaySecret ? 'text' : 'password'}
                        value={razorpayDraft.keySecret}
                        onChange={(e) =>
                          setRazorpayDraft({ ...razorpayDraft, keySecret: e.target.value })
                        }
                        placeholder="Enter Razorpay Secret Key"
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] pl-3 pr-10 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#4f46e5]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRazorpaySecret((v) => !v)}
                        aria-label={showRazorpaySecret ? 'Hide secret key' : 'Show secret key'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a09eb5] hover:text-white cursor-pointer"
                      >
                        {showRazorpaySecret ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={savingRazorpay}
                    onClick={async () => {
                      setSavingRazorpay(true);
                      try {
                        await apiFetch('/api/admin/razorpay-settings', {
                          method: 'PUT',
                          body: JSON.stringify({
                            razorpay_key: razorpayDraft.keyId.trim(),
                            razorpay_secret: razorpayDraft.keySecret.trim(),
                          }),
                        });
                        onRefreshData();
                        onToast('Razorpay gateway keys updated in database!');
                      } catch (err: unknown) {
                        onToast(
                          err instanceof Error ? err.message : 'Could not save Razorpay settings.'
                        );
                      } finally {
                        setSavingRazorpay(false);
                      }
                    }}
                    className="btn-press inline-flex items-center gap-2 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] px-5 py-2.5 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{savingRazorpay ? 'Saving...' : 'Save Settings'}</span>
                  </button>

                  {data.settings.razorpay?.keyId && (
                    <button
                      type="button"
                      disabled={savingRazorpay}
                      onClick={async () => {
                        setSavingRazorpay(true);
                        try {
                          await apiFetch('/api/admin/razorpay-settings', {
                            method: 'PUT',
                            body: JSON.stringify({ razorpay_key: '', razorpay_secret: '' }),
                          });
                          setRazorpayDraft({ keyId: '', keySecret: '' });
                          onRefreshData();
                          onToast('Cleared custom keys. Reverted to .env fallback.');
                        } finally {
                          setSavingRazorpay(false);
                        }
                      }}
                      className="rounded-xl border border-[#3a3848] px-4 py-2.5 text-xs font-semibold text-[#a09eb5] hover:text-white cursor-pointer"
                    >
                      Revert to .env Fallback
                    </button>
                  )}
                </div>
              </div>

              {/* Production Readiness & One-Time Demo Data Cleanup */}
              <div className="rounded-2xl border border-rose-900/60 bg-[#1b1a22] p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>Clear Demo Data (Prepare for Production)</span>
                    </h3>
                    <p className="text-xs text-[#a09eb5] mt-1 leading-relaxed">
                      Safely deletes all seeded student accounts, demo mock tests, questions, categories, notices, banners, and test attempts while preserving <strong className="text-white">{data.settings.adminEmail}</strong> and all platform settings.
                    </p>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-[#c8c6da]">
                    {(data.students || []).length} Students · {data.tests.length} Tests · {data.exams.length} Categories · {(data.announcements || []).length} Notices
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <div>
                    <label className="block text-xs text-[#a09eb5] mb-1">
                      Confirm Admin Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCleanupPw ? 'text' : 'password'}
                        value={cleanupPassword}
                        onChange={(e) => {
                          setCleanupPassword(e.target.value);
                          setCleanupMsg(null);
                        }}
                        placeholder="Enter admin password to authorize cleanup"
                        autoComplete="current-password"
                        className="w-full rounded-xl border border-[#3a3848] bg-[#25242f] pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCleanupPw((v) => !v)}
                        aria-label={showCleanupPw ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a09eb5] hover:text-white cursor-pointer"
                      >
                        {showCleanupPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={cleaningDemoData}
                    onClick={async () => {
                      setCleanupMsg(null);
                      if (!cleanupPassword) {
                        setCleanupMsg({
                          type: 'err',
                          text: 'Please enter your current admin password to confirm cleanup.',
                        });
                        return;
                      }
                      setCleaningDemoData(true);
                      try {
                        const res = await apiFetch<{
                          ok: boolean;
                          message: string;
                          deletedCounts?: {
                            students: number;
                            tests: number;
                            categories: number;
                            results: number;
                            announcements: number;
                          };
                        }>('/api/admin/clean-demo-data', {
                          method: 'POST',
                          body: JSON.stringify({ password: cleanupPassword }),
                        });
                        setCleanupPassword('');
                        setPromoBannerDraft({
                          is_banner_active: false,
                          title: '',
                          subtitle: '',
                          ctaLabel: '',
                          imageUrl: '',
                          targetScreen: 'none',
                          targetUrl: '',
                        });
                        setFlashNoticeDraft({ enabled: false, text: '' });
                        const c = res.deletedCounts;
                        const detail = c
                          ? `Removed ${c.students} students, ${c.tests} tests, ${c.categories} categories, ${c.announcements} notices, and ${c.results} results.`
                          : res.message;
                        setCleanupMsg({ type: 'ok', text: `${res.message} ${detail}` });
                        onRefreshData();
                        onToast('Demo data cleared safely!');
                      } catch (err: unknown) {
                        setCleanupMsg({
                          type: 'err',
                          text: err instanceof Error ? err.message : 'Demo data cleanup failed.',
                        });
                      } finally {
                        setCleaningDemoData(false);
                      }
                    }}
                    className="btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 px-5 py-2.5 text-sm font-bold text-white cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{cleaningDemoData ? 'Clearing Demo Data...' : 'Clear Demo Data'}</span>
                  </button>
                </div>

                {cleanupMsg && (
                  <p
                    className={`text-xs font-semibold ${
                      cleanupMsg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {cleanupMsg.text}
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <BackToTopButton variant="admin" />
    </div>
  );
};
