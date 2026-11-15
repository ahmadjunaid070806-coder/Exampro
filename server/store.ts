import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  Announcement,
  AppBootstrapData,
  AppSettings,
  Coupon,
  ExtractionResult,
  MockTest,
  MonthlyResultArchive,
  PaymentOrder,
  Question,
  ReportedQuestion,
  ResultCycleInfo,
  SupportTicket,
  SyllabusDoc,
  TestBundle,
  TestResultEntry,
  UserProfile,
} from '../src/types.ts';
import {
  DEFAULT_SUBJECTS,
  getDueResultCycleKey,
  getNextMonthEndRefreshDate,
  getPreviousExams,
  normalizePreviousExams,
} from '../src/types.ts';

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(plain: string, stored?: string): boolean {
  if (!stored) return false;
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hexHash] = parts;
    try {
      const expected = Buffer.from(hexHash, 'hex');
      const actual = crypto.scryptSync(plain, salt, 64);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }
  return plain === stored;
}

export interface UserRecord extends UserProfile {
  password?: string;
}

export interface OtpRecord {
  email: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

export interface DatabaseState {
  tests: MockTest[];
  bundles: TestBundle[];
  exams: string[];
  subjects: string[];
  results: TestResultEntry[];
  archivedResults: MonthlyResultArchive[];
  lastResultCycleKey: string;
  lastResultResetAt?: string;
  coupons: Coupon[];
  payments: PaymentOrder[];
  announcements: Announcement[];
  syllabi: SyllabusDoc[];
  supportTickets: SupportTicket[];
  reportedQuestions: ReportedQuestion[];
  extraction_results: ExtractionResult[];
  otpRecords?: OtpRecord[];
  settings: AppSettings;
  users: UserRecord[];
  visitorIds: string[];
  totalVisitors: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function makeDefaultQrSvgDataUri(upiId: string, payee: string): string {
  // Deterministic crisp vector QR pattern placeholder so QR displays cleanly before custom upload
  const cells = 21;
  let rects = '';
  let hash = 0;
  const seed = `${upiId}|${payee}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);

  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      let dark = false;
      if (isFinder(r, c)) {
        const lr = r >= cells - 7 ? r - (cells - 7) : r;
        const lc = c >= cells - 7 ? c - (cells - 7) : c;
        dark =
          lr === 0 ||
          lr === 6 ||
          lc === 0 ||
          lc === 6 ||
          (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      } else if (r === 6 || c === 6) {
        dark = (r + c) % 2 === 0;
      } else {
        const v = (hash ^ (r * 73856093) ^ (c * 19349663)) >>> 0;
        dark = v % 11 < 5;
      }
      if (dark) {
        rects += `<rect x="${20 + c * 8}" y="${20 + r * 8}" width="8" height="8" fill="#0f172a"/>`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 208 208" width="208" height="208"><rect width="208" height="208" rx="12" fill="#ffffff"/>${rects}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createDefaultAdminUser(): UserRecord {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: 1,
    email: 'jumee89@gmail.com',
    phone: '9906101048',
    name: 'Ahmad Junaid (Admin)',
    district: 'Srinagar',
    exam: 'Admin',
    role: 'admin',
    password: hashPassword('Loading@786'),
    sessionToken: null,
    ownedTestIds: [],
    ownedBundleIds: [],
    mistakes: [],
    bookmarks: [],
    attempts: [],
    joinedAt: today,
    lastActiveDate: today,
  };
}

function buildCleanSettings(): AppSettings {
  const runtimeAppUrl =
    process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL' ? process.env.APP_URL.trim() : '';

  return {
    adminEmail: 'jumee89@gmail.com',
    adminPhone: '9906101048',
    whatsappSupportNumber: '919906101048',
    whatsappSupportMessage: 'Hi ExamPro Team, I need help with my mock test account.',
    shareMessage:
      'Prepare for competitive exams with ExamPro CBT Mock Tests & District Rankings:',
    shareAppUrl: runtimeAppUrl,
    social: {
      wa: { on: true, url: 'https://wa.me/919906101048' },
      fb: { on: false, url: '' },
      ig: { on: false, url: '' },
      yt: { on: false, url: '' },
      cp: { on: true },
    },
    upi: {
      upiId: '',
      payeeName: 'ExamPro',
      qrImageUrl: makeDefaultQrSvgDataUri('exampro@upi', 'ExamPro'),
    },
    razorpay: {
      keyId: '',
      keySecret: '',
    },
    promoBanner: {
      is_banner_active: false,
      title: '',
      subtitle: '',
      ctaLabel: '',
      imageUrl: '',
      targetScreen: 'none',
      targetUrl: '',
    },
    maintenance: {
      enabled: false,
      message: 'ExamPro is currently undergoing scheduled maintenance to improve performance. Please check back shortly.',
    },
    flashNotice: {
      enabled: false,
      text: '',
    },
  };
}

// Production-safe initial DatabaseSeeder: ONLY seeds the default admin (jumee89@gmail.com / Loading@786) and clean empty settings/tables
function buildInitialSeed(): DatabaseState {
  const adminUser = createDefaultAdminUser();
  const settings = buildCleanSettings();

  return migratePreviousExams({
    tests: [],
    bundles: [],
    exams: [],
    subjects: [...DEFAULT_SUBJECTS],
    results: [],
    archivedResults: [],
    lastResultCycleKey: getDueResultCycleKey(new Date()),
    coupons: [],
    payments: [],
    announcements: [],
    syllabi: [],
    supportTickets: [],
    reportedQuestions: [],
    extraction_results: [],
    otpRecords: [],
    settings,
    users: [adminUser],
    visitorIds: [],
    totalVisitors: 0,
  });
}

function syncQuestionPreviousExams(q: Question): Question {
  const tags = getPreviousExams(q);
  const normalized = normalizePreviousExams(tags);
  return {
    ...q,
    previous_exams: normalized,
    examRef: normalized ?? [],
  };
}

export function migratePreviousExams(db: DatabaseState): DatabaseState {
  // Cleanly remove deprecated Daily Quiz & Exam Updates collections and user streak columns
  const rawDb = db as unknown as Record<string, unknown>;
  delete rawDb.dailyQuizzes;
  delete rawDb.updates;

  db.tests.forEach((test) => {
    test.qs = (test.qs || []).map(syncQuestionPreviousExams);
  });
  db.users.forEach((u) => {
    const rawUser = u as unknown as Record<string, unknown>;
    delete rawUser.dailyStreak;
    delete rawUser.lastDailyQuizDate;
    u.mistakes = (u.mistakes || []).map((m) => {
      const normalized = normalizePreviousExams(getPreviousExams(m));
      return {
        ...m,
        previous_exams: normalized,
        examRef: normalized ?? [],
      };
    });
    u.bookmarks = (u.bookmarks || []).map((b) => {
      const normalized = normalizePreviousExams(getPreviousExams(b));
      return {
        ...b,
        previous_exams: normalized,
        examRef: normalized ?? [],
      };
    });
  });
  if (!Array.isArray(db.extraction_results)) {
    db.extraction_results = [];
  } else {
    db.extraction_results = db.extraction_results.map((er) => {
      const normalized = normalizePreviousExams(getPreviousExams(er));
      return {
        ...er,
        previous_exams: normalized,
        examRef: normalized ?? [],
      };
    });
  }
  if (!Array.isArray(db.announcements)) {
    db.announcements = [];
  }
  // Sanitize legacy placeholder domains (.jk.in or bare social roots) so ExamPro branding & URLs stay strictly clean
  if (db.settings) {
    if (
      !db.settings.shareAppUrl ||
      /\.jk\.in\b/i.test(db.settings.shareAppUrl) ||
      db.settings.shareAppUrl === 'MY_APP_URL'
    ) {
      db.settings.shareAppUrl =
        process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
          ? process.env.APP_URL.trim()
          : '';
    }
    if (db.settings.social) {
      const placeholderRoots = [
        'https://facebook.com/',
        'https://www.facebook.com/',
        'https://instagram.com/',
        'https://www.instagram.com/',
        'https://youtube.com/',
        'https://www.youtube.com/',
      ];
      (['fb', 'ig', 'yt'] as const).forEach((key) => {
        const currentUrl = (db.settings.social[key]?.url || '').trim();
        if (placeholderRoots.includes(currentUrl) || /\.jk\.in\b/i.test(currentUrl)) {
          db.settings.social[key] = { on: false, url: '' };
        }
      });
    }
    if (db.settings.upi && db.settings.upi.payeeName === 'ExamPro J&K') {
      db.settings.upi.payeeName = 'ExamPro';
    }
    if (!db.settings.razorpay) {
      db.settings.razorpay = { keyId: '', keySecret: '' };
    }
    if (!db.settings.promoBanner) {
      db.settings.promoBanner = {
        is_banner_active: false,
        title: 'ExamPro Special Offer',
        subtitle: 'Unlock full-length CBT mock tests & detailed solutions.',
        ctaLabel: 'Explore Upgrades',
        imageUrl: '',
        targetScreen: 'upgrade',
        targetUrl: '',
      };
    }
    if (!db.settings.maintenance) {
      db.settings.maintenance = {
        enabled: false,
        message: 'ExamPro is currently undergoing scheduled maintenance to improve performance. Please check back shortly.',
      };
    }
    if (!db.settings.flashNotice) {
      db.settings.flashNotice = {
        enabled: false,
        text: '',
      };
    }
    if (db.settings.adminEmail === 'JUMEE89@GMAIL.COM') {
      db.settings.adminEmail = 'jumee89@gmail.com';
    }
  }
  if (!Array.isArray(db.otpRecords)) {
    db.otpRecords = [];
  } else {
    const now = Date.now();
    db.otpRecords = db.otpRecords.filter((rec) => rec.expiresAt > now);
  }
  db.users.forEach((u) => {
    if (u.role === 'admin') {
      if (u.email === 'JUMEE89@GMAIL.COM') {
        u.email = 'jumee89@gmail.com';
      }
      if (!u.password || u.password === '12345') {
        u.password = hashPassword('Loading@786');
      }
    }
  });
  return db;
}

let cachedDb: DatabaseState | null = null;

export function getDb(): DatabaseState {
  if (cachedDb) return cachedDb;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      cachedDb = migratePreviousExams(JSON.parse(raw) as DatabaseState);
      if (!Array.isArray(cachedDb.archivedResults)) {
        cachedDb.archivedResults = [];
      }
      if (!cachedDb.lastResultCycleKey) {
        cachedDb.lastResultCycleKey = getDueResultCycleKey(new Date());
      }
      saveDb();
      return cachedDb;
    }
  } catch (err) {
    console.error('Failed to load DB, recreating seed:', err);
  }
  cachedDb = buildInitialSeed();
  saveDb();
  return cachedDb;
}

export function saveDb(): void {
  if (!cachedDb) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(cachedDb, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist DB:', err);
  }
}

// Safe firstOrCreate for Admin account — never overwrites existing admin, students, or real exam data
export function ensureInstalledDatabase(opts?: { appUrl?: string }): {
  seeded: boolean;
  adminEmail: string;
} {
  const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const db = getDb();
  let mutated = false;
  if (opts?.appUrl && /^https?:\/\//i.test(opts.appUrl.trim()) && !db.settings.shareAppUrl) {
    db.settings.shareAppUrl = opts.appUrl.trim().replace(/\/+$/, '');
    mutated = true;
  }
  const existingAdmin = db.users.find(
    (u) => u.role === 'admin' || u.email.toLowerCase() === 'jumee89@gmail.com'
  );
  if (!existingAdmin) {
    db.users.unshift(createDefaultAdminUser());
    mutated = true;
  }
  if (mutated || !fs.existsSync(DB_PATH)) {
    saveDb();
  }
  const activeAdmin = db.users.find(
    (u) => u.role === 'admin' || u.email.toLowerCase() === 'jumee89@gmail.com'
  );
  return {
    seeded: true,
    adminEmail: activeAdmin?.email || 'jumee89@gmail.com',
  };
}

export interface DemoCleanupSummary {
  students: number;
  tests: number;
  questions: number;
  bundles: number;
  categories: number;
  results: number;
  archivedResults: number;
  announcements: number;
  coupons: number;
  payments: number;
  syllabi: number;
  supportTickets: number;
  reportedQuestions: number;
  extractionResults: number;
  preservedAdmins: number;
}

// One-time safe production cleanup: deletes all non-admin users, demo tests/questions/categories/notices/banners/attempts while preserving Admin & Settings
export function cleanProductionData(): DemoCleanupSummary {
  const db = getDb();
  const isPreservedAdmin = (u: UserRecord) =>
    u.role === 'admin' || u.email.toLowerCase() === 'jumee89@gmail.com';

  const removedStudents = db.users.filter((u) => !isPreservedAdmin(u)).length;
  const totalQuestions = db.tests.reduce((acc, t) => acc + (Array.isArray(t.qs) ? t.qs.length : 0), 0);

  const summary: DemoCleanupSummary = {
    students: removedStudents,
    tests: db.tests.length,
    questions: totalQuestions,
    bundles: db.bundles.length,
    categories: db.exams.length,
    results: db.results.length,
    archivedResults: db.archivedResults.length,
    announcements: db.announcements.length,
    coupons: db.coupons.length,
    payments: db.payments.length,
    syllabi: db.syllabi.length,
    supportTickets: db.supportTickets.length,
    reportedQuestions: db.reportedQuestions.length,
    extractionResults: db.extraction_results.length,
    preservedAdmins: 0,
  };

  let admins: UserRecord[] = db.users
    .filter(isPreservedAdmin)
    .map((u) => ({
      ...u,
      role: 'admin' as const,
      ownedTestIds: [],
      ownedBundleIds: [],
      mistakes: [],
      bookmarks: [],
      attempts: [],
    }));
  if (admins.length === 0) {
    admins = [createDefaultAdminUser()];
  }
  summary.preservedAdmins = admins.length;

  db.users = admins;
  db.tests = [];
  db.bundles = [];
  db.exams = [];
  db.results = [];
  db.archivedResults = [];
  db.coupons = [];
  db.payments = [];
  db.announcements = [];
  db.syllabi = [];
  db.supportTickets = [];
  db.reportedQuestions = [];
  db.extraction_results = [];
  db.otpRecords = [];
  db.visitorIds = [];
  db.totalVisitors = 0;

  // Clear demo promotional banners & flash notices while preserving all admin/payment/support/social settings
  db.settings.promoBanner = {
    is_banner_active: false,
    title: '',
    subtitle: '',
    ctaLabel: '',
    imageUrl: '',
    targetScreen: 'none',
    targetUrl: '',
  };
  db.settings.flashNotice = {
    enabled: false,
    text: '',
  };

  saveDb();
  return summary;
}

export function checkAndRunMonthlyResultRefresh(now: Date = new Date(), force = false): boolean {
  const db = getDb();
  const dueKey = getDueResultCycleKey(now);
  if (!force && db.lastResultCycleKey === dueKey) {
    return false;
  }

  if (db.results.length > 0) {
    const cycleLabel = now.toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric',
    });
    db.archivedResults.unshift({
      cycleKey: dueKey,
      cycleLabel,
      archivedAt: now.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      totalAttempts: db.results.length,
      results: [...db.results],
    });
    if (db.archivedResults.length > 24) {
      db.archivedResults.length = 24;
    }
  }

  db.results = [];
  db.users.forEach((u) => {
    u.attempts = [];
  });
  db.lastResultCycleKey = dueKey;
  db.lastResultResetAt = now.toISOString();
  saveDb();
  return true;
}

export function sanitizeUser(u: UserRecord): UserProfile {
  const { password: _pw, ...safe } = u;
  return safe;
}

export function isAdminCredentials(email: string, phone: string, settings: AppSettings): boolean {
  const eMatch = email.trim().toLowerCase() === settings.adminEmail.trim().toLowerCase();
  const pMatch = Boolean(phone && phone.trim() === settings.adminPhone.trim());
  return eMatch || pMatch;
}

export function getPublicBootstrap(isAdmin: boolean): AppBootstrapData {
  const db = getDb();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const todayActiveStudents = db.users.filter((u) => u.role === 'student' && u.lastActiveDate === today).length;
  const nextRefresh = getNextMonthEndRefreshDate(now);
  const resultCycle: ResultCycleInfo = {
    cycleKey: db.lastResultCycleKey,
    nextRefreshIso: nextRefresh.toISOString(),
    nextRefreshLabel: nextRefresh.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    lastRefreshIso: db.lastResultResetAt,
    archivedCycles: isAdmin ? db.archivedResults : [],
  };

  return {
    tests: db.tests,
    bundles: db.bundles,
    exams: db.exams,
    subjects: db.subjects,
    results: db.results,
    coupons: db.coupons,
    payments: db.payments,
    announcements: db.announcements,
    syllabi: db.syllabi,
    supportTickets: db.supportTickets,
    reportedQuestions: db.reportedQuestions,
    ...(isAdmin ? { extraction_results: db.extraction_results } : {}),
    settings: isAdmin
      ? db.settings
      : {
          ...db.settings,
          razorpay: undefined,
        },
    traffic: {
      totalVisitors: db.totalVisitors,
      todayActiveStudents,
    },
    resultCycle,
    ...(isAdmin ? { students: db.users.filter((u) => u.role === 'student').map(sanitizeUser) } : {}),
  };
}
