export const JK_DISTRICTS = [
  'Srinagar',
  'Budgam',
  'Baramulla',
  'Anantnag',
  'Ganderbal',
  'Bandipora',
  'Kupwara',
  'Pulwama',
  'Shopian',
  'Kulgam',
  'Jammu',
  'Samba',
  'Kathua',
  'Udhampur',
  'Reasi',
  'Doda',
  'Kishtwar',
  'Ramban',
  'Rajouri',
  'Poonch',
] as const;

export const DEFAULT_CATEGORIES = [
  { id: 'latest', label: 'Latest Mock Tests', icon: '🔥' },
  { id: 'upcoming', label: 'Upcoming', icon: '📅' },
  { id: 'free', label: 'Free Mocks', icon: '🎁' },
  { id: 'pyqs', label: 'Previous Year Papers (PYQs)', icon: '📜' },
  { id: 'popular', label: 'Most Attempted / Popular', icon: '⚡' },
  { id: 'jk_special', label: 'J&K Special & Current Affairs', icon: '🏔️' },
  { id: 'sectional', label: 'Sectional & Subject Tests', icon: '🧩' },
  { id: 'mega', label: 'All-J&K Live Mega Mocks', icon: '🏆' },
] as const;

export const DEFAULT_SUBJECTS = [
  'J&K General Knowledge',
  'History',
  'Geography',
  'Indian Polity',
  'English',
  'Math',
  'Reasoning',
  'Computer',
  'General Science',
  'Current Affairs',
];

export interface Question {
  id: string;
  t: string;
  o: [string, string, string, string];
  c: number;
  e: string;
  subj: string;
  src?: 'manual' | 'ai' | 'csv' | 'json';
  previous_exams?: string[] | null; // nullable JSON column, max 3 items e.g. ["JKBOSE 2020", "JKPIS 2026"]
  examRef?: string[]; // synced alias for backward compatibility
}

export interface ExtractionResult {
  id: string;
  t: string;
  o: [string, string, string, string];
  c: number;
  e: string;
  subj: string;
  previous_exams: string[] | null; // nullable JSON column, max 3 items
  examRef?: string[];
  reviewState: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export function getPreviousExams(
  item?: { previous_exams?: string[] | null; examRef?: string[] } | null
): string[] {
  if (!item) return [];
  const raw = Array.isArray(item.previous_exams)
    ? item.previous_exams
    : Array.isArray(item.examRef)
    ? item.examRef
    : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of raw) {
    const clean = String(tag || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= 3) break;
  }
  return result;
}

export function normalizePreviousExams(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) return null;
  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
    ? raw.split(',')
    : [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of arr) {
    const val = String(item || '').trim();
    if (!val) continue;
    const lower = val.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    cleaned.push(val);
    if (cleaned.length >= 3) break;
  }
  return cleaned.length > 0 ? cleaned : null;
}

export interface MockTest {
  id: number;
  cat: string;
  exam: string;
  title: string;
  testType: 'full' | 'sectional';
  subject?: string;
  paid: boolean;
  price: number;
  dur: number;
  neg: number;
  sched: string;
  status: 'live' | 'scheduled' | 'draft';
  desc: string;
  syllabusTag: string;
  language: string;
  attemptCount: number;
  bundleId?: number | null;
  qs: Question[];
}

export interface TestBundle {
  id: number;
  title: string;
  exam: string;
  desc: string;
  price: number;
  mrp: number;
  validity: string;
  bundleOnly: boolean;
  testIds: number[];
  featured?: boolean;
}

export interface TestResultEntry {
  id: string;
  testId: number;
  userId: number;
  name: string;
  district: string;
  targetExam: string;
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  skipped: number;
  timeSec: number;
  subjectBreakdown: Record<string, { correct: number; total: number }>;
  date: string;
}

export interface MistakeItem {
  id: string;
  t: string;
  o: [string, string, string, string];
  c: number;
  sel: number;
  e: string;
  subj: string;
  testTitle: string;
  previous_exams?: string[] | null;
  examRef?: string[];
  addedAt: string;
}

export interface BookmarkItem {
  id: string;
  t: string;
  o: [string, string, string, string];
  c: number;
  e: string;
  subj: string;
  testTitle: string;
  previous_exams?: string[] | null;
  examRef?: string[];
}

export interface AttemptSummary {
  id: string;
  testId: number;
  testTitle: string;
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  skipped: number;
  rank: number;
  totalParticipants: number;
  districtRank: number;
  districtTotal: number;
  percentile: number;
  date: string;
}

export type PaymentStatus = 'CREATED' | 'PENDING_VERIFICATION' | 'PAID' | 'FAILED' | 'REJECTED' | 'REFUNDED';

