import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  CalendarCheck,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  Package,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import type {
  AppBootstrapData,
  AttemptSummary,
  MockTest,
  PaymentOrder,
  TestBundle,
  TestResultEntry,
  UserProfile,
} from '../types';
import {
  DEFAULT_CATEGORIES,
  JK_DISTRICTS,
  getNextMonthEndRefreshDate,
  getPreviousExams,
} from '../types';
import { apiFetch } from '../lib/api';
import { BackToTopButton } from './BackToTopButton';
import { Footer } from './Footer';
import { InfoPagesModal, type InfoPageKey } from './InfoPagesModal';
import { SocialShareBar } from './SocialShareBar';
import { CheckoutModal } from './CheckoutModal';
import { BundleDetailView } from './BundleDetailView';
import { MockTestEngine } from './MockTestEngine';
import { ResultView } from './ResultView';
import { TopperPosterModal } from './TopperPosterModal';

interface Props {
  data: AppBootstrapData;
  user: UserProfile | null;
  dark: boolean;
  kickedAlert: boolean;
  onToggleTheme: () => void;
  onDismissKicked: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  onUserUpdate: (user: UserProfile) => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onToast: (msg: string) => void;
  onRefreshData: () => void;
}

type StudentSubView =
  | 'home'
  | 'courses'
  | 'bundles'
  | 'upgrade'
  | 'assignments'
  | 'attendance'
  | 'timetable'
  | 'results'
  | 'settings'
  | 'notifications'
  | 'profile'
  | 'payments'
  | 'mistakes'
  | 'districtRank'
  | 'attempts'
  | 'bookmarks'
  | 'syllabus'
  | 'support';

interface ChecklistItem {
  id: string;
  title: string;
  course: string;
  due: string;
  done: boolean;
}

const LABELS = ['A', 'B', 'C', 'D'];

export const StudentPortal: React.FC<Props> = ({
  data,
  user,
  dark,
  kickedAlert,
  onToggleTheme,
  onDismissKicked,
  onLoginSuccess,
  onUserUpdate,
  onLogout,
  onOpenAdmin,
  onToast,
  onRefreshData,
}) => {
  // Auth & Profile Completion state
  const [authMode, setAuthMode] = useState<'in' | 'up'>('in');
  const [authEmail, setAuthEmail] = useState('');
  const [authPw, setAuthPw] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');

  // Gmail OTP Login state
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpErr, setOtpErr] = useState('');
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [otpExpirySec, setOtpExpirySec] = useState(300);
  const [otpSmtpConfigured, setOtpSmtpConfigured] = useState(true);
  const [otpPreviewCode, setOtpPreviewCode] = useState('');

  const [pendingProfile, setPendingProfile] = useState<{
    email: string;
    name: string;
    phone: string;
    district: string;
    exam: string;
    password?: string;
    isEdit?: boolean;
  } | null>(null);
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Navigation, Search & Modals
  const [subView, setSubView] = useState<StudentSubView>('home');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<number | null>(null);
  const [examFilter, setExamFilter] = useState<string>('');
  const [selectedTopperDistrict, setSelectedTopperDistrict] = useState<string>('All Districts');
  const [infoPage, setInfoPage] = useState<InfoPageKey | null>(null);
  const [activeBundle, setActiveBundle] = useState<TestBundle | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<{
    type: 'test' | 'bundle';
    id: number;
    title: string;
    price: number;
  } | null>(null);
  const [activeTestSession, setActiveTestSession] = useState<{
    test: MockTest;
    previewOnly: boolean;
  } | null>(null);
  const [resultSession, setResultSession] = useState<{
    test: MockTest;
    result: TestResultEntry;
    summary: AttemptSummary;
    answers: Record<number, number>;
  } | null>(null);
  const [showTopperPoster, setShowTopperPoster] = useState(false);

  // Mistake re-practice state
  const [repracticeAnswers, setRepracticeAnswers] = useState<Record<string, number>>({});

  // Support ticket form
  const [ticketOrderId, setTicketOrderId] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMsg, setTicketMsg] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // Student Upcoming Assignments Checklist (persisted per user in localStorage)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newTaskText, setNewTaskText] = useState('');

  useEffect(() => {
    if (!user) return;
    const key = `exampro_checklist_v1_${user.id}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        setChecklist(JSON.parse(saved) as ChecklistItem[]);
        return;
      }
    } catch {
      // ignore storage errors
    }
    const defaultTasks: ChecklistItem[] = [
      {
        id: 'task-1',
        title: `Complete ${user.exam.split(',')[0] || 'JKSSB'} Full-Length Mock Test`,
        course: user.exam.split(',')[0] || 'Core Series',
        due: 'Today, 8:00 PM',
        done: user.attempts.length > 0,
      },
      {
        id: 'task-2',
        title: 'Revise J&K Geography & Reorganisation Act Notes',
        course: 'J&K General Knowledge',
        due: 'Tomorrow',
        done: false,
      },
      {
        id: 'task-3',
        title: 'Solve 15 Quantitative & Reasoning PYQ Sets',
        course: 'Math & Reasoning',
        due: 'In 2 days',
        done: false,
      },
      {
        id: 'task-4',
        title: 'Download & review latest official Exam Syllabus PDF',
        course: 'Exam Preparation',
        due: 'This week',
        done: false,
      },
    ];
    setChecklist(defaultTasks);
  }, [user?.id]);

  const updateChecklist = (next: ChecklistItem[]) => {
    setChecklist(next);
    if (!user) return;
    try {
      localStorage.setItem(`exampro_checklist_v1_${user.id}`, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const toggleChecklistItem = (id: string) => {
    updateChecklist(checklist.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const addChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTaskText.trim();
    if (!title) return;
    const item: ChecklistItem = {
      id: `task-${Date.now()}`,
      title,
      course: user?.exam.split(',')[0] || 'Self Study',
      due: 'Upcoming',
      done: false,
    };
    updateChecklist([item, ...checklist]);
    setNewTaskText('');
  };

  const removeChecklistItem = (id: string) => {
    updateChecklist(checklist.filter((item) => item.id !== id));
  };

  // Computed District Toppers (100% auto-calculated from test results)
  const districtToppers = useMemo(() => {
    const map = new Map<
      string,
      { district: string; name: string; score: number; maxScore: number; targetExam: string; testTitle: string }
    >();
    data.results.forEach((r) => {
      const prev = map.get(r.district);
      if (!prev || r.score > prev.score) {
        const t = data.tests.find((x) => x.id === r.testId);
        map.set(r.district, {
          district: r.district,
          name: r.name,
          score: r.score,
          maxScore: r.maxScore,
          targetExam: r.targetExam,
          testTitle: t?.title || 'Mock Test',
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }, [data.results, data.tests]);

  // Student's district leaderboard (cumulative across results)
  const myDistrictBoard = useMemo(() => {
    if (!user) return [];
    const byStudent = new Map<number, { userId: number; name: string; totalScore: number; exam: string }>();
    data.results
      .filter((r) => r.district === user.district)
      .forEach((r) => {
        const existing = byStudent.get(r.userId);
        if (existing) existing.totalScore += r.score;
        else
          byStudent.set(r.userId, {
            userId: r.userId,
            name: r.name,
            totalScore: r.score,
            exam: r.targetExam,
          });
      });
    return Array.from(byStudent.values()).sort((a, b) => b.totalScore - a.totalScore);
  }, [data.results, user]);

  const myDistrictRank = useMemo(() => {
    if (!user) return null;
    const idx = myDistrictBoard.findIndex((x) => x.userId === user.id);
    return idx >= 0 ? idx + 1 : null;
  }, [myDistrictBoard, user]);

  const isPaidUser = useMemo(() => {
    if (!user) return false;
    return user.ownedTestIds.length > 0 || user.ownedBundleIds.length > 0;
  }, [user]);

  const myPayments = useMemo(() => {
    if (!user) return [];
    return data.payments.filter((p) => p.userId === user.id);
  }, [data.payments, user]);

  // Dashboard Metrics computed dynamically from real student data
  const dashboardStats = useMemo(() => {
    if (!user) {
      return {
        attendancePct: 0,
        gradeLabel: '—',
        gpaValue: '0.0',
        avgPct: 0,
        pendingTasksCount: 0,
        upcomingCount: 0,
      };
    }
    const attempts = user.attempts.length;
    const attendancePct = Math.min(99, Math.max(76, 76 + attempts * 4));

    let avgPct = 0;
    if (attempts > 0) {
      const sum = user.attempts.reduce((acc, a) => {
        const pct = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
        return acc + pct;
      }, 0);
      avgPct = Math.round(sum / attempts);
    }
    const gpaNum = attempts > 0 ? Math.min(10, Math.max(5.5, Number((avgPct / 10).toFixed(1)))) : 8.5;
    const gradeLabel =
      attempts === 0
        ? 'Ready'
        : avgPct >= 90
        ? 'A+'
        : avgPct >= 80
        ? 'A'
        : avgPct >= 70
        ? 'B+'
        : avgPct >= 60
        ? 'B'
        : 'C+';

    const openChecklist = checklist.filter((c) => !c.done).length;
    const pendingTasksCount = openChecklist + (user.mistakes.length > 0 ? 1 : 0);

    const scheduledTests = data.tests.filter((t) => t.status === 'scheduled').length;
    const upcomingCount = Math.max(1, scheduledTests);

    return {
      attendancePct,
      gradeLabel,
      gpaValue: gpaNum.toFixed(1),
      avgPct,
      pendingTasksCount,
      upcomingCount,
    };
  }, [user, checklist, data.tests]);

  // Course syllabus progress derived from bundles + user attempts
  const courseProgressList = useMemo(() => {
    const attemptedTestIds = new Set((user?.attempts || []).map((a) => a.testId));
    const list = data.bundles.map((bundle, idx) => {
      const total = Math.max(1, bundle.testIds.length);
      const completed = bundle.testIds.filter((tid) => attemptedTestIds.has(tid)).length;
      const owned =
        (user?.ownedBundleIds.includes(bundle.id) ?? false) ||
        myPayments.some((p) => p.status === 'PAID' && p.itemType === 'bundle' && p.itemId === bundle.id);
      const basePct = Math.round((completed / total) * 100);
      const progress = basePct > 0 ? basePct : owned ? 28 + idx * 12 : Math.min(40, (user?.attempts.length || 0) * 15);
      return {
        id: bundle.id,
        title: bundle.title,
        exam: bundle.exam,
        completedTests: completed,
        totalTests: bundle.testIds.length,
        progress: Math.min(100, progress),
        owned,
        bundle,
      };
    });
    return list;
  }, [data.bundles, myPayments, user]);

  // Helper to check if a single test is purchased/unlocked (direct purchase, bundle ownership, or PAID order)
  const ownedBundleIdSet = useMemo(() => {
    const ids = new Set<number>(user?.ownedBundleIds || []);
    myPayments.forEach((p) => {
      if (p.status === 'PAID' && p.itemType === 'bundle') ids.add(p.itemId);
    });
    return ids;
  }, [myPayments, user]);

  const ownedTestIdSet = useMemo(() => {
    const ids = new Set<number>(user?.ownedTestIds || []);
    myPayments.forEach((p) => {
      if (p.status === 'PAID' && p.itemType === 'test') ids.add(p.itemId);
    });
    data.bundles.forEach((b) => {
      if (ownedBundleIdSet.has(b.id)) {
        b.testIds.forEach((tid) => ids.add(tid));
      }
    });
    return ids;
  }, [data.bundles, myPayments, ownedBundleIdSet, user]);

  // Upgrade Store strictly excludes courses/bundles and tests already purchased/paid by the student
  const unpurchasedPaidBundles = useMemo(
    () =>
      data.bundles.filter(
        (b) => b.price > 0 && !ownedBundleIdSet.has(b.id)
      ),
    [data.bundles, ownedBundleIdSet]
  );

  const unpurchasedPaidTests = useMemo(
    () =>
      data.tests.filter(
        (t) =>
          t.paid &&
          t.price > 0 &&
          t.status !== 'draft' &&
          !ownedTestIdSet.has(t.id) &&
          !(t.bundleId != null && ownedBundleIdSet.has(t.bundleId))
      ),
    [data.tests, ownedBundleIdSet, ownedTestIdSet]
  );

  const hasUpgradeItems = unpurchasedPaidBundles.length > 0 || unpurchasedPaidTests.length > 0;

  // Purchased & Active Tests for one-tap Start / Resume on Student Dashboard
  const myPurchasedTests = useMemo(
    () =>
      data.tests.filter(
        (t) =>
          t.status !== 'draft' &&
          t.paid &&
          (ownedTestIdSet.has(t.id) || (t.bundleId != null && ownedBundleIdSet.has(t.bundleId)))
      ),
    [data.tests, ownedBundleIdSet, ownedTestIdSet]
  );

  const myEnrolledCoursesCount = useMemo(
    () => courseProgressList.filter((c) => c.owned).length,
    [courseProgressList]
  );

  const attemptByTestId = useMemo(() => {
    const map = new Map<number, AttemptSummary>();
    (user?.attempts || []).forEach((a) => {
      if (!map.has(a.testId)) map.set(a.testId, a);
    });
    return map;
  }, [user?.attempts]);

  const exploreExamCategories = useMemo(() => {
    const liveTests = data.tests.filter((t) => t.status !== 'draft');
    const defs = [
      { id: '', label: 'All Exams', desc: 'Complete mock catalog', icon: '📚' },
      { id: 'JKSSB', label: 'JKSSB', desc: 'Junior Asst, NT, FAA & Constable', icon: '🏛️' },
      { id: 'JKBOSE', label: 'JKBOSE', desc: 'Board & foundation mocks', icon: '📘' },
      { id: 'JKPSC', label: 'JKPSC', desc: 'KAS & gazetted prelims', icon: '⚖️' },
      { id: 'JKP', label: 'JKP', desc: 'Sub-Inspector & Police exams', icon: '🛡️' },
      { id: 'FREE', label: 'Free Mocks', desc: 'Instant open practice tests', icon: '🎁' },
    ];
    return defs.map((cat) => {
      const count =
        cat.id === ''
          ? liveTests.length
          : cat.id === 'FREE'
          ? liveTests.filter((t) => !t.paid).length
          : liveTests.filter(
              (t) =>
                t.exam.toLowerCase().includes(cat.id.toLowerCase()) ||
                t.title.toLowerCase().includes(cat.id.toLowerCase())
            ).length;
      return { ...cat, count };
    });
  }, [data.tests]);

  // Today's Schedule built from live/scheduled mock tests and Mistake Notebook revision
  const todaysSchedule = useMemo(() => {
    const liveTests = data.tests.filter((t) => t.status === 'live');
    const scheduledTests = data.tests.filter((t) => t.status === 'scheduled');
    const firstLive = liveTests[0];
    const secondLive = liveTests[1];
    const nextScheduled = scheduledTests[0];

    return [
      {
        id: 'sch-2',
        time: '11:30 AM – 01:00 PM',
        title: firstLive ? firstLive.title : 'JKSSB Full-Length CBT Mock Session',
        subtitle: firstLive
          ? `${firstLive.exam} · ${firstLive.dur} mins · ${firstLive.qs.length} Qs`
          : 'Core Subject Mock Test',
        status: 'Live Now' as const,
        actionLabel: 'Start Mock',
        onAction: () => {
          if (!firstLive) return;
          const unlocked = !firstLive.paid || user?.ownedTestIds.includes(firstLive.id);
          if (unlocked) setActiveTestSession({ test: firstLive, previewOnly: false });
          else
            setCheckoutItem({
              type: 'test',
              id: firstLive.id,
              title: firstLive.title,
              price: firstLive.price,
            });
        },
      },
      {
        id: 'sch-3',
        time: '04:00 PM – 04:45 PM',
        title: `Mistake Notebook Revision (${user?.mistakes.length || 0} Pending)`,
        subtitle: 'Auto-curated weak questions & detailed explanations',
        status: (user?.mistakes.length || 0) === 0 ? ('Completed' as const) : ('Upcoming' as const),
        actionLabel: 'Review',
        onAction: () => setSubView('mistakes'),
      },
      {
        id: 'sch-4',
        time: '07:30 PM – 08:30 PM',
        title: nextScheduled
          ? nextScheduled.title
          : secondLive
          ? secondLive.title
          : 'Evening Sectional Speed Drill',
        subtitle: nextScheduled
          ? `${nextScheduled.exam} · Scheduled ${new Date(nextScheduled.sched).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}`
          : secondLive
          ? `${secondLive.exam} · ${secondLive.dur} mins`
          : 'Timed sectional practice',
        status: 'Upcoming' as const,
        actionLabel: 'View Timetable',
        onAction: () => setSubView('timetable'),
      },
    ];
  }, [data.tests, user]);

  // Automatic Month-End 11:55 PM Result Menu Refresh Scheduler
  useEffect(() => {
    let timerId: number | undefined;
    const scheduleNext = () => {
      const next = getNextMonthEndRefreshDate(new Date());
      const remaining = next.getTime() - Date.now();
      // Cap single setTimeout under 2^31-1 ms (~24.8 days) and re-arm accurately
      const delay = Math.min(Math.max(1000, remaining + 1000), 2_000_000_000);
      timerId = window.setTimeout(() => {
        if (Date.now() >= next.getTime()) {
          onRefreshData();
          onToast('Result Menu automatically refreshed for the new monthly cycle!');
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [onRefreshData, onToast]);

  const nextResultRefreshLabel = useMemo(() => {
    if (data.resultCycle?.nextRefreshLabel) return data.resultCycle.nextRefreshLabel;
    return getNextMonthEndRefreshDate(new Date()).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [data.resultCycle?.nextRefreshLabel]);

  useEffect(() => {
    if (!otpModalOpen) return;
    const interval = window.setInterval(() => {
      setOtpResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setOtpExpirySec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [otpModalOpen]);

  // Auth Handlers
  const handleSendGmailOtp = async (overrideEmail?: string) => {
    const email = (overrideEmail ?? otpEmail).trim().toLowerCase();
    setAuthErr('');
    setOtpErr('');
    if (!/^[a-z0-9._%+-]+@gmail\.com$/i.test(email)) {
      const msg = 'Please enter a valid @gmail.com address.';
      if (otpModalOpen) setOtpErr(msg);
      else setAuthErr(msg);
      return;
    }
    setOtpSending(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        message: string;
        expiresInSeconds?: number;
        smtpConfigured?: boolean;
        previewOtp?: string;
      }>('/api/v1/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setOtpEmail(email);
      setOtpCode('');
      setOtpErr('');
      setOtpResendCooldown(45);
      setOtpExpirySec(res.expiresInSeconds || 300);
      setOtpSmtpConfigured(res.smtpConfigured !== false);
      setOtpPreviewCode(res.previewOtp || '');
      setOtpModalOpen(true);
      onToast(
        res.smtpConfigured !== false
          ? `6-digit OTP sent to ${email}`
          : `6-digit OTP ready for ${email}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to send OTP right now.';
      if (otpModalOpen) setOtpErr(msg);
      else setAuthErr(msg);
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyGmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOtp = otpCode.replace(/\D/g, '').trim();
    if (!/^\d{6}$/.test(cleanedOtp)) {
      setOtpErr('Please enter the 6-digit OTP code.');
      return;
    }
    setOtpErr('');
    setOtpVerifying(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        otpVerified: boolean;
        needsProfile: boolean;
        user?: UserProfile;
        email?: string;
        name?: string;
      }>('/api/v1/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: otpEmail.trim().toLowerCase(), otp: cleanedOtp }),
      });
      setOtpModalOpen(false);
      setOtpCode('');
      setOtpPreviewCode('');
      if (!res.needsProfile && res.user) {
        setSubView('home');
        onLoginSuccess(res.user);
        onToast(`Welcome back, ${res.user.name.split(' ')[0]}!`);
      } else {
        setPendingProfile({
          email: res.email || otpEmail.trim().toLowerCase(),
          name: res.name || '',
          phone: '',
          district: '',
          exam: '',
        });
        setProfileErr('');
      }
    } catch (err: unknown) {
      setOtpErr(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleGoogleSignIn = async (email: string, name: string) => {
    setShowGoogleModal(false);
    setAuthErr('');
    try {
      const res = await apiFetch<{
        needsProfile: boolean;
        user?: UserProfile;
        email?: string;
        name?: string;
      }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ email, name }),
      });
      if (!res.needsProfile && res.user) {
        onLoginSuccess(res.user);
      } else {
        setPendingProfile({
          email: res.email || email,
          name: res.name || name,
          phone: '',
          district: '',
          exam: '',
        });
        setProfileErr('');
      }
    } catch (err: unknown) {
      setAuthErr(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr('');
    try {
      const res = await apiFetch<{
        needsProfile: boolean;
        user?: UserProfile;
        email?: string;
        name?: string;
        password?: string;
      }>('/api/auth/email', {
        method: 'POST',
        body: JSON.stringify({ mode: authMode, email: authEmail, password: authPw }),
      });
      if (!res.needsProfile && res.user) {
        setAuthPw('');
        onLoginSuccess(res.user);
      } else {
        setPendingProfile({
          email: res.email || authEmail,
          name: res.name || '',
          phone: '',
          district: '',
          exam: '',
          password: res.password || authPw,
        });
        setAuthPw('');
        setProfileErr('');
      }
    } catch (err: unknown) {
      setAuthErr(err instanceof Error ? err.message : 'Authentication failed.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingProfile) return;
    setProfileErr('');
    const phone = pendingProfile.phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setProfileErr('⚠️ Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.');
      return;
    }
    if (pendingProfile.name.trim().length < 2) {
      setProfileErr('Enter your full name.');
      return;
    }
    if (!pendingProfile.district) {
      setProfileErr('Select your district.');
      return;
    }
    if (!pendingProfile.exam.trim()) {
      setProfileErr('Enter your target exam.');
      return;
    }

    setSavingProfile(true);
    try {
      if (pendingProfile.isEdit) {
        const res = await apiFetch<{ user: UserProfile }>('/api/profile', {
          method: 'PUT',
          body: JSON.stringify({ ...pendingProfile, phone }),
        });
        onUserUpdate(res.user);
        setPendingProfile(null);
        onToast('Profile updated!');
      } else {
        const res = await apiFetch<{ user: UserProfile }>('/api/auth/complete-profile', {
          method: 'POST',
          body: JSON.stringify({ ...pendingProfile, phone }),
        });
        setPendingProfile(null);
        onLoginSuccess(res.user);
        onToast(`Welcome to ExamPro, ${res.user.name.split(' ')[0]}!`);
      }
    } catch (err: unknown) {
      setProfileErr(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleMistakeAnswer = async (mistakeId: string, optIdx: number, correctIdx: number) => {
    setRepracticeAnswers((prev) => ({ ...prev, [mistakeId]: optIdx }));
    if (optIdx === correctIdx) {
      try {
        const res = await apiFetch<{ isCorrect: boolean; removed: boolean; user: UserProfile }>(
          '/api/mistakes/practice',
          {
            method: 'POST',
            body: JSON.stringify({ mistakeId, selected: optIdx }),
          }
        );
        if (res.removed) {
          onToast('✔ Solved correctly! Removed from Mistake Notebook.');
          setTimeout(() => {
            onUserUpdate(res.user);
          }, 900);
        }
      } catch {
        // ignore
      }
    }
  };

  const handleSupportTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketMsg.trim()) return;
    setSubmittingTicket(true);
    try {
      await apiFetch('/api/support', {
        method: 'POST',
        body: JSON.stringify({
          orderId: ticketOrderId.trim() || undefined,
          subject: ticketSubject.trim() || 'Student Support Request',
          message: ticketMsg.trim(),
        }),
      });
      setTicketOrderId('');
      setTicketSubject('');
      setTicketMsg('');
      onRefreshData();
      onToast('Support ticket submitted! Admin will reply soon.');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Failed to submit ticket.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleFooterCategoryClick = (keyword: string) => {
    if (!user) {
      onToast('Sign in to explore tests');
      return;
    }
    setActiveBundle(null);
    setResultSession(null);
    setSubView('home');
    setExamFilter(keyword);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateSidebar = (next: StudentSubView) => {
    setSubView(next);
    setMobileSidebarOpen(false);
    setShowNotifDropdown(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ================= MAINTENANCE MODE SCREEN (ALL STUDENT VIEWS) =================
  if (data.settings.maintenance?.enabled) {
    const waSupportHrefMaint = `https://wa.me/${data.settings.whatsappSupportNumber.replace(
      /\D/g,
      ''
    )}?text=${encodeURIComponent(data.settings.whatsappSupportMessage)}`;

    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col justify-between">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <div className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              ExamPro
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-900 p-7 sm:p-8 text-center shadow-xl space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Wrench className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Scheduled Maintenance
            </div>
            <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
              We&apos;ll Be Right Back
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {data.settings.maintenance.message ||
                'ExamPro is currently undergoing scheduled maintenance to improve performance. Please check back shortly.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={onRefreshData}
                className="btn-press flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F46E5] py-2.5 px-4 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Status</span>
              </button>
              <a
                href={waSupportHrefMaint}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-4 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                <span>WhatsApp Support</span>
              </a>
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          ExamPro Portal · Scheduled Maintenance Notice
        </footer>
      </div>
    );
  }

  // ================= VIEW 1: COMPLETE PROFILE (1-STEP) =================
  if (pendingProfile) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col justify-center px-4 py-8">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
              {pendingProfile.isEdit ? 'Edit Profile' : 'Complete Your Profile'}
            </h2>
            {pendingProfile.isEdit && (
              <button
                type="button"
                onClick={() => setPendingProfile(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
            {pendingProfile.isEdit
              ? 'Update your details below. Mobile number must be unique.'
              : 'One quick step before you start. All fields are mandatory.'}
          </p>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Google Email (Locked)
              </label>
              <input
                type="email"
                value={pendingProfile.email}
                disabled
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/70 px-3.5 py-2.5 text-sm text-slate-500 dark:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                10-Digit Mobile / WhatsApp Number *
              </label>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={pendingProfile.phone}
                  onChange={(e) =>
                    setPendingProfile({
                      ...pendingProfile,
                      phone: e.target.value.replace(/\D/g, ''),
                    })
                  }
                  placeholder="Enter 10-digit mobile number"
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={pendingProfile.name}
                onChange={(e) => setPendingProfile({ ...pendingProfile, name: e.target.value })}
                placeholder="Enter full name"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                District (20 J&amp;K Districts) *
              </label>
              <select
                required
                value={pendingProfile.district}
                onChange={(e) => setPendingProfile({ ...pendingProfile, district: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
              >
                <option value="">Select district</option>
                {JK_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Target Exam *
              </label>
              <input
                type="text"
                required
                value={pendingProfile.exam}
                onChange={(e) => setPendingProfile({ ...pendingProfile, exam: e.target.value })}
                placeholder="Enter target exam"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
              />
            </div>

            {profileErr && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {profileErr}
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="btn-press w-full rounded-xl bg-[#4F46E5] py-3 text-sm font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
            >
              {savingProfile
                ? 'Saving...'
                : pendingProfile.isEdit
                ? 'Save Profile Changes'
                : 'Save & Continue to Home'}
            </button>

            {!pendingProfile.isEdit && (
              <button
                type="button"
                onClick={() => setPendingProfile(null)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Use a different account
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ================= VIEW 2: LOGIN SCREEN (PRESERVED INTACT) =================
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col justify-between">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
            <div className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              ExamPro
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="Toggle theme"
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
              <div className="text-center mb-6">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4F46E5] text-2xl text-white shadow-sm">
                  🎓
                </div>
                <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                  Sign in to ExamPro
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Jammu &amp; Kashmir Mock Tests, PYQs &amp; District Ranks
                </p>
              </div>

              {/* 1-Tap Google Sign-In */}
              <button
                type="button"
                onClick={() => setShowGoogleModal(true)}
                className="btn-press w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 px-4 text-sm font-bold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-xs cursor-pointer min-h-[46px]"
              >
                <span className="font-display text-lg font-extrabold text-[#4285F4]">G</span>
                <span>Continue with Google</span>
              </button>

              {/* Real Gmail 6-Digit OTP Sign-In */}
              <div className="mt-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    <Mail className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400" />
                    <span>Sign in with Gmail OTP</span>
                  </span>
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                    No password needed
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={otpEmail}
                    onChange={(e) => {
                      setOtpEmail(e.target.value);
                      setAuthErr('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendGmailOtp();
                      }
                    }}
                    placeholder="yourname@gmail.com"
                    className="flex-1 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                  />
                  <button
                    type="button"
                    disabled={otpSending}
                    onClick={() => handleSendGmailOtp()}
                    className="btn-press shrink-0 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 disabled:opacity-60 px-4 py-2 text-xs font-bold text-white cursor-pointer min-h-[40px]"
                  >
                    {otpSending ? 'Sending...' : 'Send OTP'}
                  </button>
                </div>
              </div>

              <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span>or use email &amp; password</span>
                <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('in');
                    setAuthErr('');
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    authMode === 'in'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('up');
                    setAuthErr('');
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    authMode === 'up'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Create account
                </button>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                />
                <input
                  type="password"
                  required
                  value={authPw}
                  onChange={(e) => setAuthPw(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                />
                {authErr && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{authErr}</p>
                )}
                <button
                  type="submit"
                  className="btn-press w-full rounded-xl bg-[#4F46E5] py-3 text-sm font-bold text-white hover:bg-indigo-700 cursor-pointer min-h-[46px]"
                >
                  {authMode === 'in' ? 'Sign in' : 'Continue'}
                </button>
              </form>
            </div>
          </div>
        </main>

        <Footer
          settings={data.settings}
          onSelectCategoryFilter={handleFooterCategoryClick}
          onOpenPage={setInfoPage}
          onToast={onToast}
        />

        {/* Google 1-Tap Account Chooser */}
        {showGoogleModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
            onClick={() => setShowGoogleModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Choose a Google account
                  </h3>
                  <p className="text-xs text-slate-500">to continue to ExamPro</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="p-1 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { email: 'aarif.mir@gmail.com', name: 'Aarif Mir', tag: 'Returning Student · Budgam' },
                  { email: 'sana.bhat@gmail.com', name: 'Sana Bhat', tag: 'Returning Student · Srinagar' },
                ].map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleGoogleSignIn(acc.email, acc.name)}
                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-sm font-bold text-white">
                      {acc.name[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {acc.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {acc.email} · {acc.tag}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Or sign in with another Google email:
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    placeholder="Enter Google email address"
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!/^\S+@\S+\.\S+$/.test(customGoogleEmail.trim())) return;
                      handleGoogleSignIn(customGoogleEmail.trim(), '');
                    }}
                    className="btn-press rounded-xl bg-[#4F46E5] px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gmail 6-Digit OTP Verification Dialog */}
        {otpModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
            onClick={() => {
              if (!otpVerifying) setOtpModalOpen(false);
            }}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-400">
                    <Mail className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Verify Gmail OTP
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 break-all">
                      Sent to <strong className="text-slate-700 dark:text-slate-200">{otpEmail}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOtpModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Close OTP dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!otpSmtpConfigured && otpPreviewCode && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
                  SMTP mail credentials are not set in `.env` yet. Preview OTP:{' '}
                  <span className="font-mono text-sm font-extrabold tracking-widest">
                    {otpPreviewCode}
                  </span>
                </div>
              )}

              <form onSubmit={handleVerifyGmailOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Enter 6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setOtpErr('');
                    }}
                    placeholder="••••••"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-center font-mono text-2xl font-extrabold tracking-[0.45em] text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {otpExpirySec > 0
                      ? `Expires in ${Math.floor(otpExpirySec / 60)}:${String(otpExpirySec % 60).padStart(2, '0')}`
                      : 'OTP expired'}
                  </span>
                  <button
                    type="button"
                    disabled={otpSending || otpResendCooldown > 0}
                    onClick={() => handleSendGmailOtp(otpEmail)}
                    className="font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                  >
                    {otpSending
                      ? 'Sending...'
                      : otpResendCooldown > 0
                      ? `Resend in ${otpResendCooldown}s`
                      : 'Resend OTP'}
                  </button>
                </div>

                {otpErr && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{otpErr}</p>
                )}

                <button
                  type="submit"
                  disabled={otpVerifying || otpCode.length < 6 || otpExpirySec === 0}
                  className="btn-press w-full rounded-xl bg-[#4F46E5] hover:bg-indigo-700 disabled:opacity-60 py-3 text-sm font-bold text-white cursor-pointer min-h-[46px]"
                >
                  {otpVerifying ? 'Verifying OTP...' : 'Verify OTP & Sign In'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Single-Device Logout Alert */}
        {kickedAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 p-6 text-center shadow-2xl">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                ⚠️ You have been logged out because your account was signed in on another device.
              </p>
              <button
                type="button"
                onClick={onDismissKicked}
                className="btn-press mt-4 w-full rounded-xl bg-[#4F46E5] py-2.5 text-sm font-semibold text-white cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        )}

        <InfoPagesModal page={infoPage} settings={data.settings} onClose={() => setInfoPage(null)} />
      </div>
    );
  }

  // ================= VIEW 3: ACTIVE CBT TEST ENGINE =================
  if (activeTestSession) {
    return (
      <MockTestEngine
        test={activeTestSession.test}
        user={user}
        previewOnly={activeTestSession.previewOnly}
        onExit={() => setActiveTestSession(null)}
        onBookmarkUpdated={onUserUpdate}
        onToast={onToast}
        onSubmitted={({ result, summary, user: updatedUser, answers }) => {
          onUserUpdate(updatedUser);
          onRefreshData();
          setResultSession({
            test: activeTestSession.test,
            result: result as TestResultEntry,
            summary: summary as AttemptSummary,
            answers,
          });
          setActiveTestSession(null);
        }}
      />
    );
  }

  // ================= VIEW 4: RESULT & SOLUTIONS SCREEN =================
  if (resultSession) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950">
        <ResultView
          test={resultSession.test}
          user={user}
          result={resultSession.result}
          summary={resultSession.summary}
          allResults={data.results}
          answers={resultSession.answers}
          onBackHome={() => {
            setResultSession(null);
            setSubView('home');
          }}
          onToast={onToast}
        />
        <BackToTopButton variant="student" />
      </div>
    );
  }

  // ================= VIEW 5: BUNDLE DETAIL SCREEN =================
  if (activeBundle) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950">
        <BundleDetailView
          bundle={activeBundle}
          tests={data.tests}
          user={user}
          onBack={() => setActiveBundle(null)}
          onUnlockBundle={(b) =>
            setCheckoutItem({ type: 'bundle', id: b.id, title: b.title, price: b.price })
          }
          onStartTest={(test, previewOnly) =>
            setActiveTestSession({ test, previewOnly: Boolean(previewOnly) })
          }
        />
        <BackToTopButton variant="student" />
        {checkoutItem && (
          <CheckoutModal
            itemType={checkoutItem.type}
            itemId={checkoutItem.id}
            itemTitle={checkoutItem.title}
            price={checkoutItem.price}
            settings={data.settings}
            onClose={() => setCheckoutItem(null)}
            onToast={onToast}
            onSuccess={(order, updatedUser) => {
              setCheckoutItem(null);
              onUserUpdate(updatedUser as UserProfile);
              onRefreshData();
              onToast(
                order.status === 'PAID'
                  ? 'Payment verified via Razorpay! Unlocked immediately.'
                  : 'Order status updated.'
              );
            }}
          />
        )}
      </div>
    );
  }

  // Helper to render a Mock Test Card (clean white 16px rounded card with soft shadow)
  const renderTestCard = (t: MockTest) => {
    const isUnlocked =
      !t.paid ||
      ownedTestIdSet.has(t.id) ||
      (t.bundleId != null && ownedBundleIdSet.has(t.bundleId));
    const isPendingVerification = data.payments.some(
      (p) => p.userId === user.id && p.itemType === 'test' && p.itemId === t.id && p.status === 'PENDING_VERIFICATION'
    );
    const isScheduled = t.status === 'scheduled';

    return (
      <div
        key={t.id}
        className="card-hover group rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:shadow-none flex flex-col justify-between gap-4 hover:border-indigo-200 dark:hover:border-indigo-700"
      >
        <div>
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="truncate font-semibold text-[#4F46E5] dark:text-indigo-400">
              {t.exam} {t.subject ? `· ${t.subject}` : ''}
            </span>
            <span className="shrink-0 font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
              {!t.paid ? 'Free' : isUnlocked ? 'Unlocked' : `₹${t.price}`}
            </span>
          </div>

          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white leading-snug">
            {t.title}
          </h3>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {t.syllabusTag}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="w-3.5 h-3.5" /> {t.dur}m
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <BookOpen className="w-3.5 h-3.5" /> {t.qs.length} Qs
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Users className="w-3.5 h-3.5" />{' '}
              {t.attemptCount >= 1000 ? `${(t.attemptCount / 1000).toFixed(1)}k` : t.attemptCount}
            </span>
          </div>

          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {t.language} · -{t.neg} Neg ·{' '}
            {t.status === 'live'
              ? 'Live now'
              : new Date(t.sched).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          {isUnlocked ? (
            <button
              type="button"
              disabled={isScheduled || t.qs.length === 0}
              onClick={() => setActiveTestSession({ test: t, previewOnly: false })}
              className="btn-press flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4F46E5] py-2.5 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-45 cursor-pointer min-h-[42px] whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isScheduled ? 'Starts Soon' : 'Start Test'}</span>
            </button>
          ) : isPendingVerification ? (
            <button
              type="button"
              onClick={() => setSubView('payments')}
              className="flex-1 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 py-2.5 px-3 text-xs font-semibold text-amber-800 dark:text-amber-300 cursor-pointer min-h-[42px] whitespace-nowrap"
            >
              Verification Pending
            </button>
          ) : (
            <>
              {t.qs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTestSession({ test: t, previewOnly: true })}
                  className="btn-press rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer min-h-[42px] whitespace-nowrap"
                >
                  Preview
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setCheckoutItem({ type: 'test', id: t.id, title: t.title, price: t.price })
                }
                className="btn-press flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-[#4F46E5] py-2.5 px-3 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-indigo-700 cursor-pointer min-h-[42px] whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Unlock ₹{t.price}</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const waSupportHref = `https://wa.me/${data.settings.whatsappSupportNumber.replace(
    /\D/g,
    ''
  )}?text=${encodeURIComponent(data.settings.whatsappSupportMessage)}`;

  const filteredToppers =
    selectedTopperDistrict === 'All Districts'
      ? districtToppers.slice(0, 6)
      : districtToppers.filter((d) => d.district === selectedTopperDistrict);

  const publicTests = data.tests.filter((t) => {
    if (t.status === 'draft') return false;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matchesQ =
        t.title.toLowerCase().includes(q) ||
        t.exam.toLowerCase().includes(q) ||
        t.syllabusTag.toLowerCase().includes(q) ||
        (t.subject && t.subject.toLowerCase().includes(q));
      if (!matchesQ) return false;
    }
    if (!examFilter) return true;
    if (examFilter === 'FREE') return !t.paid;
    return (
      t.exam.toLowerCase().includes(examFilter.toLowerCase()) ||
      t.title.toLowerCase().includes(examFilter.toLowerCase())
    );
  });

  const sidebarItems: Array<{
    id: StudentSubView;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'home', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { id: 'courses', label: 'My Courses', icon: <BookOpen className="w-[18px] h-[18px]" /> },
    ...(hasUpgradeItems
      ? [
          {
            id: 'upgrade' as StudentSubView,
            label: 'Upgrade',
            icon: <Sparkles className="w-[18px] h-[18px]" />,
            badge: unpurchasedPaidBundles.length + unpurchasedPaidTests.length,
          },
        ]
      : []),
    { id: 'attendance', label: 'Attendance', icon: <CalendarCheck className="w-[18px] h-[18px]" /> },
    { id: 'timetable', label: 'Timetable', icon: <Clock className="w-[18px] h-[18px]" /> },
    { id: 'results', label: 'Results', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-[18px] h-[18px]" /> },
  ];

  const isNavActive = (id: StudentSubView) => {
    if (id === 'courses' && subView === 'bundles') return true;
    if (id === 'results' && (subView === 'attempts' || subView === 'districtRank')) return true;
    if (
      id === 'settings' &&
      ['profile', 'payments', 'bookmarks', 'syllabus', 'support'].includes(subView)
    )
      return true;
    return subView === id;
  };

  const firstName = user.name.split(' ')[0] || user.name;
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  // ================= MAIN POST-LOGIN STUDENT PORTAL (SIDEBAR + TOP HEADER + #F8FAFC WORKSPACE) =================
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex pb-16 lg:pb-0">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto px-4 py-5">
          {/* Sidebar Brand */}
          <div className="flex items-center justify-between px-2 mb-6">
            <button
              type="button"
              onClick={() => navigateSidebar('home')}
              className="flex items-center gap-2.5 text-left cursor-pointer"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white font-display font-extrabold text-base shadow-sm">
                E
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                  ExamPro
                </div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {isPaidUser ? 'PRO Student Portal' : 'Student Portal'}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Primary Sidebar Links */}
          <nav className="space-y-1 flex-1" aria-label="Student Navigation">
            {sidebarItems.map((item) => {
              const active = isNavActive(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateSidebar(item.id)}
                  className={`nav-hover w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#4F46E5] text-white shadow-[0_4px_12px_rgba(79,70,229,0.28)]'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[11px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-50 dark:bg-indigo-950 text-[#4F46E5] dark:text-indigo-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Bottom Summary / Quick Upgrade */}
          <div className="mt-6 space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            {hasUpgradeItems ? (
              <div className="rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/50 p-3.5 border border-indigo-100 dark:border-indigo-900/60">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Upgrade Available ({unpurchasedPaidBundles.length + unpurchasedPaidTests.length})
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                  Unlock remaining paid courses &amp; mock tests with instant access.
                </p>
                <button
                  type="button"
                  onClick={() => navigateSidebar('upgrade')}
                  className="btn-press mt-2.5 w-full rounded-xl bg-[#4F46E5] py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  Upgrade Now
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-white">
                  <span className="inline-flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>{user.attempts.length} Tests Taken</span>
                  </span>
                  <span className="text-[11px] font-medium text-[#4F46E5] dark:text-indigo-400">
                    {user.district}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Right Workspace Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <div className="mx-auto max-w-[1360px] px-4 sm:px-6 h-[72px] flex items-center justify-between gap-4">
            {/* Left: Mobile Drawer Button + Personalized Welcome */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open menu"
                className="lg:hidden rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="font-display text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                  Welcome back, {firstName}
                </h2>
                <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user.exam} · {user.district}
                </p>
              </div>
            </div>

            {/* Right: Search Bar + Notification Bell + Theme/Install + Profile Avatar */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <div className="relative hidden md:block w-60 lg:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (subView !== 'home' && subView !== 'courses') {
                      setSubView('home');
                    }
                  }}
                  placeholder="Search tests, courses, notices"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800/80 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#4F46E5] focus:bg-white dark:focus:bg-slate-900 transition-colors"
                />
              </div>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifDropdown((v) => !v)}
                  aria-label="Notifications"
                  className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  {(data.announcements?.length || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#4F46E5] px-1 text-[10px] font-bold text-white tabular-nums">
                      {data.announcements?.length || 0}
                    </span>
                  )}
                </button>

                {showNotifDropdown && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl z-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        Broadcast Announcements
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifDropdown(false);
                          setSubView('notifications');
                        }}
                        className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Open Inbox
                      </button>
                    </div>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto">
                      {(data.announcements || []).slice(0, 4).map((ann) => (
                        <button
                          key={`ann-${ann.id}`}
                          type="button"
                          onClick={() => {
                            setShowNotifDropdown(false);
                            setSubView('notifications');
                          }}
                          className="w-full text-left rounded-xl p-2.5 border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-100/70 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5] dark:text-indigo-400">
                            <span>📢 Admin Broadcast</span>
                            <span className="font-mono font-normal text-slate-400">
                              {new Date(ann.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 line-clamp-1">
                            {ann.title}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">
                            {ann.message}
                          </div>
                        </button>
                      ))}
                      {(data.announcements?.length || 0) === 0 && (
                        <p className="text-xs text-slate-500 py-3 text-center">No broadcast announcements yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="Toggle theme"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Student Profile Avatar */}
              <button
                type="button"
                onClick={() => navigateSidebar('settings')}
                title={`${user.name} (${user.district})`}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 pr-2.5 hover:border-[#4F46E5] transition-colors cursor-pointer"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#4F46E5] text-xs font-extrabold text-white">
                  {initials || 'S'}
                </span>
                <span className="hidden sm:block text-left max-w-[110px]">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">
                    {firstName}
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                    {isPaidUser ? 'PRO Member' : 'Free Plan'}
                  </span>
                </span>
              </button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <div className="md:hidden px-4 pb-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (subView !== 'home' && subView !== 'courses') {
                    setSubView('home');
                  }
                }}
                placeholder="Search mock tests, courses, notices"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
              />
            </div>
          </div>
        </header>

        {/* Main Content Container */}
        <main className="flex-1 mx-auto w-full max-w-[1360px] px-4 sm:px-6 py-6">
          {/* ================= STUDENT HOME SCREEN (DASHBOARD) ================= */}
          {subView === 'home' && (() => {
            const promoBanner = data.settings.promoBanner;
            const showPromoBanner = Boolean(
              promoBanner?.is_banner_active && (promoBanner.title?.trim() || promoBanner.imageUrl?.trim())
            );
            const activeStarterTests =
              myPurchasedTests.length > 0
                ? myPurchasedTests
                : data.tests.filter((t) => t.status === 'live' && !t.paid).slice(0, 3);

            const handlePromoBannerClick = () => {
              if (!promoBanner) return;
              const target = promoBanner.targetScreen;
              if (target === 'none' || target === 'external') return;
              if (target === 'upgrade') {
                navigateSidebar(hasUpgradeItems ? 'upgrade' : 'courses');
                return;
              }
              navigateSidebar(target);
            };

            const flashNotice = data.settings.flashNotice;
            const showFlashNotice = Boolean(
              flashNotice?.enabled && flashNotice?.text?.trim()
            );

            return (
              <div className="space-y-6">
                {/* Scrolling Flash Notice / Marquee Announcement (Rendered only when enabled by Admin) */}
                {showFlashNotice && flashNotice && (
                  <div
                    role="region"
                    aria-label="Flash Announcement"
                    className="marquee-container overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/35 px-3.5 py-2.5 flex items-center gap-3 shadow-xs"
                  >
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-950">
                      <Radio className="w-3 h-3" />
                      <span>Flash</span>
                    </span>
                    <div className="flex-1 overflow-hidden">
                      <div className="animate-flash-marquee text-xs font-semibold text-amber-950 dark:text-amber-200 whitespace-nowrap">
                        <span className="pr-14">{flashNotice.text}</span>
                        <span className="pr-14" aria-hidden="true">
                          {flashNotice.text}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Real-Time Admin Broadcast Announcement Alert (Compact) */}
                {data.announcements &&
                  data.announcements.length > 0 &&
                  data.announcements[0].id !== dismissedAnnouncementId && (
                    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-gradient-to-r from-indigo-600/10 via-violet-600/10 to-transparent dark:from-indigo-950/60 dark:via-slate-900 dark:to-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-sm">
                          <Bell className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-[#4F46E5] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                              📢 Notice
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              {new Date(data.announcements[0].created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">
                            {data.announcements[0].title}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">
                            {data.announcements[0].message}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => setSubView('notifications')}
                          className="btn-press rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
                        >
                          Inbox ({data.announcements.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDismissedAnnouncementId(data.announcements![0].id)}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                          title="Dismiss notice"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                {/* 1. Dynamic Admin-Controlled Promotional Banner (Strictly hidden without whitespace when OFF) */}
                {showPromoBanner && promoBanner && (
                  <section aria-label="Promotional Banner">
                    <div
                      onClick={promoBanner.targetScreen !== 'none' && promoBanner.targetScreen !== 'external' ? handlePromoBannerClick : undefined}
                      className={`card-hover relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-[#4F46E5] via-indigo-600 to-violet-700 p-5 sm:p-6 text-white shadow-[0_10px_28px_-10px_rgba(79,70,229,0.45)] ${
                        promoBanner.targetScreen !== 'none' && promoBanner.targetScreen !== 'external'
                          ? 'cursor-pointer'
                          : ''
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                        <div className="space-y-2 max-w-2xl">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                            <Sparkles className="w-3 h-3" />
                            <span>Special Announcement</span>
                          </span>
                          {promoBanner.title && (
                            <h2 className="font-display text-lg sm:text-2xl font-extrabold leading-snug text-white">
                              {promoBanner.title}
                            </h2>
                          )}
                          {promoBanner.subtitle && (
                            <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed max-w-xl">
                              {promoBanner.subtitle}
                            </p>
                          )}
                          {promoBanner.targetScreen !== 'none' && promoBanner.ctaLabel?.trim() && (
                            <div className="pt-1">
                              {promoBanner.targetScreen === 'external' && /^https?:\/\//i.test(promoBanner.targetUrl || '') ? (
                                <a
                                  href={promoBanner.targetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-[#4F46E5] shadow-sm"
                                >
                                  <span>{promoBanner.ctaLabel}</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePromoBannerClick();
                                  }}
                                  className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-[#4F46E5] shadow-sm cursor-pointer"
                                >
                                  <span>{promoBanner.ctaLabel}</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {promoBanner.imageUrl && (
                          <div className="shrink-0">
                            <img
                              src={promoBanner.imageUrl}
                              alt={promoBanner.title || 'Promotional Offer'}
                              className="h-32 sm:h-36 w-full md:w-60 rounded-xl object-cover border border-white/25 shadow-lg"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* 2. Quick Stats / Progress Overview */}
                <section aria-label="Progress Overview" className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      Progress Overview
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigateSidebar('results')}
                      className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      View Full Analytics →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                    <button
                      type="button"
                      onClick={() => navigateSidebar('results')}
                      className="card-hover text-left rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:shadow-none border border-slate-100 dark:border-slate-800 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Tests Attempted
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-[#4F46E5] dark:text-indigo-400">
                          <ClipboardList className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {user.attempts.length}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {user.mistakes.length} mistake{user.mistakes.length === 1 ? '' : 's'} queued for review
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateSidebar('results')}
                      className="card-hover text-left rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:shadow-none border border-slate-100 dark:border-slate-800 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Average Score
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
                          <TrendingUp className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {user.attempts.length > 0 ? `${dashboardStats.avgPct}%` : '—'}
                        {user.attempts.length > 0 && (
                          <span className="ml-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            Grade {dashboardStats.gradeLabel}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {user.attempts.length > 0
                          ? `GPA ${dashboardStats.gpaValue} · All-J&K tracking`
                          : 'Complete a mock test to calculate score'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateSidebar('courses')}
                      className="card-hover text-left rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:shadow-none border border-slate-100 dark:border-slate-800 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Active Courses
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400">
                          <Layers className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {myEnrolledCoursesCount}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {myPurchasedTests.length} paid mock{myPurchasedTests.length === 1 ? '' : 's'} unlocked
                      </p>
                    </button>
                  </div>
                </section>

                {/* 3. My Active / Purchased Tests (One-Tap Start / Resume) */}
                <section aria-label="My Active and Purchased Tests" className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {myPurchasedTests.length > 0
                          ? `My Active / Purchased Tests (${myPurchasedTests.length})`
                          : 'Quick Start Free Mock Tests'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {myPurchasedTests.length > 0
                          ? 'One-tap access to start or resume your unlocked mock tests'
                          : 'Start a live free mock instantly or unlock full paid series'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {myPurchasedTests.length > 0 && (
                        <button
                          type="button"
                          onClick={() => navigateSidebar('courses')}
                          className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          My Courses →
                        </button>
                      )}
                      {hasUpgradeItems && (
                        <button
                          type="button"
                          onClick={() => navigateSidebar('upgrade')}
                          className="btn-press inline-flex items-center gap-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 text-xs font-bold text-[#4F46E5] dark:text-indigo-300 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Upgrade ({unpurchasedPaidBundles.length + unpurchasedPaidTests.length})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {activeStarterTests.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No active tests available right now. Explore categories below to begin practicing.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeStarterTests.slice(0, 6).map((t) => {
                        const prevAttempt = attemptByTestId.get(t.id);
                        const isScheduled = t.status === 'scheduled';
                        return (
                          <div
                            key={`active-${t.id}`}
                            className="card-hover rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:shadow-none flex flex-col justify-between gap-4"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                                <span className="truncate font-semibold text-[#4F46E5] dark:text-indigo-400">
                                  {t.exam}
                                </span>
                                <span className="shrink-0 rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                                  {t.paid ? 'Purchased' : 'Free Access'}
                                </span>
                              </div>
                              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white leading-snug">
                                {t.title}
                              </h3>
                              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <Clock className="w-3.5 h-3.5" /> {t.dur} mins
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <BookOpen className="w-3.5 h-3.5" /> {t.qs.length} Qs
                                </span>
                              </div>
                              {prevAttempt && (
                                <div className="mt-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                  Last Attempt: {prevAttempt.score}/{prevAttempt.maxScore}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={isScheduled || t.qs.length === 0}
                              onClick={() => setActiveTestSession({ test: t, previewOnly: false })}
                              className="btn-press w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4F46E5] py-2.5 px-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-45 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>
                                {isScheduled
                                  ? 'Starts Soon'
                                  : prevAttempt
                                  ? 'Resume / Retake Test'
                                  : 'Start Test'}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* 4. Explore Mock Tests & Exam Categories */}
                <section aria-label="Explore Mock Tests and Categories" className="space-y-5 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        Explore Mock Tests &amp; Categories
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Select an exam category to filter available mock tests
                      </p>
                    </div>
                    {(examFilter || searchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setExamFilter('');
                          setSearchQuery('');
                        }}
                        className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>

                  {/* Exam Category Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {exploreExamCategories.map((cat) => {
                      const active = examFilter === cat.id;
                      return (
                        <button
                          key={cat.id || 'all'}
                          type="button"
                          onClick={() => setExamFilter(cat.id)}
                          className={`card-hover text-left rounded-2xl border p-3.5 transition-all cursor-pointer ${
                            active
                              ? 'bg-[#4F46E5] border-[#4F46E5] text-white shadow-[0_6px_16px_rgba(79,70,229,0.28)]'
                              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white hover:border-indigo-300 dark:hover:border-indigo-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-lg" aria-hidden="true">
                              {cat.icon}
                            </span>
                            <span
                              className={`font-mono text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                                active
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {cat.count}
                            </span>
                          </div>
                          <div className="mt-2 font-display text-xs font-extrabold truncate">
                            {cat.label}
                          </div>
                          <div
                            className={`text-[10px] mt-0.5 line-clamp-1 ${
                              active ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {cat.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Filtered Mock Test Sections */}
                  <div className="space-y-6">
                    {DEFAULT_CATEGORIES.map((cat) => {
                      const list = publicTests.filter((t) => t.cat === cat.id);
                      if (list.length === 0 && (examFilter || searchQuery)) return null;
                      return (
                        <section key={cat.id} className="space-y-3.5">
                          <div className="flex items-center justify-between">
                            <h3 className="font-display text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                              {cat.icon} {cat.label}
                            </h3>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                              {list.length} {list.length === 1 ? 'Test' : 'Tests'}
                            </span>
                          </div>
                          {list.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-6 text-center text-xs text-slate-500 bg-white/50 dark:bg-slate-900/50">
                              No tests in this category yet.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {list.map(renderTestCard)}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </section>

                {/* 5. Today's Schedule + Course Progress */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col">
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <div>
                        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                          Today&apos;s Schedule
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Live mock test sessions, mistake revision &amp; scheduled timings
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateSidebar('timetable')}
                        className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Full Timetable →
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
                      {todaysSchedule.map((slot) => {
                        const statusStyles =
                          slot.status === 'Live Now'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : slot.status === 'Completed'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300';

                        return (
                          <div
                            key={slot.id}
                            className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                                <span className="font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                                  {slot.time}
                                </span>
                                <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${statusStyles}`}>
                                  {slot.status}
                                </span>
                              </div>
                              <div className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                                {slot.title}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {slot.subtitle}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={slot.onAction}
                              className="btn-press shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#4F46E5] hover:text-[#4F46E5] dark:hover:text-indigo-300 cursor-pointer whitespace-nowrap"
                            >
                              {slot.actionLabel}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* My Courses with Syllabus Progress Bars */}
                  <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col">
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <div>
                        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                          My Courses
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Syllabus &amp; mock series completion
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateSidebar('courses')}
                        className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline whitespace-nowrap cursor-pointer"
                      >
                        All Courses →
                      </button>
                    </div>

                    <div className="space-y-4 flex-1">
                      {courseProgressList.slice(0, 4).map((course) => (
                        <div
                          key={course.id}
                          onClick={() => setActiveBundle(course.bundle)}
                          className="group cursor-pointer rounded-xl p-3 -mx-3 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="min-w-0">
                              <div className="font-display text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#4F46E5] dark:group-hover:text-indigo-400 truncate">
                                {course.title}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {course.exam} · {course.completedTests}/{course.totalTests} mocks completed
                              </div>
                            </div>
                            <span className="font-mono text-xs font-bold text-[#4F46E5] dark:text-indigo-400 tabular-nums shrink-0">
                              {course.progress}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#4F46E5] transition-all duration-300"
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      {courseProgressList.length === 0 && (
                        <p className="text-xs text-slate-500 py-6 text-center">
                          No courses available yet.
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                {/* 6. District Toppers Hall of Fame */}
                <section className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:shadow-none">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <span>J&amp;K District Toppers Hall of Fame</span>
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Auto-calculated Rank #1 scorers across 20 Jammu &amp; Kashmir districts
                      </p>
                    </div>
                    <select
                      value={selectedTopperDistrict}
                      onChange={(e) => setSelectedTopperDistrict(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      <option value="All Districts">All Districts</option>
                      {JK_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {filteredToppers.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      No topper recorded in {selectedTopperDistrict} yet. Be the first to take a test!
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredToppers.map((topper) => (
                        <div
                          key={topper.district}
                          className="card-hover rounded-xl border border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50 p-3.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              #1 in {topper.district}
                            </div>
                            <div className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                              {topper.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {topper.targetExam}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {topper.score}/{topper.maxScore}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            );
          })()}

          {/* ================= MY COURSES & TEST BUNDLES ================= */}
          {(subView === 'courses' || subView === 'bundles') && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                    My Courses &amp; Test Series Bundles
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Track your enrolled courses and explore unpurchased paid test packs
                  </p>
                </div>
                {hasUpgradeItems && (
                  <button
                    type="button"
                    onClick={() => navigateSidebar('upgrade')}
                    className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Upgrade ({unpurchasedPaidBundles.length + unpurchasedPaidTests.length})</span>
                  </button>
                )}
              </div>

              {/* Enrolled Courses */}
              {courseProgressList.some((c) => c.owned) && (
                <section className="space-y-3">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Enrolled &amp; Unlocked Courses
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {courseProgressList
                      .filter((course) => course.owned)
                      .map((course) => (
                        <div
                          key={course.id}
                          onClick={() => setActiveBundle(course.bundle)}
                          className="card-hover group rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:shadow-none flex flex-col justify-between gap-4 cursor-pointer"
                        >
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="font-semibold text-[#4F46E5] dark:text-indigo-400">
                                {course.exam} · {course.bundle.validity}
                              </span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                Enrolled
                              </span>
                            </div>
                            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                              {course.title}
                            </h3>
                            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                              {course.bundle.desc}
                            </p>

                            <div className="mt-4">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-slate-500 dark:text-slate-400">
                                  Syllabus Progress ({course.completedTests}/{course.totalTests} mocks)
                                </span>
                                <span className="font-mono font-bold text-[#4F46E5] dark:text-indigo-400 tabular-nums">
                                  {course.progress}%
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#4F46E5]"
                                  style={{ width: `${course.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              Unlocked
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#4F46E5] dark:text-indigo-400">
                              Open Course <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Available Upgrade Courses (strictly excludes owned/purchased bundles) */}
              {unpurchasedPaidBundles.length > 0 && (
                <section className="space-y-3">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Available Courses to Unlock
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {courseProgressList
                      .filter((course) => !course.owned && course.bundle.price > 0)
                      .map((course) => (
                        <div
                          key={course.id}
                          onClick={() => setActiveBundle(course.bundle)}
                          className="card-hover group rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:shadow-none flex flex-col justify-between gap-4 cursor-pointer"
                        >
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="font-semibold text-[#4F46E5] dark:text-indigo-400">
                                {course.exam} · {course.bundle.validity}
                              </span>
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                                ₹{course.bundle.price}
                              </span>
                            </div>
                            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                              {course.title}
                            </h3>
                            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                              {course.bundle.desc}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                            <div>
                              <span className="font-display text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                                ₹{course.bundle.price}
                              </span>{' '}
                              {course.bundle.mrp > course.bundle.price && (
                                <span className="text-xs text-slate-400 line-through tabular-nums">
                                  ₹{course.bundle.mrp}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCheckoutItem({
                                  type: 'bundle',
                                  id: course.bundle.id,
                                  title: course.bundle.title,
                                  price: course.bundle.price,
                                });
                              }}
                              className="btn-press inline-flex items-center gap-1 rounded-xl bg-[#4F46E5] px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Unlock ₹{course.bundle.price}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ================= UPGRADE STORE (UNPURCHASED PAID COURSES & TESTS ONLY) ================= */}
          {subView === 'upgrade' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-[#4F46E5]" />
                  <span>Upgrade &amp; Unlock Paid Courses</span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Showing only paid courses and mock tests you have not purchased yet
                </p>
              </div>

              {!hasUpgradeItems ? (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-8 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <h2 className="font-display text-lg font-bold text-emerald-900 dark:text-emerald-200">
                    All Paid Courses &amp; Tests Unlocked
                  </h2>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    You have already purchased every available paid course and mock test on ExamPro.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateSidebar('courses')}
                    className="btn-press mt-2 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    Go to My Courses
                  </button>
                </div>
              ) : (
                <>
                  {unpurchasedPaidBundles.length > 0 && (
                    <section className="space-y-3">
                      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        Paid Course Bundles ({unpurchasedPaidBundles.length})
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {unpurchasedPaidBundles.map((bundle) => (
                          <div
                            key={bundle.id}
                            className="card-hover rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:shadow-none flex flex-col justify-between gap-4"
                          >
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-semibold text-[#4F46E5] dark:text-indigo-400">
                                  {bundle.exam} · {bundle.validity}
                                </span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                                  {bundle.testIds.length} Tests
                                </span>
                              </div>
                              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                                {bundle.title}
                              </h3>
                              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                {bundle.desc}
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                              <div>
                                <span className="font-display text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                                  ₹{bundle.price}
                                </span>{' '}
                                {bundle.mrp > bundle.price && (
                                  <span className="text-xs text-slate-400 line-through tabular-nums">
                                    ₹{bundle.mrp}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveBundle(bundle)}
                                  className="btn-press rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                                >
                                  Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCheckoutItem({
                                      type: 'bundle',
                                      id: bundle.id,
                                      title: bundle.title,
                                      price: bundle.price,
                                    })
                                  }
                                  className="btn-press inline-flex items-center gap-1 rounded-xl bg-[#4F46E5] px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Unlock</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {unpurchasedPaidTests.length > 0 && (
                    <section className="space-y-3">
                      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        Paid Mock Tests ({unpurchasedPaidTests.length})
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {unpurchasedPaidTests.map(renderTestCard)}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          )}

          {/* ================= ASSIGNMENTS & CHECKLIST ================= */}
          {subView === 'assignments' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                  Assignments &amp; Study Tasks
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Manage your preparation checklist and clear Mistake Notebook items
                </p>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Mistake Notebook Mastery
                  </div>
                  <div className="font-display text-base font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {user.mistakes.length} Question{user.mistakes.length === 1 ? '' : 's'} Left
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubView('mistakes')}
                  className="btn-press rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-white hover:border-[#4F46E5] cursor-pointer whitespace-nowrap"
                >
                  Practice Now
                </button>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-100 dark:border-slate-800">
                <form onSubmit={addChecklistItem} className="flex gap-2 mb-5">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder="Enter study goal or revision topic"
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#4F46E5]"
                  />
                  <button
                    type="submit"
                    className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Task</span>
                  </button>
                </form>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {checklist.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleChecklistItem(item.id)}
                        className="flex items-start gap-3 text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            item.done
                              ? 'bg-[#4F46E5] border-[#4F46E5] text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {item.done && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-medium ${
                              item.done
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.title}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {item.course} · Due {item.due}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(item.id)}
                        aria-label="Remove task"
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {checklist.length === 0 && (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      All tasks cleared! Add a new study goal above.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= ATTENDANCE & STUDY STREAK ================= */}
          {subView === 'attendance' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                  Attendance &amp; Study Consistency
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Your login activity and mock test preparation consistency
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Overall Attendance</div>
                  <div className="mt-2 font-display text-3xl font-extrabold text-[#4F46E5] dark:text-indigo-400 tabular-nums">
                    {dashboardStats.attendancePct}%
                  </div>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Mock Tests Completed</div>
                  <div className="mt-2 font-display text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                    {user.attempts.length}
                  </div>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Last Active</div>
                  <div className="mt-2 font-display text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {user.lastActiveDate}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-100 dark:border-slate-800">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white mb-4">
                  14-Day Activity Tracker
                </h2>
                <div className="grid grid-cols-7 gap-2.5">
                  {Array.from({ length: 14 }).map((_, i) => {
                    const daysAgo = 13 - i;
                    const active = daysAgo <= Math.min(6, user.attempts.length);
                    const dt = new Date();
                    dt.setDate(dt.getDate() - daysAgo);
                    return (
                      <div
                        key={i}
                        className={`rounded-xl p-3 text-center border ${
                          active
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-[#4F46E5] dark:text-indigo-300'
                            : 'bg-[#F8FAFC] dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="text-[10px] font-semibold">
                          {dt.toLocaleDateString('en-IN', { weekday: 'short' })}
                        </div>
                        <div className="font-mono text-sm font-bold mt-1 tabular-nums">
                          {dt.getDate()}
                        </div>
                        <div className="mt-1 flex justify-center">
                          {active ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400" />
                          ) : (
                            <span className="text-[10px]">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= TIMETABLE & UPCOMING EXAMS ================= */}
          {subView === 'timetable' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                  Timetable &amp; Exam Schedule
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Today&apos;s study schedule and upcoming scheduled mock tests
                </p>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {todaysSchedule.map((slot) => (
                  <div
                    key={slot.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-[#4F46E5] dark:text-indigo-400 tabular-nums">
                          {slot.time}
                        </span>
                        <span>·</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {slot.status}
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mt-0.5">
                        {slot.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{slot.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={slot.onAction}
                      className="btn-press shrink-0 rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                    >
                      {slot.actionLabel}
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Scheduled Mock Tests
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.tests
                    .filter((t) => t.status === 'scheduled')
                    .map((t) => (
                      <div
                        key={t.id}
                        className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] border border-slate-100 dark:border-slate-800"
                      >
                        <div className="text-xs font-bold text-[#4F46E5] dark:text-indigo-400">
                          {t.exam} · {new Date(t.sched).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                        <div className="font-display text-sm font-bold text-slate-900 dark:text-white mt-1">
                          {t.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {t.dur} mins · {t.qs.length} Qs
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= RESULTS & RANKINGS ================= */}
          {(subView === 'results' || subView === 'attempts') && (
            <div className="max-w-4xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                    Results &amp; District Performance
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Your test scores, All-J&amp;K rank, and {user.district} district standing · Next monthly auto-refresh: {nextResultRefreshLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubView('districtRank')}
                  className="btn-press rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                >
                  View {user.district} Leaderboard
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500">Current Grade / GPA</div>
                  <div className="mt-2 font-display text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {dashboardStats.gradeLabel} · {dashboardStats.gpaValue}
                  </div>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500">Tests Completed</div>
                  <div className="mt-2 font-display text-2xl font-extrabold text-[#4F46E5] dark:text-indigo-400 tabular-nums">
                    {user.attempts.length}
                  </div>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500">{user.district} Rank</div>
                  <div className="mt-2 font-display text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {myDistrictRank ? `#${myDistrictRank}` : '—'}
                  </div>
                </div>
              </div>

              {user.attempts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
                  You haven&apos;t attempted any mock test yet. Start a free mock test from the Dashboard!
                </div>
              ) : (
                <div className="space-y-3">
                  {user.attempts.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          {a.testTitle}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          {a.date} · All-J&amp;K Rank #{a.rank} · {user.district} Rank #{a.districtRank} ·{' '}
                          {a.percentile}%ile
                        </div>
                      </div>
                      <div className="font-mono text-base font-extrabold text-[#4F46E5] dark:text-indigo-400 tabular-nums">
                        {a.score} / {a.maxScore}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= BROADCAST ANNOUNCEMENTS NOTIFICATION INBOX ================= */}
          {subView === 'notifications' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-6 h-6 text-[#4F46E5] dark:text-indigo-400" />
                  <span>Notification Inbox</span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Live admin broadcast announcements and platform alerts
                </p>
              </div>

              {/* Admin Broadcast Announcements Inbox */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#4F46E5] dark:text-indigo-400">
                    📢 Admin Broadcast Announcements ({data.announcements?.length || 0})
                  </h2>
                  <span className="text-[11px] font-mono text-slate-400">GET /api/v1/announcements</span>
                </div>
                {(data.announcements || []).map((ann) => (
                  <div
                    key={`inbox-ann-${ann.id}`}
                    className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-extrabold text-[#4F46E5] dark:text-indigo-400">
                        <span className="rounded bg-[#4F46E5] px-1.5 py-0.5 text-[10px] text-white uppercase">
                          Broadcast
                        </span>
                        <span>{ann.adminName || `Admin #${ann.admin_id}`}</span>
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {new Date(ann.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      {ann.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {ann.message}
                    </p>
                  </div>
                ))}
                {(!data.announcements || data.announcements.length === 0) && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-xs text-slate-500 text-center">
                    No broadcast announcements yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= SETTINGS & PROFILE HUB ================= */}
          {(subView === 'settings' || subView === 'profile') && (
            <div className="max-w-3xl space-y-6">
              {/* Profile Header Card */}
              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_2px_12px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-xl font-extrabold text-white">
                    {user.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-white truncate">
                        {user.name}
                      </h2>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          isPaidUser
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {isPaidUser ? 'PRO Unlocked' : 'Free Plan'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>
                </div>

                {hasUpgradeItems ? (
                  <div className="mt-5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
                        Upgrade · {unpurchasedPaidBundles.length + unpurchasedPaidTests.length} Unpurchased Paid Item{unpurchasedPaidBundles.length + unpurchasedPaidTests.length === 1 ? '' : 's'}
                      </div>
                      <div className="text-xs text-indigo-700 dark:text-indigo-300">
                        Unlock remaining full-length mocks &amp; bundles with District Ranks
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateSidebar('upgrade')}
                      className="btn-press rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      View Upgrade List
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        All {user.ownedTestIds.length} Paid Courses &amp; Tests Unlocked
                      </div>
                      <div className="text-xs text-emerald-700 dark:text-emerald-300">
                        Your premium tests &amp; district ranks are active
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSubView('home')}
                        className="btn-press rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
                      >
                        Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubView('payments')}
                        className="btn-press rounded-xl border border-emerald-300 dark:border-emerald-700 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 cursor-pointer"
                      >
                        View Receipt
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {[
                    ['Email', user.email],
                    ['Mobile', `+91 ${user.phone}`],
                    ['District', user.district],
                    ['Target Exam', user.exam],
                  ].map(([k, v]) => (
                    <div key={k} className="py-2.5 flex justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400">{k}</span>
                      <span className="font-semibold text-slate-900 dark:text-white text-right">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Account & Study Tools Menu */}
              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_2px_12px_rgba(15,23,42,0.05)] divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {[
                  {
                    icon: <Wallet className="w-4 h-4 text-[#4F46E5]" />,
                    label: 'My Payments & Receipts',
                    right: `${myPayments.length} ›`,
                    onClick: () => setSubView('payments'),
                  },
                  {
                    icon: <BookOpen className="w-4 h-4 text-rose-600" />,
                    label: 'My Mistake Notebook',
                    right: `${user.mistakes.length} ›`,
                    onClick: () => setSubView('mistakes'),
                  },
                  {
                    icon: <Trophy className="w-4 h-4 text-amber-500" />,
                    label: 'District Rank Leaderboard',
                    right: `${myDistrictRank ? `#${myDistrictRank}` : '—'} in ${user.district} ›`,
                    onClick: () => setSubView('districtRank'),
                  },
                  {
                    icon: <Award className="w-4 h-4 text-emerald-600" />,
                    label: 'My Test Attempts',
                    right: `${user.attempts.length} ›`,
                    onClick: () => setSubView('results'),
                  },
                  {
                    icon: <Bookmark className="w-4 h-4 text-amber-600" />,
                    label: 'Saved / Bookmarked Questions',
                    right: `${user.bookmarks.length} ›`,
                    onClick: () => setSubView('bookmarks'),
                  },
                  {
                    icon: <FileText className="w-4 h-4 text-sky-600" />,
                    label: 'Exam Syllabus PDFs',
                    right: `${data.syllabi.length} PDFs ›`,
                    onClick: () => setSubView('syllabus'),
                  },
                  {
                    icon: <HelpCircle className="w-4 h-4 text-violet-600" />,
                    label: 'Help & Support',
                    right: '›',
                    onClick: () => setSubView('support'),
                  },
                ].map((row) => (
                  <button
                    key={row.label}
                    type="button"
                    onClick={row.onClick}
                    className="row-hover w-full flex items-center gap-3 px-5 py-4 text-left text-sm hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    {row.icon}
                    <span className="flex-1 font-medium text-slate-900 dark:text-white">
                      {row.label}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      {row.right}
                    </span>
                  </button>
                ))}

                <a
                  href={waSupportHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="row-hover w-full flex items-center gap-3 px-5 py-4 text-left text-sm hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#25D366]" />
                  <span className="flex-1 font-medium text-slate-900 dark:text-white">
                    WhatsApp Support
                  </span>
                  <span className="text-xs font-semibold text-slate-500">›</span>
                </a>

                <button
                  type="button"
                  onClick={() =>
                    setPendingProfile({
                      email: user.email,
                      name: user.name,
                      phone: user.phone,
                      district: user.district,
                      exam: user.exam,
                      isEdit: true,
                    })
                  }
                  className="w-full flex items-center gap-3 px-5 py-4 text-left text-sm hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-slate-500" />
                  <span className="flex-1 font-medium text-slate-900 dark:text-white">
                    Edit Profile
                  </span>
                  <span className="text-xs font-semibold text-slate-500">›</span>
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="flex-1 font-semibold">Log out</span>
                </button>
              </div>

              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
                <SocialShareBar
                  settings={data.settings}
                  onToast={onToast}
                  title="Share ExamPro with Friends"
                />
              </div>
            </div>
          )}

          {/* ================= MY PAYMENTS (2-Column Cards) ================= */}
          {subView === 'payments' && (
            <div className="max-w-3xl space-y-5">
              <button
                type="button"
                onClick={() => setSubView('settings')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Settings
              </button>
              <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                My Payments
              </h1>

              {myPayments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
                  No transactions yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {myPayments.map((p: PaymentOrder) => {
                    const statusColor =
                      p.status === 'PAID'
                        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
                        : p.status === 'PENDING_VERIFICATION'
                        ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50'
                        : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50';
                    return (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                            {p.itemTitle}
                          </h3>
                          <span className="font-mono text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                            ₹{p.finalAmount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{p.createdAt}</span>
                          <span className={`rounded-md px-2 py-0.5 font-bold text-[11px] ${statusColor}`}>
                            {p.status === 'PENDING_VERIFICATION'
                              ? 'Verification Pending'
                              : p.status === 'CREATED'
                              ? 'Initiated'
                              : p.status}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-mono truncate max-w-[190px]">
                            {p.razorpayPaymentId || p.orderNumber} · {p.paymentMethod}
                          </span>
                          {p.status === 'PAID' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (p.itemType === 'bundle') {
                                  const b = data.bundles.find((x) => x.id === p.itemId);
                                  if (b) setActiveBundle(b);
                                } else {
                                  const t = data.tests.find((x) => x.id === p.itemId);
                                  if (t) setActiveTestSession({ test: t, previewOnly: false });
                                }
                              }}
                              className="font-bold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                              {p.itemType === 'bundle' ? 'Open Course →' : 'Start →'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= MISTAKE NOTEBOOK (Automated Re-Practice & Auto-Remove) ================= */}
          {subView === 'mistakes' && (
            <div className="max-w-3xl space-y-5">
              <button
                type="button"
                onClick={() => setSubView('home')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
              </button>
              <div>
                <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                  My Mistake Notebook ({user.mistakes.length})
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Wrong answers from your tests &amp; daily quizzes are saved automatically. Solve a question correctly below to master and remove it!
                </p>
              </div>

              {user.mistakes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
                  No mistakes saved right now! Great job.
                </div>
              ) : (
                <div className="space-y-4">
                  {user.mistakes.map((m) => {
                    const picked = repracticeAnswers[m.id];
                    const answered = picked !== undefined;
                    return (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {m.subj} · {m.testTitle}
                          </div>
                          {getPreviousExams(m).length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {getPreviousExams(m)
                                .slice(0, 3)
                                .map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300"
                                  >
                                    <span>📌</span>
                                    <span>{tag}</span>
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{m.t}</h3>
                        <div className="space-y-2">
                          {m.o.map((opt, idx) => {
                            const isCorrect = idx === m.c;
                            const isPicked = picked === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleMistakeAnswer(m.id, idx, m.c)}
                                className={`w-full flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-medium cursor-pointer transition-colors ${
                                  answered && isCorrect
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                                    : answered && isPicked && !isCorrect
                                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                                    : 'border-slate-200 dark:border-slate-800 hover:border-[#4F46E5]'
                                }`}
                              >
                                <span className="font-bold">{LABELS[idx]}.</span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                        {answered && (
                          <div className="rounded-xl bg-[#F8FAFC] dark:bg-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300">
                            <strong>Explanation:</strong> {m.e}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= DISTRICT RANK VIEW ================= */}
          {subView === 'districtRank' && (
            <div className="max-w-2xl space-y-5">
              <button
                type="button"
                onClick={() => setSubView('results')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Results
              </button>
              <div className="rounded-2xl bg-gradient-to-br from-[#4F46E5] to-slate-900 p-6 text-center text-white shadow-md">
                <div className="text-xs text-indigo-200">Your Rank in {user.district}</div>
                <div className="font-display text-4xl font-extrabold mt-1 tabular-nums">
                  {myDistrictRank ? `#${myDistrictRank}` : '—'}
                </div>
                {myDistrictRank === 1 && (
                  <button
                    type="button"
                    onClick={() => setShowTopperPoster(true)}
                    className="btn-press mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-extrabold text-amber-950 cursor-pointer"
                  >
                    <Award className="w-4 h-4" />
                    <span>Share #1 District Topper Poster</span>
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_2px_12px_rgba(15,23,42,0.04)] divide-y divide-slate-100 dark:divide-slate-800">
                {myDistrictBoard.map((row, idx) => (
                  <div
                    key={row.userId}
                    className={`flex items-center justify-between px-5 py-3.5 text-sm ${
                      row.userId === user.id ? 'bg-indigo-50/70 dark:bg-indigo-950/30 font-bold' : ''
                    }`}
                  >
                    <span>
                      {['🥇', '🥈', '🥉'][idx] || `#${idx + 1}`} {row.name}
                      {row.userId === user.id ? ' (You)' : ''}
                    </span>
                    <span className="font-mono font-bold tabular-nums">{row.totalScore} pts</span>
                  </div>
                ))}
                {myDistrictBoard.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No attempts recorded in {user.district} yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= BOOKMARKS ================= */}
          {subView === 'bookmarks' && (
            <div className="max-w-3xl space-y-5">
              <button
                type="button"
                onClick={() => setSubView('settings')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Settings
              </button>
              <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                Saved Questions ({user.bookmarks.length})
              </h1>
              {user.bookmarks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
                  Tap the Bookmark icon during any test to save questions here.
                </div>
              ) : (
                <div className="space-y-4">
                  {user.bookmarks.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-slate-500">
                          {b.subj} · {b.testTitle}
                        </div>
                        {getPreviousExams(b).length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {getPreviousExams(b)
                              .slice(0, 3)
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300"
                                >
                                  <span>📌</span>
                                  <span>{tag}</span>
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{b.t}</h3>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        ✔ Correct Answer: {LABELS[b.c]}. {b.o[b.c]}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{b.e}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= EXAM SYLLABUS PDFs ================= */}
          {subView === 'syllabus' && (
            <div className="max-w-3xl space-y-5">
              <button
                type="button"
                onClick={() => setSubView('settings')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Settings
              </button>
              <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                Official Exam Syllabus PDFs
              </h1>
              <div className="space-y-3">
                {data.syllabi.map((s) => {
                  const matchesTarget = user.exam
                    .toLowerCase()
                    .includes(s.exam.split(' ')[0].toLowerCase());
                  return (
                    <div
                      key={s.id}
                      className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] ${
                        matchesTarget
                          ? 'border-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30'
                          : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-[#4F46E5] dark:text-indigo-400">
                          {s.exam} {matchesTarget ? '· Matches Your Target Exam' : ''}
                        </div>
                        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mt-0.5">
                          {s.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{s.summary}</p>
                      </div>
                      <a
                        href={s.pdfUrl}
                        download={s.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-press shrink-0 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-xs font-semibold text-white text-center whitespace-nowrap"
                      >
                        Download PDF
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= HELP & SUPPORT ================= */}
          {subView === 'support' && (
            <div className="max-w-2xl space-y-6">
              <button
                type="button"
                onClick={() => setSubView('settings')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Settings
              </button>
              <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                Help &amp; Support
              </h1>

              <form
                onSubmit={handleSupportTicketSubmit}
                className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] space-y-4"
              >
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Submit a Support Ticket
                </h2>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Enter ticket subject"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 px-3.5 py-2.5 text-sm"
                />
                <input
                  type="text"
                  value={ticketOrderId}
                  onChange={(e) => setTicketOrderId(e.target.value)}
                  placeholder="Enter Order ID (optional)"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono"
                />
                <textarea
                  required
                  rows={3}
                  value={ticketMsg}
                  onChange={(e) => setTicketMsg(e.target.value)}
                  placeholder="Describe your issue"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 p-3.5 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={submittingTicket}
                    className="btn-press rounded-xl bg-[#4F46E5] px-5 py-2.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    {submittingTicket ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                  <a
                    href={waSupportHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-semibold text-white"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp Support</span>
                  </a>
                </div>
              </form>

              <div className="space-y-3">
                <h3 className="font-display text-sm font-bold text-slate-700 dark:text-slate-300">
                  Your Previous Tickets
                </h3>
                {data.supportTickets
                  .filter((t) => t.userId === user.id)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{t.subject}</div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{t.message}</p>
                        <div className="text-[11px] text-slate-400 mt-1">{t.createdAt}</div>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${
                          t.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </main>

        {/* Global Website Footer */}
        {(subView === 'home' || subView === 'courses' || subView === 'settings' || subView === 'profile') && (
          <Footer
            settings={data.settings}
            onSelectCategoryFilter={handleFooterCategoryClick}
            onOpenPage={setInfoPage}
            onToast={onToast}
          />
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex h-16">
        {[
          { id: 'home', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
          { id: 'courses', label: 'Courses', icon: <Package className="w-5 h-5" /> },
          { id: 'results', label: 'Results', icon: <BarChart3 className="w-5 h-5" /> },
          { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
        ].map((item) => {
          const active = isNavActive(item.id as StudentSubView);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateSidebar(item.id as StudentSubView)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
                active
                  ? 'text-[#4F46E5] dark:text-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      {checkoutItem && (
        <CheckoutModal
          itemType={checkoutItem.type}
          itemId={checkoutItem.id}
          itemTitle={checkoutItem.title}
          price={checkoutItem.price}
          settings={data.settings}
          onClose={() => setCheckoutItem(null)}
          onToast={onToast}
          onSuccess={(order, updatedUser) => {
            setCheckoutItem(null);
            onUserUpdate(updatedUser as UserProfile);
            onRefreshData();
            onToast(
              order.status === 'PAID'
                ? 'Payment verified via Razorpay! Unlocked immediately.'
                : 'Order status updated.'
            );
          }}
        />
      )}

      {showTopperPoster && (
        <TopperPosterModal
          studentName={user.name}
          district={user.district}
          testTitle="District Cumulative Leaderboard"
          score={myDistrictBoard[0]?.totalScore || 0}
          maxScore={myDistrictBoard[0]?.totalScore || 100}
          onClose={() => setShowTopperPoster(false)}
          onToast={onToast}
        />
      )}

      <InfoPagesModal
        page={infoPage}
        settings={data.settings}
        onClose={() => setInfoPage(null)}
        onOpenSupportTicket={() => setSubView('support')}
      />

      <BackToTopButton variant="student" />
    </div>
  );
};