export interface PaymentOrder {
  id: string;
  orderNumber: string;
  userId: number;
  userName: string;
  userPhone: string;
  itemType: 'test' | 'bundle';
  itemId: number;
  itemTitle: string;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode?: string;
  utrNumber?: string;
  screenshotUrl?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  paymentMethod: 'RAZORPAY' | 'UPI' | 'FREE_COUPON';
  status: PaymentStatus;
  createdAt: string;
  verifiedAt?: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'flat' | 'free';
  value: number;
  maxUses: number;
  usedCount: number;
  expiryDate: string;
  active: boolean;
}

export interface SyllabusDoc {
  id: string;
  exam: string;
  title: string;
  summary: string;
  pdfUrl: string;
  fileName: string;
  uploadedAt: string;
}

export interface SupportTicket {
  id: string;
  userId: number;
  userName: string;
  userPhone: string;
  userEmail: string;
  orderId?: string;
  subject: string;
  message: string;
  status: 'pending' | 'resolved';
  createdAt: string;
}

export interface ReportedQuestion {
  id: string;
  testId: number;
  testTitle: string;
  questionId: string;
  questionText: string;
  reporterId: number;
  reporterName: string;
  reason: string;
  status: 'pending' | 'resolved';
  createdAt: string;
}

export interface UpiSettings {
  upiId: string;
  payeeName: string;
  qrImageUrl: string;
}

export interface SocialPlatformConfig {
  on: boolean;
  url: string;
}

export interface RazorpayGatewaySettings {
  keyId: string;
  keySecret?: string;
}

export type PromoBannerTargetScreen =
  | 'none'
  | 'upgrade'
  | 'courses'
  | 'bundles'
  | 'results'
  | 'syllabus'
  | 'external';

export interface PromoBannerSettings {
  is_banner_active: boolean;
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string;
  targetScreen: PromoBannerTargetScreen;
  targetUrl: string;
  updatedAt?: string;
}

export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

export interface FlashNoticeSettings {
  enabled: boolean;
  text: string;
}

export interface AppSettings {
  adminEmail: string;
  adminPhone: string;
  whatsappSupportNumber: string;
  whatsappSupportMessage: string;
  shareMessage: string;
  shareAppUrl: string;
  social: {
    wa: SocialPlatformConfig;
    fb: SocialPlatformConfig;
    ig: SocialPlatformConfig;
    yt: SocialPlatformConfig;
    cp: { on: boolean };
  };
  upi: UpiSettings;
  razorpay?: RazorpayGatewaySettings;
  promoBanner?: PromoBannerSettings;
  maintenance?: MaintenanceSettings;
  flashNotice?: FlashNoticeSettings;
}

export interface UserProfile {
  id: number;
  email: string;
  phone: string;
  name: string;
  district: string;
  exam: string;
  role: 'student' | 'admin';
  sessionToken: string | null;
  ownedTestIds: number[];
  ownedBundleIds: number[];
  mistakes: MistakeItem[];
  bookmarks: BookmarkItem[];
  attempts: AttemptSummary[];
  joinedAt: string;
  lastActiveDate: string;
}

export interface TrafficStats {
  totalVisitors: number;
  todayActiveStudents: number;
}

export interface MonthlyResultArchive {
  cycleKey: string; // YYYY-MM
  cycleLabel: string;
  archivedAt: string;
  totalAttempts: number;
  results: TestResultEntry[];
}

export interface ResultCycleInfo {
  cycleKey: string;
  nextRefreshIso: string;
  nextRefreshLabel: string;
  lastRefreshIso?: string;
  archivedCycles: MonthlyResultArchive[];
}

export function getMonthEndDateTime(year: number, monthIndex: number): Date {
  // Day 0 of next month gives the exact last day of `monthIndex` (28/29/30/31) at 23:55:00
  return new Date(year, monthIndex + 1, 0, 23, 55, 0, 0);
}

export function getNextMonthEndRefreshDate(now: Date = new Date()): Date {
  const thisMonthEnd = getMonthEndDateTime(now.getFullYear(), now.getMonth());
  if (now.getTime() < thisMonthEnd.getTime()) {
    return thisMonthEnd;
  }
  return getMonthEndDateTime(now.getFullYear(), now.getMonth() + 1);
}

export function getDueResultCycleKey(now: Date = new Date()): string {
  const thisMonthEnd = getMonthEndDateTime(now.getFullYear(), now.getMonth());
  if (now.getTime() >= thisMonthEnd.getTime()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

export interface Announcement {
  id: number;
  admin_id: number;
  adminName?: string;
  title: string;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface AppBootstrapData {
  tests: MockTest[];
  bundles: TestBundle[];
  exams: string[];
  subjects: string[];
  results: TestResultEntry[];
  coupons: Coupon[];
  payments: PaymentOrder[];
  announcements?: Announcement[];
  syllabi: SyllabusDoc[];
  supportTickets: SupportTicket[];
  reportedQuestions: ReportedQuestion[];
  extraction_results?: ExtractionResult[];
  settings: AppSettings;
  traffic: TrafficStats;
  resultCycle?: ResultCycleInfo;
  students?: UserProfile[]; // returned for admin view
}
