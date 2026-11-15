import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import http from 'http';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  checkAndRunMonthlyResultRefresh,
  cleanProductionData,
  ensureInstalledDatabase,
  getDb,
  getPublicBootstrap,
  hashPassword,
  isAdminCredentials,
  saveDb,
  sanitizeUser,
  verifyPassword,
  type OtpRecord,
  type UserRecord,
} from './server/store.ts';
import type {
  Announcement,
  Coupon,
  ExtractionResult,
  MockTest,
  PaymentOrder,
  PromoBannerSettings,
  PromoBannerTargetScreen,
  Question,
  ReportedQuestion,
  SupportTicket,
  SyllabusDoc,
  TestBundle,
  TestResultEntry,
} from './src/types.ts';
import { getPreviousExams, normalizePreviousExams } from './src/types.ts';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

const ENV_FILE_PATH = path.resolve(process.cwd(), '.env');
const DB_FILE_PATH = path.resolve(process.cwd(), 'data', 'db.json');

function readEnvFlag(key: string): string | null {
  if (!fs.existsSync(ENV_FILE_PATH)) return null;
  const content = fs.readFileSync(ENV_FILE_PATH, 'utf8');
  const re = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'im');
  const match = content.match(re);
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function isAppInstalled(): boolean {
  const fileFlag = readEnvFlag('APP_INSTALLED');
  if (fileFlag !== null) {
    return fileFlag.toLowerCase() === 'true';
  }
  if (String(process.env.APP_INSTALLED || '').toLowerCase() === 'false') {
    return false;
  }
  return fs.existsSync(DB_FILE_PATH);
}

function isInstallerLocked(): boolean {
  const fileFlag = readEnvFlag('APP_INSTALLED');
  return fileFlag !== null && fileFlag.toLowerCase() === 'true';
}

function formatEnvValue(val: string): string {
  const clean = String(val ?? '').replace(/\r?\n/g, '').trim();
  const escaped = clean.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

// Auto-Redirect Middleware: redirect visitors to /install if app is not yet installed
app.use((req, res, next) => {
  if (isAppInstalled()) return next();
  const p = req.path || '/';
  if (
    p === '/install' ||
    p.startsWith('/install/') ||
    p.startsWith('/api/') ||
    p.startsWith('/assets/') ||
    p.startsWith('/src/') ||
    p.startsWith('/node_modules/') ||
    p.startsWith('/@') ||
    /\.(js|mjs|css|svg|png|jpg|jpeg|webp|ico|json|webmanifest|woff2?|ttf|map|txt)$/i.test(p)
  ) {
    return next();
  }
  if (req.method === 'GET' && req.accepts('html')) {
    return res.redirect(302, '/install');
  }
  return next();
});

// Real-time SSE clients
interface SseClient {
  id: string;
  res: express.Response;
  userId?: number;
  sessionToken?: string;
}

const sseClients = new Set<SseClient>();

function broadcastEvent(event: string, payload: unknown) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

function broadcastDataSync() {
  broadcastEvent('data_updated', { ts: Date.now() });
}

function revokePreviousStudentSessions(user: UserRecord, newToken: string) {
  broadcastEvent('session_revoked', {
    userId: user.id,
    activeToken: newToken,
  });
}

function makeToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashOtpCode(email: string, otp: string): string {
  const secret = process.env.OTP_SECRET || process.env.SESSION_SECRET || 'exampro-v2-otp-hmac-key';
  return crypto
    .createHmac('sha256', secret)
    .update(`${email.trim().toLowerCase()}:${otp}`)
    .digest('hex');
}

function isPlaceholderEnvValue(val: string): boolean {
  const v = val.trim();
  if (!v) return true;
  return /^(MY_|YOUR_|example|placeholder|changeme|none|null)/i.test(v);
}

function isSmtpConfigured(): boolean {
  const user = (process.env.MAIL_USERNAME || process.env.SMTP_USER || '').trim();
  const pass = (process.env.MAIL_PASSWORD || process.env.SMTP_PASS || '').trim();
  return !isPlaceholderEnvValue(user) && !isPlaceholderEnvValue(pass);
}

async function sendGmailOtpEmail(toEmail: string, otp: string): Promise<{ sent: boolean; error?: string }> {
  if (!isSmtpConfigured()) {
    return { sent: false };
  }
  const host = (process.env.MAIL_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.MAIL_PORT || 587);
  const encryption = (process.env.MAIL_ENCRYPTION || '').trim().toLowerCase();
  const user = (process.env.MAIL_USERNAME || process.env.SMTP_USER || '').trim();
  const pass = (process.env.MAIL_PASSWORD || process.env.SMTP_PASS || '').trim();
  const rawFrom = (process.env.MAIL_FROM_ADDRESS || '').trim();
  const fromAddr = isPlaceholderEnvValue(rawFrom) ? user : rawFrom;
  const fromName = (process.env.MAIL_FROM_NAME || 'ExamPro').trim();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: encryption === 'ssl' || port === 465,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddr}>`,
    to: toEmail,
    subject: `${otp} is your ExamPro Student Login OTP`,
    text: `Your ExamPro login verification code is ${otp}. This code expires in 5 minutes. Never share this OTP with anyone.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;">
        <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">ExamPro Student Login</h2>
        <p style="margin:0 0 18px;color:#475569;font-size:14px;">Use the 6-digit verification code below to sign in to your ExamPro account:</p>
        <div style="text-align:center;padding:16px;border-radius:12px;background:#eef2ff;border:1px solid #c7d2fe;font-size:32px;font-weight:800;letter-spacing:8px;color:#4338ca;">
          ${otp}
        </div>
        <p style="margin:18px 0 0;color:#64748b;font-size:12px;">This code is valid for <strong>5 minutes</strong>. If you did not request this login, you can safely ignore this email.</p>
      </div>
    `,
  });

  return { sent: true };
}

function getAuthUser(req: express.Request): UserRecord | null {
  const db = getDb();
  const userIdRaw = req.headers['x-user-id'];
  const token = req.headers['x-session-token'] as string | undefined;
  if (!userIdRaw) return null;
  const userId = Number(userIdRaw);
  const u = db.users.find((x) => x.id === userId);
  if (!u) return null;
  if (u.role === 'student') {
    if (!token || u.sessionToken !== token) return null;
  }
  return u;
}

function requireAdmin(req: express.Request, res: express.Response): UserRecord | null {
  const u = getAuthUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return null;
  }
  return u;
}

function formatNowDisplay(): string {
  return new Date().toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Validation rule: 'previous_exams' => 'nullable|array|max:3'
function validateAndSyncQuestion(q: Question): { ok: boolean; question: Question; error?: string } {
  const rawPrev = q.previous_exams !== undefined ? q.previous_exams : q.examRef;
  if (rawPrev !== null && rawPrev !== undefined) {
    if (!Array.isArray(rawPrev)) {
      return {
        ok: false,
        question: q,
        error: 'The previous_exams field must be an array or null.',
      };
    }
    const nonEmpty = rawPrev.map((x) => String(x || '').trim()).filter(Boolean);
    if (nonEmpty.length > 3) {
      return {
        ok: false,
        question: q,
        error: 'The previous_exams field must not have more than 3 items.',
      };
    }
  }
  const normalized = normalizePreviousExams(rawPrev);
  return {
    ok: true,
    question: {
      ...q,
      previous_exams: normalized,
      examRef: normalized ?? [],
    },
  };
}

// SSE Stream for real-time sync & single-device logout
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const client: SseClient = {
    id: makeToken(),
    res,
    userId: req.query.userId ? Number(req.query.userId) : undefined,
    sessionToken: req.query.token ? String(req.query.token) : undefined,
  };
  sseClients.add(client);

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(client);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(client);
  });
});

// Bootstrap endpoint
app.get('/api/bootstrap', (req, res) => {
  checkAndRunMonthlyResultRefresh();
  const db = getDb();
  const visitorId = req.headers['x-visitor-id'] as string | undefined;
  if (visitorId && !db.visitorIds.includes(visitorId)) {
    db.visitorIds.push(visitorId);
    if (db.visitorIds.length > 5000) db.visitorIds.shift();
    db.totalVisitors += 1;
    saveDb();
  }

  const user = getAuthUser(req);
  const today = new Date().toISOString().slice(0, 10);
  if (user && user.lastActiveDate !== today) {
    user.lastActiveDate = today;
    saveDb();
  }

  const userIdHeader = req.headers['x-user-id'];
  const tokenHeader = req.headers['x-session-token'] as string | undefined;
  let sessionInvalid = false;
  if (userIdHeader) {
    const found = db.users.find((u) => u.id === Number(userIdHeader));
    if (found && found.role === 'student' && (!tokenHeader || found.sessionToken !== tokenHeader)) {
      sessionInvalid = true;
    }
  }

  res.json({
    data: getPublicBootstrap(user?.role === 'admin'),
    user: user ? sanitizeUser(user) : null,
    sessionInvalid,
    installed: isAppInstalled(),
  });
});

// Setup Wizard Status Endpoint
app.get('/api/install/status', (req, res) => {
  const origin = req.get('host') ? `${req.protocol}://${req.get('host')}` : '';
  const rawAppUrl = (process.env.APP_URL || '').trim();
  const suggestedAppUrl =
    /^https?:\/\//i.test(rawAppUrl) && !isPlaceholderEnvValue(rawAppUrl)
      ? rawAppUrl.replace(/\/+$/, '')
      : origin;

  return res.json({
    installed: isAppInstalled(),
    locked: isInstallerLocked(),
    envExists: fs.existsSync(ENV_FILE_PATH),
    dbInitialized: fs.existsSync(DB_FILE_PATH),
    suggestedAppUrl,
    defaults: {
      appName: process.env.APP_NAME || 'ExamPro',
      dbConnection: process.env.DB_CONNECTION || 'mysql',
      dbHost: process.env.DB_HOST || '127.0.0.1',
      dbPort: process.env.DB_PORT || '3306',
      dbDatabase: process.env.DB_DATABASE || 'exampro_v2',
      dbUsername: process.env.DB_USERNAME || '',
      mailHost: process.env.MAIL_HOST || 'smtp.gmail.com',
      mailPort: process.env.MAIL_PORT || '587',
      mailEncryption: process.env.MAIL_ENCRYPTION || 'tls',
      mailFromName: process.env.MAIL_FROM_NAME || 'ExamPro',
      adminEmail: 'jumee89@gmail.com',
    },
  });
});

// One-Click Automatic Setup Endpoint (/install)
app.post('/api/install/setup', (req, res) => {
  const authUser = getAuthUser(req);
  if (isInstallerLocked() && authUser?.role !== 'admin') {
    return res.status(403).json({
      error: 'ExamPro is already installed and locked. Update APP_INSTALLED=false in .env to rerun setup.',
    });
  }

  const appName = String(req.body.appName || 'ExamPro').trim() || 'ExamPro';
  const rawAppUrl = String(req.body.appUrl || '').trim().replace(/\/+$/, '');
  const appUrl =
    rawAppUrl || (req.get('host') ? `${req.protocol}://${req.get('host')}` : 'https://yourdomain.com');

  if (!/^https?:\/\/\S+$/i.test(appUrl)) {
    return res.status(422).json({ error: 'Enter a valid App URL starting with http:// or https://.' });
  }

  const dbConnection = req.body.dbConnection === 'mysql' ? 'mysql' : 'local';
  const dbHost = String(req.body.dbHost || '127.0.0.1').trim() || '127.0.0.1';
  const dbPort = String(req.body.dbPort || '3306').trim() || '3306';
  const dbDatabase = String(req.body.dbDatabase || 'exampro_v2').trim();
  const dbUsername = String(req.body.dbUsername || '').trim();
  const dbPassword = String(req.body.dbPassword || '');

  if (dbConnection === 'mysql' && (!dbDatabase || !dbUsername)) {
    return res.status(422).json({
      error: 'Database Name and Database Username are required when using MySQL credentials.',
    });
  }

  const mailHost = String(req.body.mailHost || 'smtp.gmail.com').trim() || 'smtp.gmail.com';
  const mailPort = String(req.body.mailPort || '587').trim() || '587';
  const mailEncryption = String(req.body.mailEncryption || (mailPort === '465' ? 'ssl' : 'tls')).trim();
  const mailUsername = String(req.body.mailUsername || '').trim();
  const mailPassword = String(req.body.mailPassword || '').trim();
  const mailFromAddress = String(req.body.mailFromAddress || mailUsername).trim();
  const mailFromName = String(req.body.mailFromName || appName).trim() || appName;

  const razorpayKeyId = String(req.body.razorpayKeyId || '').trim();
  const razorpayKeySecret = String(req.body.razorpayKeySecret || '').trim();
  if (razorpayKeyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(razorpayKeyId)) {
    return res.status(422).json({
      error: 'Razorpay Key ID must start with rzp_test_ or rzp_live_.',
    });
  }

  const appKey = `base64:${crypto.randomBytes(32).toString('base64')}`;
  const sessionSecret = crypto.randomBytes(32).toString('hex');
  const otpSecret = crypto.randomBytes(32).toString('hex');

  const preserveGemini =
    process.env.GEMINI_API_KEY && !isPlaceholderEnvValue(process.env.GEMINI_API_KEY)
      ? process.env.GEMINI_API_KEY.trim()
      : '';
  const effectiveRzpKey =
    razorpayKeyId ||
    (process.env.RAZORPAY_KEY_ID && !isPlaceholderEnvValue(process.env.RAZORPAY_KEY_ID)
      ? process.env.RAZORPAY_KEY_ID.trim()
      : '');
  const effectiveRzpSecret =
    razorpayKeySecret ||
    (process.env.RAZORPAY_KEY_SECRET && !isPlaceholderEnvValue(process.env.RAZORPAY_KEY_SECRET)
      ? process.env.RAZORPAY_KEY_SECRET.trim()
      : '');

  const envLines = [
    `APP_NAME=${formatEnvValue(appName)}`,
    `APP_ENV="production"`,
    `APP_KEY=${formatEnvValue(appKey)}`,
    `APP_DEBUG="false"`,
    `APP_URL=${formatEnvValue(appUrl)}`,
    `APP_INSTALLED="true"`,
    `NODE_ENV="production"`,
    `PORT=${formatEnvValue(String(PORT))}`,
    ``,
    `SESSION_SECRET=${formatEnvValue(sessionSecret)}`,
    `OTP_SECRET=${formatEnvValue(otpSecret)}`,
    ``,
    `DB_CONNECTION=${formatEnvValue(dbConnection)}`,
    `DB_HOST=${formatEnvValue(dbHost)}`,
    `DB_PORT=${formatEnvValue(dbPort)}`,
    `DB_DATABASE=${formatEnvValue(dbDatabase)}`,
    `DB_USERNAME=${formatEnvValue(dbUsername)}`,
    `DB_PASSWORD=${formatEnvValue(dbPassword)}`,
    ``,
    `MAIL_MAILER="smtp"`,
    `MAIL_HOST=${formatEnvValue(mailHost)}`,
    `MAIL_PORT=${formatEnvValue(mailPort)}`,
    `MAIL_ENCRYPTION=${formatEnvValue(mailEncryption)}`,
    `MAIL_USERNAME=${formatEnvValue(mailUsername)}`,
    `MAIL_PASSWORD=${formatEnvValue(mailPassword)}`,
    `MAIL_FROM_ADDRESS=${formatEnvValue(mailFromAddress)}`,
    `MAIL_FROM_NAME=${formatEnvValue(mailFromName)}`,
    `OTP_ALLOW_PREVIEW_FALLBACK="true"`,
    ``,
    `RAZORPAY_KEY=${formatEnvValue(effectiveRzpKey)}`,
    `RAZORPAY_SECRET=${formatEnvValue(effectiveRzpSecret)}`,
    `RAZORPAY_KEY_ID=${formatEnvValue(effectiveRzpKey)}`,
    `RAZORPAY_KEY_SECRET=${formatEnvValue(effectiveRzpSecret)}`,
    preserveGemini ? `GEMINI_API_KEY=${formatEnvValue(preserveGemini)}` : `# GEMINI_API_KEY=""`,
    ``,
  ];

  try {
    fs.writeFileSync(ENV_FILE_PATH, envLines.join('\n'), 'utf8');

    // Hydrate process.env immediately so SMTP, Razorpay & APP_URL work without restart
    process.env.APP_NAME = appName;
    process.env.APP_KEY = appKey;
    process.env.APP_URL = appUrl;
    process.env.APP_INSTALLED = 'true';
    process.env.SESSION_SECRET = sessionSecret;
    process.env.OTP_SECRET = otpSecret;
    process.env.DB_CONNECTION = dbConnection;
    process.env.DB_HOST = dbHost;
    process.env.DB_PORT = dbPort;
    process.env.DB_DATABASE = dbDatabase;
    process.env.DB_USERNAME = dbUsername;
    process.env.DB_PASSWORD = dbPassword;
    process.env.MAIL_HOST = mailHost;
    process.env.MAIL_PORT = mailPort;
    process.env.MAIL_ENCRYPTION = mailEncryption;
    process.env.MAIL_USERNAME = mailUsername;
    process.env.MAIL_PASSWORD = mailPassword;
    process.env.MAIL_FROM_ADDRESS = mailFromAddress;
    process.env.MAIL_FROM_NAME = mailFromName;
    if (effectiveRzpKey && effectiveRzpSecret) {
      process.env.RAZORPAY_KEY = effectiveRzpKey;
      process.env.RAZORPAY_SECRET = effectiveRzpSecret;
      process.env.RAZORPAY_KEY_ID = effectiveRzpKey;
      process.env.RAZORPAY_KEY_SECRET = effectiveRzpSecret;
      const db = getDb();
      db.settings.razorpay = { keyId: effectiveRzpKey, keySecret: effectiveRzpSecret };
    }

    const seedResult = ensureInstalledDatabase({ appUrl });
    broadcastDataSync();

    return res.json({
      success: true,
      installed: true,
      appKey,
      adminEmail: seedResult.adminEmail,
      redirectUrl: '/',
      steps: [
        'Generated APP_KEY and security secrets',
        'Wrote configuration to .env file',
        `Initialized database & seeded admin (${seedResult.adminEmail})`,
        'Linked storage directories (public/uploads & data)',
        'Marked APP_INSTALLED=true',
      ],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to complete installation.';
    console.error('Setup Wizard error:', err);
    return res.status(500).json({ error: `Installation failed: ${msg}` });
  }
});

// 1-Tap Google Sign-In
app.post('/api/auth/google', (req, res) => {
  const db = getDb();
  const email = String(req.body.email || '').trim();
  const name = String(req.body.name || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Strict Admin Separation: never create a student profile for admin credentials
  if (isAdminCredentials(email, '', db.settings)) {
    let adminUser = db.users.find(
      (u) => u.role === 'admin' || u.email.toLowerCase() === email.toLowerCase()
    );
    if (!adminUser) {
      const newId = db.users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
      adminUser = {
        id: newId,
        email,
        phone: db.settings.adminPhone || '9906101048',
        name: name || 'ExamPro Admin',
        district: 'Srinagar',
        exam: 'Admin',
        role: 'admin',
        sessionToken: null,
        ownedTestIds: [],
        ownedBundleIds: [],
        mistakes: [],
        bookmarks: [],
        attempts: [],
        joinedAt: today,
        lastActiveDate: today,
      };
      db.users.push(adminUser);
    } else {
      adminUser.role = 'admin';
      adminUser.sessionToken = null;
      adminUser.lastActiveDate = today;
    }
    saveDb();
    broadcastDataSync();
    return res.json({ needsProfile: false, user: sanitizeUser(adminUser) });
  }

  const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    existing.lastActiveDate = today;
    if (existing.role === 'admin' || isAdminCredentials(existing.email, existing.phone, db.settings)) {
      existing.role = 'admin';
      existing.sessionToken = null;
    } else {
      existing.role = 'student';
      const newTok = makeToken();
      existing.sessionToken = newTok;
      revokePreviousStudentSessions(existing, newTok);
    }
    saveDb();
    broadcastDataSync();
    return res.json({ needsProfile: false, user: sanitizeUser(existing) });
  }

  return res.json({
    needsProfile: true,
    email,
    name: name || '',
  });
});

// Email / Password Auth Fallback
app.post('/api/auth/email', (req, res) => {
  const db = getDb();
  const mode = req.body.mode === 'up' ? 'up' : 'in';
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 5) {
    return res.status(400).json({ error: 'Password must be at least 5 characters.' });
  }

  const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (mode === 'in') {
    if (!existing || !verifyPassword(password, existing.password)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const today = new Date().toISOString().slice(0, 10);
    existing.lastActiveDate = today;
    if (existing.role === 'admin' || isAdminCredentials(existing.email, existing.phone, db.settings)) {
      existing.role = 'admin';
      existing.sessionToken = null;
    } else {
      existing.role = 'student';
      const newTok = makeToken();
      existing.sessionToken = newTok;
      revokePreviousStudentSessions(existing, newTok);
    }
    saveDb();
    broadcastDataSync();
    return res.json({ needsProfile: false, user: sanitizeUser(existing) });
  } else {
    if (isAdminCredentials(email, '', db.settings)) {
      return res.status(403).json({
        error: 'Admin accounts cannot register as students. Please sign in directly.',
      });
    }
    if (existing) {
      return res.status(409).json({ error: '⚠️ This email is already registered. Please sign in instead.' });
    }
    return res.json({
      needsProfile: true,
      email,
      name: '',
      password,
    });
  }
});

// Admin Desktop / #admin direct login
app.post('/api/auth/admin-login', (req, res) => {
  const db = getDb();
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');
  const adminUser = db.users.find(
    (u) =>
      u.role === 'admin' &&
      (u.email.toLowerCase() === identifier.toLowerCase() || u.phone === identifier) &&
      verifyPassword(password, u.password || 'Loading@786')
  );
  if (!adminUser) {
    return res.status(401).json({ error: 'Wrong admin email/mobile or password.' });
  }
  saveDb();
  return res.json({ user: sanitizeUser(adminUser) });
});

// Admin Password Update (inside existing Admin Credentials section)
app.put('/api/admin/password', (req, res) => {
  const adminUser = requireAdmin(req, res);
  if (!adminUser) return;
  const db = getDb();

  const currentPassword = String(req.body.currentPassword ?? req.body.current_password ?? '');
  const newPassword = String(req.body.newPassword ?? req.body.new_password ?? '');
  const confirmPassword = String(
    req.body.confirmPassword ?? req.body.new_password_confirmation ?? newPassword
  );

  if (!currentPassword) {
    return res.status(422).json({ error: 'Please enter your current password.' });
  }
  if (!verifyPassword(currentPassword, adminUser.password || 'Loading@786')) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  if (newPassword.length < 6) {
    return res.status(422).json({ error: 'New password must be at least 6 characters.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(422).json({ error: 'New password and confirmation do not match.' });
  }
  if (verifyPassword(newPassword, adminUser.password || '')) {
    return res.status(422).json({ error: 'New password must be different from your current password.' });
  }

  adminUser.password = hashPassword(newPassword);
  const storedAdmin = db.users.find((u) => u.id === adminUser.id);
  if (storedAdmin) {
    storedAdmin.password = adminUser.password;
  }
  saveDb();
  return res.json({ ok: true, message: 'Admin password updated securely.' });
});

// One-Time Production Cleanup: Deletes all demo/non-admin data while preserving Admin (jumee89@gmail.com) & Settings
app.post('/api/admin/clean-demo-data', (req, res) => {
  const adminUser = requireAdmin(req, res);
  if (!adminUser) return;

  const confirmPassword = String(req.body.password ?? req.body.currentPassword ?? '');
  if (!confirmPassword) {
    return res.status(422).json({ error: 'Please enter your admin password to confirm cleanup.' });
  }
  if (!verifyPassword(confirmPassword, adminUser.password || 'Loading@786')) {
    return res.status(401).json({ error: 'Incorrect admin password. Cleanup aborted.' });
  }

  const deletedCounts = cleanProductionData();
  broadcastDataSync();
  return res.json({
    ok: true,
    deletedCounts,
    message: 'Demo data cleared safely. Admin account (jumee89@gmail.com) and all settings preserved.',
  });
});

// Step 1: Send Real 6-Digit Gmail OTP for Student Login
app.post('/api/v1/auth/send-otp', async (req, res) => {
  const db = getDb();
  const email = String(req.body.email || '').trim().toLowerCase();

  if (!/^[a-z0-9._%+-]+@gmail\.com$/i.test(email)) {
    return res.status(422).json({ error: 'Please enter a valid @gmail.com address.' });
  }
  if (isAdminCredentials(email, '', db.settings)) {
    return res.status(403).json({
      error: 'Admin accounts cannot log into the student portal via OTP. Please use the Admin Console.',
    });
  }

  const now = Date.now();
  db.otpRecords = (db.otpRecords || []).filter((r) => r.expiresAt > now && r.email.toLowerCase() !== email);

  const otp = String(crypto.randomInt(100000, 1000000));
  const record: OtpRecord = {
    email,
    otpHash: hashOtpCode(email, otp),
    expiresAt: now + 5 * 60 * 1000,
    attempts: 0,
    createdAt: now,
  };
  db.otpRecords.push(record);
  saveDb();

  try {
    const mailResult = await sendGmailOtpEmail(email, otp);
    if (mailResult.sent) {
      return res.json({
        success: true,
        message: `A 6-digit verification OTP has been sent to ${email}.`,
        expiresInSeconds: 300,
        smtpConfigured: true,
      });
    }
    return res.json({
      success: true,
      message: `SMTP credentials are not configured yet — preview OTP generated for ${email}.`,
      expiresInSeconds: 300,
      smtpConfigured: false,
      previewOtp: otp,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send OTP email.';
    console.error('Gmail OTP SMTP error:', msg);
    if (process.env.OTP_ALLOW_PREVIEW_FALLBACK !== 'false') {
      return res.json({
        success: true,
        message: `SMTP delivery could not complete right now — fallback preview OTP generated for ${email}.`,
        expiresInSeconds: 300,
        smtpConfigured: false,
        smtpFallback: true,
        previewOtp: otp,
      });
    }
    return res.status(502).json({ error: `Unable to send OTP email: ${msg}` });
  }
});

// Step 2: Verify 6-Digit Gmail OTP & Log In Student
app.post('/api/v1/auth/verify-otp', (req, res) => {
  const db = getDb();
  const email = String(req.body.email || '').trim().toLowerCase();
  const otp = String(req.body.otp || '').replace(/\D/g, '').trim();

  if (!/^[a-z0-9._%+-]+@gmail\.com$/i.test(email)) {
    return res.status(422).json({ error: 'Please enter a valid @gmail.com address.' });
  }
  if (!/^\d{6}$/.test(otp)) {
    return res.status(422).json({ error: 'Enter the 6-digit OTP code sent to your Gmail.' });
  }
  if (isAdminCredentials(email, '', db.settings)) {
    return res.status(403).json({
      error: 'Admin accounts cannot log into the student portal via OTP.',
    });
  }

  const now = Date.now();
  db.otpRecords = db.otpRecords || [];
  const idx = db.otpRecords.findIndex((r) => r.email.toLowerCase() === email);
  if (idx < 0) {
    return res.status(401).json({ error: 'No active OTP found for this Gmail. Please request a new code.' });
  }

  const rec = db.otpRecords[idx];
  if (rec.expiresAt <= now) {
    db.otpRecords.splice(idx, 1);
    saveDb();
    return res.status(401).json({ error: 'This OTP has expired (5-minute limit). Please resend a new OTP.' });
  }

  const expectedHex = rec.otpHash;
  const actualHex = hashOtpCode(email, otp);
  let matched = false;
  try {
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(actualHex, 'hex');
    matched = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    matched = false;
  }

  if (!matched) {
    rec.attempts += 1;
    if (rec.attempts >= 5) {
      db.otpRecords.splice(idx, 1);
      saveDb();
      return res.status(429).json({
        error: 'Too many invalid OTP attempts. Please request a new 6-digit code.',
      });
    }
    saveDb();
    return res.status(401).json({
      error: `Invalid OTP code. ${5 - rec.attempts} attempt(s) remaining.`,
    });
  }

  // Consume OTP once verified
  db.otpRecords.splice(idx, 1);

  const today = new Date().toISOString().slice(0, 10);
  const existing = db.users.find((u) => u.email.toLowerCase() === email);
  if (existing) {
    existing.role = 'student';
    existing.lastActiveDate = today;
    const newTok = makeToken();
    existing.sessionToken = newTok;
    revokePreviousStudentSessions(existing, newTok);
    saveDb();
    broadcastDataSync();
    return res.json({
      success: true,
      otpVerified: true,
      needsProfile: false,
      token: newTok,
      user: sanitizeUser(existing),
    });
  }

  saveDb();
  return res.json({
    success: true,
    otpVerified: true,
    needsProfile: true,
    email,
    name: '',
  });
});

// Complete 1-step profile for new students (Mandatory 10-digit mobile + strict unique check)
app.post('/api/auth/complete-profile', (req, res) => {
  const db = getDb();
  const email = String(req.body.email || '').trim();
  const phone = String(req.body.phone || '').replace(/\D/g, '');
  const name = String(req.body.name || '').trim();
  const district = String(req.body.district || '').trim();
  const exam = String(req.body.exam || '').trim();
  const password = String(req.body.password || '');

  if (isAdminCredentials(email, phone, db.settings)) {
    return res.status(403).json({
      error: 'Admin accounts cannot create a student profile. Please sign in via the Admin Console.',
    });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '⚠️ Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.' });
  }
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: '⚠️ This email is already registered with another account.' });
  }
  if (db.users.some((u) => u.phone === phone)) {
    return res.status(409).json({
      error: '⚠️ This mobile number is already registered with another account. Please login with your original Google account.',
    });
  }
  if (name.length < 2) {
    return res.status(400).json({ error: 'Enter your full name.' });
  }
  if (!district) {
    return res.status(400).json({ error: 'Select your district.' });
  }
  if (!exam) {
    return res.status(400).json({ error: 'Enter your target exam.' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const newId = db.users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
  const newUser: UserRecord = {
    id: newId,
    email,
    phone,
    name,
    district,
    exam,
    role: 'student',
    password: password ? hashPassword(password) : undefined,
    sessionToken: makeToken(),
    ownedTestIds: [],
    ownedBundleIds: [],
    mistakes: [],
    bookmarks: [],
    attempts: [],
    joinedAt: today,
    lastActiveDate: today,
  };
  db.users.push(newUser);
  saveDb();
  broadcastDataSync();
  return res.json({ user: sanitizeUser(newUser) });
});

// Update profile
app.put('/api/profile', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  const db = getDb();

  const phone = String(req.body.phone || '').replace(/\D/g, '');
  const name = String(req.body.name || '').trim();
  const district = String(req.body.district || '').trim();
  const exam = String(req.body.exam || '').trim();

  if (!/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '⚠️ Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.' });
  }
  if (db.users.some((u) => u.id !== user.id && u.phone === phone)) {
    return res.status(409).json({
      error: '⚠️ This mobile number is already registered with another account. Please login with your original Google account.',
    });
  }
  if (name.length < 2 || !district || !exam) {
    return res.status(400).json({ error: 'All profile fields are required.' });
  }

  user.phone = phone;
  user.name = name;
  user.district = district;
  user.exam = exam;
  if (isAdminCredentials(user.email, user.phone, db.settings)) {
    user.role = 'admin';
    user.sessionToken = null;
  }
  saveDb();
  broadcastDataSync();
  return res.json({ user: sanitizeUser(user) });
});

// Submit Test
app.post('/api/tests/:id/submit', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  const db = getDb();
  const testId = Number(req.params.id);
  const test = db.tests.find((t) => t.id === testId);
  if (!test) return res.status(404).json({ error: 'Test not found.' });

  const answers: Record<number, number> = req.body.answers || {};
  const timeSec = Math.max(1, Number(req.body.timeSec || 60));

  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const subjectBreakdown: Record<string, { correct: number; total: number }> = {};

  test.qs.forEach((q, idx) => {
    const subj = q.subj || 'General';
    if (!subjectBreakdown[subj]) subjectBreakdown[subj] = { correct: 0, total: 0 };
    subjectBreakdown[subj].total += 1;

    const sel = answers[idx];
    if (sel === undefined || sel === null) {
      skipped += 1;
    } else if (sel === q.c) {
      correct += 1;
      subjectBreakdown[subj].correct += 1;
    } else {
      wrong += 1;
      if (!user.mistakes.some((m) => m.t.toLowerCase() === q.t.toLowerCase())) {
        const tags = normalizePreviousExams(getPreviousExams(q));
        user.mistakes.unshift({
          id: `m-${Date.now()}-${idx}`,
          t: q.t,
          o: q.o,
          c: q.c,
          sel,
          e: q.e,
          subj: q.subj,
          testTitle: test.title,
          previous_exams: tags,
          examRef: tags ?? [],
          addedAt: formatNowDisplay(),
        });
      }
    }
  });

  const maxScore = test.qs.length * 4;
  const score = Math.max(0, Number((correct * 4 - wrong * test.neg).toFixed(2)));

  const entry: TestResultEntry = {
    id: `res-${Date.now()}`,
    testId: test.id,
    userId: user.id,
    name: user.name,
    district: user.district,
    targetExam: user.exam,
    score,
    maxScore,
    correct,
    wrong,
    skipped,
    timeSec,
    subjectBreakdown,
    date: formatNowDisplay(),
  };

  db.results.push(entry);
  test.attemptCount = (test.attemptCount || 0) + 1;

  // Compute Ranks & Percentile
  const testResults = db.results
    .filter((r) => r.testId === test.id)
    .sort((a, b) => b.score - a.score || a.timeSec - b.timeSec);
  const rank = testResults.findIndex((r) => r.id === entry.id) + 1;
  const totalParticipants = testResults.length;
  const percentile = totalParticipants > 1 ? Math.round(((totalParticipants - rank) / (totalParticipants - 1)) * 100) : 100;

  const distResults = testResults.filter((r) => r.district === user.district);
  const districtRank = distResults.findIndex((r) => r.id === entry.id) + 1;
  const districtTotal = distResults.length;

  const summary = {
    id: entry.id,
    testId: test.id,
    testTitle: test.title,
    score,
    maxScore,
    correct,
    wrong,
    skipped,
    rank,
    totalParticipants,
    districtRank,
    districtTotal,
    percentile,
    date: entry.date,
  };
  user.attempts.unshift(summary);
  saveDb();
  broadcastDataSync();

  return res.json({
    result: entry,
    summary,
    user: sanitizeUser(user),
  });
});

// Mistake Notebook Re-practice (auto-remove if solved correctly!)
app.post('/api/mistakes/practice', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  const mistakeId = String(req.body.mistakeId || '');
  const selected = Number(req.body.selected);

  const idx = user.mistakes.findIndex((m) => m.id === mistakeId);
  if (idx < 0) return res.status(404).json({ error: 'Mistake not found.' });
  const item = user.mistakes[idx];
  const isCorrect = selected === item.c;
  if (isCorrect) {
    user.mistakes.splice(idx, 1);
    saveDb();
  }
  return res.json({
    isCorrect,
    removed: isCorrect,
    user: sanitizeUser(user),
  });
});

app.delete('/api/mistakes/:id', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  user.mistakes = user.mistakes.filter((m) => m.id !== req.params.id);
  saveDb();
  return res.json({ user: sanitizeUser(user) });
});

// Bookmark Toggle
app.post('/api/bookmarks/toggle', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  const q: Question = req.body.question;
  const testTitle = String(req.body.testTitle || 'Mock Test');
  if (!q || !q.t) return res.status(400).json({ error: 'Invalid question.' });

  const idx = user.bookmarks.findIndex((b) => b.t.toLowerCase() === q.t.toLowerCase());
  if (idx >= 0) {
    user.bookmarks.splice(idx, 1);
  } else {
    const tags = normalizePreviousExams(getPreviousExams(q));
    user.bookmarks.unshift({
      id: `bm-${Date.now()}`,
      t: q.t,
      o: q.o,
      c: q.c,
      e: q.e,
      subj: q.subj,
      testTitle,
      previous_exams: tags,
      examRef: tags ?? [],
    });
  }
  saveDb();
  return res.json({ user: sanitizeUser(user) });
});

// Report Question
app.post('/api/reports', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  const db = getDb();
  const report: ReportedQuestion = {
    id: `rep-${Date.now()}`,
    testId: Number(req.body.testId || 0),
    testTitle: String(req.body.testTitle || 'Mock Test'),
    questionId: String(req.body.questionId || ''),
    questionText: String(req.body.questionText || ''),
    reporterId: user.id,
    reporterName: user.name,
    reason: String(req.body.reason || '').trim() || 'Needs review',
    status: 'pending',
    createdAt: formatNowDisplay(),
  };
  db.reportedQuestions.unshift(report);
  saveDb();
  broadcastDataSync();
  return res.json({ report });
});

// Submit Support Ticket
app.post('/api/support', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  const db = getDb();
  const ticket: SupportTicket = {
    id: `tic-${Date.now()}`,
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    userEmail: user.email,
    orderId: req.body.orderId ? String(req.body.orderId).trim() : undefined,
    subject: String(req.body.subject || 'Student Support').trim(),
    message: String(req.body.message || '').trim(),
    status: 'pending',
    createdAt: formatNowDisplay(),
  };
  if (!ticket.message) return res.status(400).json({ error: 'Please write your message.' });
  db.supportTickets.unshift(ticket);
  saveDb();
  broadcastDataSync();
  return res.json({ ticket });
});

const DEFAULT_RAZORPAY_TEST_KEY = 'rzp_test_U0BeEUWzulR4eN';
const DEFAULT_RAZORPAY_TEST_SECRET = 'wQLJjC1CclgCYsrwpRyla3jG';

function getRazorpayConfig() {
  const db = getDb();
  const dbKey = (db.settings?.razorpay?.keyId || '').trim();
  const dbSecret = (db.settings?.razorpay?.keySecret || '').trim();
  if (/^rzp_(test|live)_[A-Za-z0-9]+$/.test(dbKey) && dbSecret.length >= 16) {
    return {
      keyId: dbKey,
      keySecret: dbSecret,
      source: 'database' as const,
    };
  }

  const envKey = (process.env.RAZORPAY_KEY || process.env.RAZORPAY_KEY_ID || '').trim();
  const envSecret = (process.env.RAZORPAY_SECRET || process.env.RAZORPAY_KEY_SECRET || '').trim();
  const hasValidEnvPair =
    /^rzp_(test|live)_[A-Za-z0-9]+$/.test(envKey) &&
    envSecret.length >= 16 &&
    !/^(MY_|YOUR_|placeholder|test_secret)/i.test(envSecret);

  return {
    keyId: hasValidEnvPair ? envKey : DEFAULT_RAZORPAY_TEST_KEY,
    keySecret: hasValidEnvPair ? envSecret : DEFAULT_RAZORPAY_TEST_SECRET,
    source: hasValidEnvPair ? ('env' as const) : ('default_test' as const),
  };
}

function grantItemAccessToUser(user: UserRecord, itemType: 'test' | 'bundle', itemId: number) {
  const db = getDb();
  if (itemType === 'bundle') {
    if (!user.ownedBundleIds.includes(itemId)) user.ownedBundleIds.push(itemId);
    const bundle = db.bundles.find((b) => b.id === itemId);
    if (bundle) {
      for (const tid of bundle.testIds) {
        if (!user.ownedTestIds.includes(tid)) user.ownedTestIds.push(tid);
      }
    }
  } else {
    if (!user.ownedTestIds.includes(itemId)) user.ownedTestIds.push(itemId);
  }
}

function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  keySecret: string
): boolean {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) return false;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(razorpaySignature.trim(), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Validate Coupon
app.post('/api/coupons/validate', (req, res) => {
  const db = getDb();
  const code = String(req.body.code || '').trim().toUpperCase();
  const amount = Number(req.body.amount || 0);
  const coupon = db.coupons.find((c) => c.code.toUpperCase() === code && c.active);
  if (!coupon) return res.status(404).json({ error: 'Invalid or inactive coupon code.' });
  if (coupon.usedCount >= coupon.maxUses) return res.status(400).json({ error: 'Coupon usage limit reached.' });
  if (coupon.expiryDate && coupon.expiryDate < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: 'This coupon has expired.' });
  }
  let discount = 0;
  if (coupon.type === 'free') discount = amount;
  else if (coupon.type === 'percent') discount = Math.round((amount * coupon.value) / 100);
  else discount = Math.min(amount, coupon.value);
  const finalAmount = Math.max(0, amount - discount);
  return res.json({ coupon, discount, finalAmount });
});

// Automated Razorpay Order Creation (POST /api/v1/payments/create-order)
app.post(['/api/v1/payments/create-order', '/api/payments/create-order'], async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  const db = getDb();

  const rawItemType = req.body.itemType ?? req.body.item_type ?? (req.body.bundle_id ? 'bundle' : 'test');
  const itemType: 'test' | 'bundle' = rawItemType === 'bundle' ? 'bundle' : 'test';
  const itemId = Number(req.body.itemId ?? req.body.item_id ?? req.body.test_id ?? req.body.bundle_id);
  const couponRaw = req.body.couponCode ?? req.body.coupon_code;
  const couponCode = couponRaw ? String(couponRaw).trim().toUpperCase() : undefined;

  let itemTitle = '';
  let originalAmount = 0;

  if (itemType === 'bundle') {
    const bundle = db.bundles.find((b) => b.id === itemId);
    if (!bundle) return res.status(404).json({ error: 'Bundle not found.' });
    itemTitle = bundle.title;
    originalAmount = bundle.price;
  } else {
    const test = db.tests.find((t) => t.id === itemId);
    if (!test) return res.status(404).json({ error: 'Test not found.' });
    itemTitle = test.title;
    originalAmount = test.price;
  }

  let discountAmount = 0;
  let appliedCoupon: Coupon | undefined;
  if (couponCode) {
    appliedCoupon = db.coupons.find((c) => c.code.toUpperCase() === couponCode && c.active);
    if (appliedCoupon && appliedCoupon.usedCount < appliedCoupon.maxUses) {
      const today = new Date().toISOString().slice(0, 10);
      if (!appliedCoupon.expiryDate || appliedCoupon.expiryDate >= today) {
        if (appliedCoupon.type === 'free') discountAmount = originalAmount;
        else if (appliedCoupon.type === 'percent') {
          discountAmount = Math.round((originalAmount * appliedCoupon.value) / 100);
        } else {
          discountAmount = Math.min(originalAmount, appliedCoupon.value);
        }
      }
    }
  }

  const finalAmount = Math.max(0, originalAmount - discountAmount);
  const orderNumber = `EXP-${Math.floor(100000 + Math.random() * 900000)}`;

  // 100% Free Coupon Instant Unlock (no gateway charge needed)
  if (finalAmount === 0) {
    if (appliedCoupon) appliedCoupon.usedCount += 1;
    const freeOrder: PaymentOrder = {
      id: `pay-${Date.now()}`,
      orderNumber,
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      itemType,
      itemId,
      itemTitle,
      originalAmount,
      discountAmount,
      finalAmount: 0,
      couponCode: appliedCoupon?.code,
      paymentMethod: 'FREE_COUPON',
      status: 'PAID',
      createdAt: formatNowDisplay(),
      verifiedAt: formatNowDisplay(),
    };
    db.payments.unshift(freeOrder);
    grantItemAccessToUser(user, itemType, itemId);
    saveDb();
    broadcastDataSync();
    return res.json({
      freeUnlock: true,
      order: freeOrder,
      user: sanitizeUser(user),
    });
  }

  const primaryConfig = getRazorpayConfig();
  const amountInPaise = Math.round(finalAmount * 100);
  const upiFlow = (req.body.upiFlow ?? req.body.upi_flow) === 'qr' ? 'qr' : 'intent';
  let activeKeyId = primaryConfig.keyId;
  let razorpayOrderId = '';
  let razorpayErrorMessage = '';

  if (amountInPaise < 100) {
    return res.status(422).json({
      success: false,
      error: 'Minimum payable amount for Razorpay is ₹1 (100 paise).',
    });
  }

  const candidateCreds =
    primaryConfig.keyId === DEFAULT_RAZORPAY_TEST_KEY &&
    primaryConfig.keySecret === DEFAULT_RAZORPAY_TEST_SECRET
      ? [primaryConfig]
      : [
          primaryConfig,
          { keyId: DEFAULT_RAZORPAY_TEST_KEY, keySecret: DEFAULT_RAZORPAY_TEST_SECRET },
        ];

  for (const creds of candidateCreds) {
    try {
      const authHeader = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
      const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        signal: AbortSignal.timeout(12000),
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: orderNumber,
          payment_capture: 1,
          notes: {
            item_type: itemType,
            item_id: String(itemId),
            user_id: String(user.id),
            student_name: user.name,
            preferred_upi_flow: upiFlow,
          },
        }),
      });

      const rzpData = (await rzpResponse.json().catch(() => ({}))) as {
        id?: string;
        error?: { description?: string; code?: string };
      };
      if (rzpResponse.ok && rzpData.id) {
        razorpayOrderId = rzpData.id;
        activeKeyId = creds.keyId;
        break;
      }
      razorpayErrorMessage =
        rzpData.error?.description || `Razorpay order creation failed (${rzpResponse.status}).`;
      console.error('Razorpay order creation attempt failed:', rzpResponse.status, rzpData);
    } catch (err: unknown) {
      razorpayErrorMessage =
        err instanceof Error ? err.message : 'Unable to reach Razorpay Orders API.';
      console.error('Razorpay network exception:', razorpayErrorMessage);
    }
  }

  if (!razorpayOrderId) {
    return res.status(502).json({
      success: false,
      error: razorpayErrorMessage || 'Could not initialize Razorpay order. Please try again.',
    });
  }

  const order: PaymentOrder = {
    id: `pay-${Date.now()}`,
    orderNumber,
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    itemType,
    itemId,
    itemTitle,
    originalAmount,
    discountAmount,
    finalAmount,
    couponCode: appliedCoupon?.code,
    razorpayOrderId,
    paymentMethod: 'RAZORPAY',
    status: 'CREATED',
    createdAt: formatNowDisplay(),
  };

  db.payments.unshift(order);
  saveDb();
  broadcastDataSync();

  return res.json({
    success: true,
    status: 'created',
    freeUnlock: false,
    key: activeKeyId,
    keyId: activeKeyId,
    order_id: razorpayOrderId,
    razorpay_order_id: razorpayOrderId,
    razorpayOrderId,
    test_id: itemType === 'test' ? itemId : undefined,
    amount: amountInPaise,
    finalAmount,
    currency: 'INR',
    upiFlow,
    order,
    prefill: {
      name: user.name,
      email: user.email || '',
      contact: user.phone || '',
    },
  });
});

// Automated Razorpay HMAC SHA256 Signature Verification (POST /api/v1/payments/verify)
app.post(['/api/v1/payments/verify', '/api/payments/verify'], (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  const db = getDb();

  const razorpayOrderId = String(req.body.razorpay_order_id || '').trim();
  const razorpayPaymentId = String(req.body.razorpay_payment_id || '').trim();
  const razorpaySignature = String(req.body.razorpay_signature || '').trim();

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(422).json({ error: 'Missing Razorpay verification parameters.' });
  }

  const order = db.payments.find(
    (p) => p.razorpayOrderId === razorpayOrderId && p.userId === user.id
  );
  if (!order) {
    return res.status(404).json({ error: 'Matching Razorpay order not found.' });
  }

  const { keySecret } = getRazorpayConfig();
  const isValid =
    verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, keySecret) ||
    verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      DEFAULT_RAZORPAY_TEST_SECRET
    );

  if (!isValid) {
    order.status = 'FAILED';
    saveDb();
    broadcastDataSync();
    return res.status(400).json({ error: 'Invalid Razorpay HMAC SHA256 payment signature.' });
  }

  if (order.status !== 'PAID') {
    order.status = 'PAID';
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    order.verifiedAt = formatNowDisplay();

    if (order.couponCode) {
      const coupon = db.coupons.find(
        (c) => c.code.toUpperCase() === order.couponCode?.toUpperCase()
      );
      if (coupon) coupon.usedCount += 1;
    }

    grantItemAccessToUser(user, order.itemType, order.itemId);
    saveDb();
    broadcastDataSync();
  }

  return res.json({
    status: 'paid',
    message: 'Payment verified and test unlocked immediately.',
    order,
    user: sanitizeUser(user),
  });
});

// Record failed/cancelled Razorpay attempt without unlocking content
app.post(['/api/v1/payments/mark-failed', '/api/payments/mark-failed'], (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  const db = getDb();

  const razorpayOrderId = String(req.body.razorpay_order_id || '').trim();
  const order = db.payments.find(
    (p) => p.razorpayOrderId === razorpayOrderId && p.userId === user.id
  );
  if (order && order.status === 'CREATED') {
    order.status = 'FAILED';
    saveDb();
    broadcastDataSync();
  }

  return res.json({ status: 'failed' });
});

// Legacy Direct UPI Submit endpoint (kept for backwards compatibility)
app.post('/api/payments/submit', (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  const db = getDb();

  const itemType: 'test' | 'bundle' = req.body.itemType === 'bundle' ? 'bundle' : 'test';
  const itemId = Number(req.body.itemId);
  const couponCode = req.body.couponCode ? String(req.body.couponCode).trim().toUpperCase() : undefined;
  const utrNumber = req.body.utrNumber ? String(req.body.utrNumber).trim() : undefined;
  const screenshotUrl = req.body.screenshotUrl ? String(req.body.screenshotUrl) : undefined;

  let itemTitle = '';
  let originalAmount = 0;

  if (itemType === 'bundle') {
    const bundle = db.bundles.find((b) => b.id === itemId);
    if (!bundle) return res.status(404).json({ error: 'Bundle not found.' });
    itemTitle = bundle.title;
    originalAmount = bundle.price;
  } else {
    const test = db.tests.find((t) => t.id === itemId);
    if (!test) return res.status(404).json({ error: 'Test not found.' });
    itemTitle = test.title;
    originalAmount = test.price;
  }

  let discountAmount = 0;
  let appliedCoupon: Coupon | undefined;
  if (couponCode) {
    appliedCoupon = db.coupons.find((c) => c.code.toUpperCase() === couponCode && c.active);
    if (appliedCoupon && appliedCoupon.usedCount < appliedCoupon.maxUses) {
      if (appliedCoupon.type === 'free') discountAmount = originalAmount;
      else if (appliedCoupon.type === 'percent') discountAmount = Math.round((originalAmount * appliedCoupon.value) / 100);
      else discountAmount = Math.min(originalAmount, appliedCoupon.value);
    }
  }

  const finalAmount = Math.max(0, originalAmount - discountAmount);

  if (finalAmount > 0 && (!utrNumber || !/^[A-Za-z0-9]{8,22}$/.test(utrNumber))) {
    return res.status(400).json({ error: 'Please enter a valid 12-digit UPI UTR / Transaction ID.' });
  }

  if (appliedCoupon) {
    appliedCoupon.usedCount += 1;
  }

  const isFreeUnlock = finalAmount === 0;
  const order: PaymentOrder = {
    id: `pay-${Date.now()}`,
    orderNumber: `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    itemType,
    itemId,
    itemTitle,
    originalAmount,
    discountAmount,
    finalAmount,
    couponCode: appliedCoupon?.code,
    utrNumber: isFreeUnlock ? undefined : utrNumber,
    screenshotUrl,
    paymentMethod: isFreeUnlock ? 'FREE_COUPON' : 'UPI',
    status: isFreeUnlock ? 'PAID' : 'PENDING_VERIFICATION',
    createdAt: formatNowDisplay(),
    verifiedAt: isFreeUnlock ? formatNowDisplay() : undefined,
  };

  db.payments.unshift(order);

  if (isFreeUnlock) {
    grantItemAccessToUser(user, itemType, itemId);
  }

  saveDb();
  broadcastDataSync();

  return res.json({
    order,
    user: sanitizeUser(user),
  });
});

// ================= ADMIN ROUTES =================

app.post('/api/admin/tests', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const body = req.body as Partial<MockTest>;
  const rawQs = Array.isArray(body.qs) ? body.qs : [];
  const validatedQs: Question[] = [];
  for (const q of rawQs) {
    const check = validateAndSyncQuestion(q);
    if (!check.ok) {
      return res.status(422).json({ error: check.error });
    }
    validatedQs.push(check.question);
  }

  const title = String(body.title || '').trim();
  if (!title) {
    return res.status(422).json({ error: 'Test title is required.' });
  }

  const newId = db.tests.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  const test: MockTest = {
    id: newId,
    cat: body.cat || 'latest',
    exam: body.exam || db.exams[0] || '',
    title,
    testType: body.testType === 'sectional' ? 'sectional' : 'full',
    subject: body.testType === 'sectional' ? body.subject : undefined,
    paid: Boolean(body.paid),
    price: body.paid ? Math.max(0, Number(body.price || 0)) : 0,
    dur: Math.max(1, Number(body.dur || 60)),
    neg: Math.max(0, Number(body.neg ?? 0.25)),
    sched: body.sched ? String(body.sched).trim() : new Date().toISOString().slice(0, 16),
    status: body.status || 'draft',
    desc: String(body.desc || '').trim(),
    syllabusTag: String(body.syllabusTag || '').trim(),
    language: String(body.language || 'English').trim(),
    attemptCount: Number(body.attemptCount || 0),
    bundleId: body.bundleId ? Number(body.bundleId) : null,
    qs: validatedQs,
  };
  db.tests.unshift(test);
  if (test.bundleId) {
    const bundle = db.bundles.find((b) => b.id === test.bundleId);
    if (bundle && !bundle.testIds.includes(test.id)) bundle.testIds.push(test.id);
  }
  saveDb();
  broadcastDataSync();
  return res.json({ test });
});

app.put('/api/admin/tests/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const id = Number(req.params.id);
  const idx = db.tests.findIndex((t) => t.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Test not found.' });

  const incomingQs = Array.isArray(req.body.qs) ? (req.body.qs as Question[]) : db.tests[idx].qs;
  const validatedQs: Question[] = [];
  for (const q of incomingQs) {
    const check = validateAndSyncQuestion(q);
    if (!check.ok) {
      return res.status(422).json({ error: check.error });
    }
    validatedQs.push(check.question);
  }

  const updated: MockTest = { ...db.tests[idx], ...req.body, qs: validatedQs, id };
  db.tests[idx] = updated;

  // Sync bundle testIds
  db.bundles.forEach((b) => {
    if (updated.bundleId === b.id) {
      if (!b.testIds.includes(id)) b.testIds.push(id);
    } else {
      b.testIds = b.testIds.filter((tid) => tid !== id);
    }
  });

  saveDb();
  broadcastDataSync();
  return res.json({ test: updated });
});

app.delete('/api/admin/tests/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const id = Number(req.params.id);
  db.tests = db.tests.filter((t) => t.id !== id);
  db.bundles.forEach((b) => {
    b.testIds = b.testIds.filter((tid) => tid !== id);
  });
  saveDb();
  broadcastDataSync();
  return res.json({ ok: true });
});

// Bundles
app.post('/api/admin/bundles', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const title = String(req.body.title || '').trim();
  if (!title) {
    return res.status(422).json({ error: 'Bundle title is required.' });
  }
  const newId = db.bundles.reduce((m, b) => Math.max(m, b.id), 0) + 1;
  const bundle: TestBundle = {
    id: newId,
    title,
    exam: String(req.body.exam || db.exams[0] || '').trim(),
    desc: String(req.body.desc || '').trim(),
    price: Math.max(0, Number(req.body.price || 0)),
    mrp: Math.max(0, Number(req.body.mrp || 0)),
    validity: String(req.body.validity || '').trim(),
    bundleOnly: Boolean(req.body.bundleOnly),
    testIds: Array.isArray(req.body.testIds) ? req.body.testIds.map(Number) : [],
    featured: Boolean(req.body.featured),
  };
  db.bundles.unshift(bundle);
  saveDb();
  broadcastDataSync();
  return res.json({ bundle });
});

app.put('/api/admin/bundles/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const id = Number(req.params.id);
  const idx = db.bundles.findIndex((b) => b.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Bundle not found.' });
  db.bundles[idx] = { ...db.bundles[idx], ...req.body, id };
  saveDb();
  broadcastDataSync();
  return res.json({ bundle: db.bundles[idx] });
});

app.delete('/api/admin/bundles/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const id = Number(req.params.id);
  db.bundles = db.bundles.filter((b) => b.id !== id);
  saveDb();
  broadcastDataSync();
  return res.json({ ok: true });
});

// Payments Approval / Rejection / Manual Unlock
function unlockOrderForUser(order: PaymentOrder) {
  const db = getDb();
  const user = db.users.find((u) => u.id === order.userId);
  if (!user) return;
  if (order.itemType === 'bundle') {
    if (!user.ownedBundleIds.includes(order.itemId)) user.ownedBundleIds.push(order.itemId);
    const bundle = db.bundles.find((b) => b.id === order.itemId);
    if (bundle) {
      for (const tid of bundle.testIds) {
        if (!user.ownedTestIds.includes(tid)) user.ownedTestIds.push(tid);
      }
    }
  } else {
    if (!user.ownedTestIds.includes(order.itemId)) user.ownedTestIds.push(order.itemId);
  }
}

app.post('/api/admin/payments/:id/approve', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const order = db.payments.find((p) => p.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  order.status = 'PAID';
  order.verifiedAt = formatNowDisplay();
  unlockOrderForUser(order);
  saveDb();
  broadcastDataSync();
  return res.json({ order });
});

app.post('/api/admin/payments/:id/reject', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const order = db.payments.find((p) => p.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  order.status = 'REJECTED';
  order.verifiedAt = formatNowDisplay();
  saveDb();
  broadcastDataSync();
  return res.json({ order });
});

app.post('/api/admin/payments/manual-unlock', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const userId = Number(req.body.userId);
  const itemType = req.body.itemType === 'bundle' ? 'bundle' : 'test';
  const itemId = Number(req.body.itemId);
  const user = db.users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'Student not found.' });

  if (itemType === 'bundle') {
    if (!user.ownedBundleIds.includes(itemId)) user.ownedBundleIds.push(itemId);
    const b = db.bundles.find((x) => x.id === itemId);
    if (b) {
      b.testIds.forEach((tid) => {
        if (!user.ownedTestIds.includes(tid)) user.ownedTestIds.push(tid);
      });
    }
  } else {
    if (!user.ownedTestIds.includes(itemId)) user.ownedTestIds.push(itemId);
  }
  saveDb();
  broadcastDataSync();
  return res.json({ ok: true });
});

// Coupons
app.post('/api/admin/coupons', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Coupon code is required.' });
  if (db.coupons.some((c) => c.code.toUpperCase() === code)) {
    return res.status(409).json({ error: 'Coupon code already exists.' });
  }
  const coupon: Coupon = {
    id: `cp-${Date.now()}`,
    code,
    type: req.body.type || 'percent',
    value: Math.max(0, Number(req.body.value || 0)),
    maxUses: Math.max(1, Number(req.body.maxUses || 100)),
    usedCount: 0,
    expiryDate: String(req.body.expiryDate || '').trim(),
    active: true,
  };
  db.coupons.unshift(coupon);
  saveDb();
  broadcastDataSync();
  return res.json({ coupon });
});

app.put('/api/admin/coupons/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const c = db.coupons.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Coupon not found.' });
  Object.assign(c, req.body);
  saveDb();
  broadcastDataSync();
  return res.json({ coupon: c });
});

app.delete('/api/admin/coupons/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  db.coupons = db.coupons.filter((c) => c.id !== req.params.id);
  saveDb();
  broadcastDataSync();
  return res.json({ ok: true });
});

// ================= BROADCAST ANNOUNCEMENTS (Student API + Admin API) =================
app.get(['/api/v1/announcements', '/api/v1/notifications', '/api/announcements'], (_req, res) => {
  const db = getDb();
  return res.json({
    status: 'success',
    data: db.announcements || [],
    announcements: db.announcements || [],
  });
});

app.post(['/api/admin/announcements', '/api/v1/admin/announcements'], (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const db = getDb();
  const title = String(req.body.title || '').trim();
  const message = String(req.body.message || '').trim();
  if (!title || !message) {
    return res.status(422).json({ error: 'Both announcement title and message are required.' });
  }
  const nowStr = formatNowDisplay();
  const nextId = (db.announcements || []).reduce((max, a) => Math.max(max, Number(a.id) || 0), 0) + 1;
  const announcement: Announcement = {
    id: nextId,
    admin_id: admin.id,
    adminName: admin.name || 'ExamPro Admin',
    title,
    message,
    created_at: nowStr,
    updated_at: nowStr,
  };
  db.announcements.unshift(announcement);
  saveDb();
  broadcastEvent('announcement_broadcasted', { announcement });
  broadcastDataSync();
  return res.json({ status: 'success', announcement });
});

app.delete(['/api/admin/announcements/:id', '/api/v1/admin/announcements/:id'], (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const id = Number(req.params.id);
  db.announcements = (db.announcements || []).filter((a) => Number(a.id) !== id);
  saveDb();
  broadcastDataSync();
  return res.json({ ok: true });
});

// Syllabus Manager
app.post('/api/admin/syllabus', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const title = String(req.body.title || '').trim();
  if (!title) {
    return res.status(422).json({ error: 'Syllabus title is required.' });
  }
  const doc: SyllabusDoc = {
    id: `syl-${Date.now()}`,
    exam: String(req.body.exam || db.exams[0] || '').trim(),
    title,
    summary: String(req.body.summary || '').trim(),
    pdfUrl: String(req.body.pdfUrl || ''),
    fileName: String(req.body.fileName || '').trim() || `${title}.pdf`,
    uploadedAt: formatNowDisplay(),
  };
  db.syllabi.unshift(doc);
  saveDb();
  broadcastDataSync();
  return res.json({ doc });
});

app.delete('/api/admin/syllabus/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  db.syllabi = db.syllabi.filter((s) => s.id !== req.params.id);
  saveDb();
  broadcastDataSync();
  return res.json({ ok: true });
});

// Support & Reports Resolution
app.post('/api/admin/support/:id/resolve', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const t = db.supportTickets.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Ticket not found.' });
  t.status = 'resolved';
  saveDb();
  broadcastDataSync();
  return res.json({ ticket: t });
});

app.post('/api/admin/reports/:id/resolve', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const r = db.reportedQuestions.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Report not found.' });
  r.status = 'resolved';
  saveDb();
  broadcastDataSync();
  return res.json({ report: r });
});

app.post('/api/admin/results/refresh', (req, res) => {
  if (!requireAdmin(req, res)) return;
  checkAndRunMonthlyResultRefresh(new Date(), true);
  broadcastDataSync();
  return res.json({ ok: true });
});

// Exams & Subjects
app.post('/api/admin/exams', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const name = String(req.body.name || '').trim();
  if (name && !db.exams.includes(name)) {
    const idx = db.exams.indexOf('Other');
    if (idx >= 0) db.exams.splice(idx, 0, name);
    else db.exams.push(name);
    saveDb();
    broadcastDataSync();
  }
  return res.json({ exams: db.exams });
});

app.delete('/api/admin/exams/:name', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  db.exams = db.exams.filter((e) => e !== req.params.name || e === 'Other');
  saveDb();
  broadcastDataSync();
  return res.json({ exams: db.exams });
});

app.post('/api/admin/subjects', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const name = String(req.body.name || '').trim();
  if (name && !db.subjects.includes(name)) {
    db.subjects.push(name);
    saveDb();
    broadcastDataSync();
  }
  return res.json({ subjects: db.subjects });
});

// Settings (UPI, Social, WhatsApp Support, Admin Phone/Email Credentials)
app.put('/api/admin/settings', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const next = req.body;
  const rawShareUrl =
    typeof next.shareAppUrl === 'string' ? next.shareAppUrl.trim() : db.settings.shareAppUrl;
  const cleanShareUrl = /\.jk\.in\b/i.test(rawShareUrl) ? '' : rawShareUrl;

  db.settings = {
    ...db.settings,
    ...next,
    shareAppUrl: cleanShareUrl,
    social: { ...db.settings.social, ...(next.social || {}) },
    upi: { ...db.settings.upi, ...(next.upi || {}) },
    razorpay: {
      keyId:
        typeof next.razorpay?.keyId === 'string'
          ? next.razorpay.keyId.trim()
          : db.settings.razorpay?.keyId || '',
      keySecret:
        typeof next.razorpay?.keySecret === 'string' && next.razorpay.keySecret.trim()
          ? next.razorpay.keySecret.trim()
          : db.settings.razorpay?.keySecret || '',
    },
    promoBanner: next.promoBanner
      ? {
          is_banner_active: Boolean(next.promoBanner.is_banner_active),
          title: String(next.promoBanner.title || '').trim(),
          subtitle: String(next.promoBanner.subtitle || '').trim(),
          ctaLabel: String(next.promoBanner.ctaLabel || '').trim(),
          imageUrl: String(next.promoBanner.imageUrl || '').trim(),
          targetScreen: (next.promoBanner.targetScreen || 'none') as PromoBannerTargetScreen,
          targetUrl: String(next.promoBanner.targetUrl || '').trim(),
          updatedAt: new Date().toISOString(),
        }
      : db.settings.promoBanner,
    maintenance: next.maintenance
      ? {
          enabled: Boolean(next.maintenance.enabled),
          message:
            String(next.maintenance.message || '').trim() ||
            'ExamPro is currently undergoing scheduled maintenance. Please check back shortly.',
        }
      : db.settings.maintenance,
    flashNotice: next.flashNotice
      ? {
          enabled: Boolean(next.flashNotice.enabled),
          text: String(next.flashNotice.text || '').trim(),
        }
      : db.settings.flashNotice,
  };
  // Update admin user record if admin email/phone changed
  const adminUser = db.users.find((u) => u.role === 'admin');
  if (adminUser) {
    adminUser.email = db.settings.adminEmail;
    adminUser.phone = db.settings.adminPhone;
  }
  saveDb();
  broadcastDataSync();
  return res.json({ settings: db.settings });
});

// Dedicated Promotional Banner Settings endpoint (Admin only)
app.put('/api/admin/promo-banner', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const prev: PromoBannerSettings = db.settings.promoBanner || {
    is_banner_active: false,
    title: '',
    subtitle: '',
    ctaLabel: 'Explore Offers',
    imageUrl: '',
    targetScreen: 'upgrade',
    targetUrl: '',
  };

  const validScreens: PromoBannerTargetScreen[] = [
    'none',
    'upgrade',
    'courses',
    'bundles',
    'results',
    'syllabus',
    'external',
  ];
  const rawScreen = req.body.targetScreen ?? req.body.target_screen ?? prev.targetScreen;
  const targetScreen: PromoBannerTargetScreen = validScreens.includes(rawScreen)
    ? rawScreen
    : 'none';

  const isBannerActive =
    req.body.is_banner_active !== undefined
      ? Boolean(req.body.is_banner_active)
      : prev.is_banner_active;

  const title =
    req.body.title !== undefined ? String(req.body.title).trim() : prev.title;
  const subtitle =
    req.body.subtitle !== undefined ? String(req.body.subtitle).trim() : prev.subtitle;
  const ctaLabel =
    req.body.ctaLabel !== undefined
      ? String(req.body.ctaLabel).trim()
      : req.body.cta_label !== undefined
      ? String(req.body.cta_label).trim()
      : prev.ctaLabel;
  const imageUrl =
    req.body.imageUrl !== undefined
      ? String(req.body.imageUrl).trim()
      : req.body.image_url !== undefined
      ? String(req.body.image_url).trim()
      : prev.imageUrl;
  const targetUrl =
    req.body.targetUrl !== undefined
      ? String(req.body.targetUrl).trim()
      : req.body.target_url !== undefined
      ? String(req.body.target_url).trim()
      : prev.targetUrl;

  if (isBannerActive && !title && !imageUrl) {
    return res.status(422).json({
      error: 'Add a banner title or upload a banner image before activating the promotional banner.',
    });
  }

  db.settings.promoBanner = {
    is_banner_active: isBannerActive,
    title,
    subtitle,
    ctaLabel,
    imageUrl,
    targetScreen,
    targetUrl,
    updatedAt: new Date().toISOString(),
  };

  saveDb();
  broadcastDataSync();
  return res.json({
    ok: true,
    promoBanner: db.settings.promoBanner,
    promo_banner: db.settings.promoBanner,
  });
});

// Dedicated Platform Toggles & Flash Notice endpoint (Admin only)
app.put('/api/admin/platform-controls', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();

  const prevMaint = db.settings.maintenance || {
    enabled: false,
    message: 'ExamPro is currently undergoing scheduled maintenance to improve performance. Please check back shortly.',
  };
  const prevFlash = db.settings.flashNotice || {
    enabled: false,
    text: '',
  };

  const maintenanceEnabled =
    req.body.maintenance_mode !== undefined
      ? Boolean(req.body.maintenance_mode)
      : req.body.maintenance?.enabled !== undefined
      ? Boolean(req.body.maintenance.enabled)
      : prevMaint.enabled;

  const maintenanceMessage =
    req.body.maintenance_message !== undefined
      ? String(req.body.maintenance_message).trim()
      : req.body.maintenance?.message !== undefined
      ? String(req.body.maintenance.message).trim()
      : prevMaint.message;

  const flashEnabled =
    req.body.flash_notice_enabled !== undefined
      ? Boolean(req.body.flash_notice_enabled)
      : req.body.flashNotice?.enabled !== undefined
      ? Boolean(req.body.flashNotice.enabled)
      : prevFlash.enabled;

  const flashText =
    req.body.flash_notice_text !== undefined
      ? String(req.body.flash_notice_text).trim()
      : req.body.flashNotice?.text !== undefined
      ? String(req.body.flashNotice.text).trim()
      : prevFlash.text;

  if (flashEnabled && !flashText) {
    return res.status(422).json({
      error: 'Enter a flash notice / marquee announcement message before turning it ON.',
    });
  }

  db.settings.maintenance = {
    enabled: maintenanceEnabled,
    message:
      maintenanceMessage ||
      'ExamPro is currently undergoing scheduled maintenance to improve performance. Please check back shortly.',
  };
  db.settings.flashNotice = {
    enabled: flashEnabled,
    text: flashText,
  };

  saveDb();
  broadcastDataSync();
  return res.json({
    ok: true,
    maintenance: db.settings.maintenance,
    flashNotice: db.settings.flashNotice,
  });
});

// Public Settings & Student Dashboard REST API endpoints
app.get('/api/v1/settings', (_req, res) => {
  const db = getDb();
  const banner = db.settings.promoBanner || {
    is_banner_active: false,
    title: '',
    subtitle: '',
    ctaLabel: '',
    imageUrl: '',
    targetScreen: 'none',
    targetUrl: '',
  };
  const maintenance = db.settings.maintenance || {
    enabled: false,
    message: 'ExamPro is currently undergoing scheduled maintenance to improve performance. Please check back shortly.',
  };
  const flashNotice = db.settings.flashNotice || {
    enabled: false,
    text: '',
  };

  return res.json({
    success: true,
    is_banner_active: Boolean(banner.is_banner_active),
    promo_banner: banner,
    maintenance_mode: Boolean(maintenance.enabled),
    maintenance_message: maintenance.message,
    flash_notice_enabled: Boolean(flashNotice.enabled),
    flash_notice_text: flashNotice.text,
    maintenance,
    flash_notice: flashNotice,
    settings: {
      ...db.settings,
      razorpay: undefined,
    },
  });
});

app.get('/api/v1/dashboard', (req, res) => {
  const db = getDb();
  const user = getAuthUser(req);
  const banner = db.settings.promoBanner || {
    is_banner_active: false,
    title: '',
    subtitle: '',
    ctaLabel: '',
    imageUrl: '',
    targetScreen: 'none',
    targetUrl: '',
  };
  const maintenance = db.settings.maintenance || {
    enabled: false,
    message: 'ExamPro is currently undergoing scheduled maintenance to improve performance. Please check back shortly.',
  };
  const flashNotice = db.settings.flashNotice || {
    enabled: false,
    text: '',
  };

  const ownedBundleIds = new Set<number>(user?.ownedBundleIds || []);
  const ownedTestIds = new Set<number>(user?.ownedTestIds || []);
  if (user) {
    db.payments
      .filter((p) => p.userId === user.id && p.status === 'PAID')
      .forEach((p) => {
        if (p.itemType === 'bundle') ownedBundleIds.add(p.itemId);
        if (p.itemType === 'test') ownedTestIds.add(p.itemId);
      });
    db.bundles.forEach((b) => {
      if (ownedBundleIds.has(b.id)) {
        b.testIds.forEach((tid) => ownedTestIds.add(tid));
      }
    });
  }

  const attempts = user?.attempts || [];
  const avgScorePct =
    attempts.length > 0
      ? Math.round(
          attempts.reduce((acc, a) => acc + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0), 0) /
            attempts.length
        )
      : 0;

  return res.json({
    success: true,
    is_banner_active: Boolean(banner.is_banner_active),
    promo_banner: banner,
    maintenance_mode: Boolean(maintenance.enabled),
    maintenance_message: maintenance.message,
    flash_notice_enabled: Boolean(flashNotice.enabled),
    flash_notice_text: flashNotice.text,
    stats: {
      testsAttempted: attempts.length,
      averageScorePct: avgScorePct,
      activeCourses: ownedBundleIds.size,
      unlockedTests: ownedTestIds.size,
    },
    purchasedTests: db.tests.filter(
      (t) =>
        t.status !== 'draft' &&
        t.paid &&
        (ownedTestIds.has(t.id) || (t.bundleId != null && ownedBundleIds.has(t.bundleId)))
    ),
    exams: db.exams,
  });
});

// Dedicated Dynamic Razorpay Gateway Settings endpoint (Admin only)
app.put('/api/admin/razorpay-settings', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const keyId = String(req.body.razorpay_key ?? req.body.keyId ?? '').trim();
  const keySecret = String(req.body.razorpay_secret ?? req.body.keySecret ?? '').trim();

  if (keyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    return res.status(422).json({
      error: 'Enter a valid Razorpay Key ID starting with rzp_test_ or rzp_live_.',
    });
  }
  if (keySecret.length > 0 && keySecret.length < 16) {
    return res.status(422).json({
      error: 'Enter a valid Razorpay Secret Key (at least 16 characters).',
    });
  }
  if (keyId && !keySecret && !(db.settings.razorpay?.keySecret || '').trim()) {
    return res.status(422).json({
      error: 'Enter a valid Razorpay Secret Key (at least 16 characters).',
    });
  }

  db.settings.razorpay = {
    keyId,
    keySecret: keySecret || (keyId ? db.settings.razorpay?.keySecret || '' : ''),
  };
  saveDb();
  broadcastDataSync();
  return res.json({
    ok: true,
    razorpay: db.settings.razorpay,
    activeConfig: {
      keyId: getRazorpayConfig().keyId,
      source: getRazorpayConfig().source,
    },
  });
});

interface RawExtractedMcq {
  t: string;
  o: string[];
  c: number;
  e: string;
  subj: string;
  explicit_exam_citation?: boolean;
  previous_exams?: string[];
  examRef?: string[];
}

const INVALID_EXAM_TAG_RE =
  /^(none|n\/a|na|null|nil|unknown|unspecified|general|sample|mock|practice|various|other|exam)$/i;

function sanitizeStrictPreviousExams(
  explicitCitation: unknown,
  rawTags: unknown
): string[] | null {
  if (explicitCitation === false) return null;
  if (!Array.isArray(rawTags)) return null;
  const cleaned = rawTags
    .map((tag) => String(tag || '').trim())
    .filter((tag) => {
      if (tag.length < 3 || tag.length > 48) return false;
      if (INVALID_EXAM_TAG_RE.test(tag)) return false;
      return true;
    });
  return normalizePreviousExams(cleaned);
}

function parseJsonArrayResilient(rawText: string): RawExtractedMcq[] {
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  if (!stripped) return [];

  try {
    const parsed = JSON.parse(stripped);
    return Array.isArray(parsed) ? (parsed as RawExtractedMcq[]) : [];
  } catch {
    // Salvage complete objects if a response array was truncated mid-stream
    const start = stripped.indexOf('[');
    if (start < 0) return [];
    const items: RawExtractedMcq[] = [];
    let depth = 0;
    let inString = false;
    let escaped = false;
    let objStart = -1;

    for (let i = start + 1; i < stripped.length; i++) {
      const ch = stripped[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') {
        if (depth === 0) objStart = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && objStart >= 0) {
          try {
            const obj = JSON.parse(stripped.slice(objStart, i + 1)) as RawExtractedMcq;
            if (obj && typeof obj.t === 'string') items.push(obj);
          } catch {
            // skip malformed object
          }
          objStart = -1;
        }
      }
    }
    return items;
  }
}

// Server-side Gemini PDF Question Extractor (batched chunks of 20 up to 120 questions + strict previous_exams detection)
app.post('/api/admin/ai-extract-pdf', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const count = Math.max(1, Math.min(120, Number(req.body.count || 10)));
  const pdfBase64 = req.body.pdfBase64 ? String(req.body.pdfBase64) : '';
  const useSample = Boolean(req.body.useSample);
  const excludeQuestionsRaw: string[] = Array.isArray(req.body.excludeQuestions)
    ? req.body.excludeQuestions.map((s: unknown) => String(s || '').trim()).filter(Boolean)
    : [];
  const batchNumberHint = Number(req.body.batchIndex || 0);
  const totalBatchesHint = Number(req.body.totalBatches || 0);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured in Secrets. Please configure GEMINI_API_KEY to run AI PDF extraction.',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const BATCH_SIZE = 20;
    const seen = new Set<string>(
      excludeQuestionsRaw.map((q) => q.toLowerCase().replace(/\s+/g, ' '))
    );
    const collectedTitles = [...excludeQuestionsRaw];
    const questions: Question[] = [];
    const extractedRecords: ExtractionResult[] = [];
    const nowLabel = formatNowDisplay();
    const cleanedPdfBase64 =
      pdfBase64 && !useSample ? pdfBase64.replace(/^data:application\/pdf;base64,/, '') : '';

    const runSingleBatch = async (
      batchTarget: number,
      batchIdx: number,
      totalBatches: number
    ): Promise<RawExtractedMcq[]> => {
      const avoidList = collectedTitles.slice(-60);
      const batchContext =
        totalBatches > 1
          ? `This is batch ${batchIdx} of ${totalBatches}. Cover distinct sections/topics from earlier batches.`
          : '';
      const avoidSection =
        avoidList.length > 0
          ? `\nDo NOT repeat, paraphrase, or overlap ANY of these already-extracted questions:\n- ${avoidList.join('\n- ')}`
          : '';

      const prompt = `You are an expert Jammu & Kashmir competitive exam paper setter.
Extract or generate EXACTLY ${batchTarget} unique, non-duplicate multiple-choice questions strictly based on the provided PDF document${useSample ? ' (focusing on Jammu & Kashmir General Knowledge, History, Geography, Polity, Economy, and Reasoning)' : ''}.
${batchContext}

STRICT RULES:
1. Each question object must contain:
   - t: concise, clear question text (no numbering prefixes like "Q1.")
   - o: array of exactly 4 distinct answer options
   - c: 0-based integer index (0, 1, 2, or 3) of the correct option
   - e: short, accurate 1-2 sentence explanation
   - subj: subject name (e.g., J&K General Knowledge, History, Geography, Indian Polity, English, Math, Reasoning, Computer, Current Affairs)
   - explicit_exam_citation: boolean. Set to true ONLY if a specific previous exam name/year is EXPLICITLY written/printed inside the source document text next to or inside that exact question (e.g., "(JKSSB 2022)", "[JKPSC 2021]"). Otherwise MUST be false.
   - previous_exams: array of up to 3 exam tags (e.g. ["JKSSB 2022"]) ONLY when explicit_exam_citation is true and that exact exam/year appears verbatim in the source text for this question. NEVER guess, infer, assume, or attach generic exam tags (like "JKSSB 2024" or "JKPIS 2026") if not explicitly written in the text. Return [] whenever explicit_exam_citation is false.
${avoidSection}

Return valid JSON matching the schema.`;

      const contents = cleanedPdfBase64
        ? {
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: cleanedPdfBase64,
                },
              },
              { text: prompt },
            ],
          }
        : `${prompt}\n\nSample Document Topics: Jammu & Kashmir Geography (Jhelum, Chenab, Wular Lake, Dal Lake, Zoji La, Banihal), History (Kalhana's Rajatarangini, Karkota & Dogra dynasties, Martand Sun Temple), J&K Reorganisation Act 2019, Pampore Saffron, Dachigam Hangul, Computer MS Office shortcuts, English comprehension & Reasoning.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                t: { type: Type.STRING },
                o: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                c: { type: Type.INTEGER },
                e: { type: Type.STRING },
                subj: { type: Type.STRING },
                explicit_exam_citation: { type: Type.BOOLEAN },
                previous_exams: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['t', 'o', 'c', 'e', 'subj', 'explicit_exam_citation', 'previous_exams'],
            },
          },
        },
      });

      return parseJsonArrayResilient((response.text ?? '[]').trim());
    };

    const appendParsedItems = (parsed: RawExtractedMcq[], maxToAdd: number) => {
      for (let i = 0; i < parsed.length && questions.length < maxToAdd; i++) {
        const item = parsed[i];
        const cleanTitle = String(item.t || '').trim();
        const norm = cleanTitle.toLowerCase().replace(/\s+/g, ' ');
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        collectedTitles.push(cleanTitle);

        const opts = Array.isArray(item.o) ? item.o.slice(0, 4).map(String) : [];
        while (opts.length < 4) opts.push(`Option ${opts.length + 1}`);
        const prevExams = sanitizeStrictPreviousExams(
          item.explicit_exam_citation,
          item.previous_exams ?? item.examRef
        );
        const qId = `ai-${Date.now()}-${questions.length}-${i}`;
        const questionObj: Question = {
          id: qId,
          t: cleanTitle,
          o: [opts[0], opts[1], opts[2], opts[3]],
          c: Math.max(0, Math.min(3, Number(item.c || 0))),
          e: String(item.e || 'Correct option verified.'),
          subj: String(item.subj || 'J&K General Knowledge'),
          src: 'ai',
          previous_exams: prevExams,
          examRef: prevExams ?? [],
        };
        questions.push(questionObj);
        extractedRecords.push({
          id: qId,
          t: questionObj.t,
          o: questionObj.o,
          c: questionObj.c,
          e: questionObj.e,
          subj: questionObj.subj,
          previous_exams: prevExams,
          examRef: prevExams ?? [],
          reviewState: 'pending',
          createdAt: nowLabel,
        });
      }
    };

    const plannedBatches = Math.ceil(count / BATCH_SIZE);
    const maxAttempts = plannedBatches + 2; // allows refill passes if duplicates occurred

    for (let attempt = 0; attempt < maxAttempts && questions.length < count; attempt++) {
      const remaining = count - questions.length;
      const batchTarget = Math.min(BATCH_SIZE, remaining);
      const effectiveBatchNum = batchNumberHint > 0 ? batchNumberHint : attempt + 1;
      const effectiveTotalBatches = totalBatchesHint > 0 ? totalBatchesHint : plannedBatches;

      let parsed: RawExtractedMcq[] = [];
      for (let retry = 0; retry < 2; retry++) {
        try {
          parsed = await runSingleBatch(batchTarget, effectiveBatchNum, effectiveTotalBatches);
          if (parsed.length > 0) break;
        } catch (batchErr) {
          if (retry === 1) {
            if (questions.length > 0) break;
            throw batchErr;
          }
        }
      }

      if (parsed.length === 0) break;
      appendParsedItems(parsed, count);
    }

    const db = getDb();
    db.extraction_results = [...extractedRecords, ...(db.extraction_results || [])].slice(0, 300);
    saveDb();
    broadcastDataSync();

    return res.json({ questions, extraction_results: extractedRecords });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to extract questions from PDF.';
    console.error('Gemini PDF extraction error:', err);
    return res.status(500).json({ error: message });
  }
});

// Update extraction_results item (including previous_exams max 3 validation)
app.put('/api/admin/extraction-results/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  const idx = db.extraction_results.findIndex((r) => r.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Extraction result not found.' });

  const rawPrev = req.body.previous_exams !== undefined ? req.body.previous_exams : req.body.examRef;
  if (rawPrev !== undefined && rawPrev !== null) {
    if (!Array.isArray(rawPrev) || rawPrev.filter((x: unknown) => String(x || '').trim()).length > 3) {
      return res.status(422).json({ error: 'The previous_exams field must be an array with at most 3 items.' });
    }
  }
  const normalized =
    rawPrev !== undefined ? normalizePreviousExams(rawPrev) : db.extraction_results[idx].previous_exams;
  db.extraction_results[idx] = {
    ...db.extraction_results[idx],
    ...req.body,
    id: db.extraction_results[idx].id,
    previous_exams: normalized,
    examRef: normalized ?? [],
  };
  saveDb();
  broadcastDataSync();
  return res.json({ extraction_result: db.extraction_results[idx] });
});

// Catch-all JSON 404 for unknown API endpoints
app.all('/api/*', (_req, res) => {
  return res.status(404).json({ error: 'API endpoint not found.' });
});

// Vite dev middleware or production static build
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        const rawAppUrl = (process.env.APP_URL || '').trim();
        const origin =
          /^https?:\/\//i.test(rawAppUrl) && !isPlaceholderEnvValue(rawAppUrl)
            ? rawAppUrl.replace(/\/+$/, '')
            : req.get('host')
            ? `${req.protocol}://${req.get('host')}`
            : '';
        let html = fs.readFileSync(indexHtml, 'utf8');
        if (origin) {
          const cleanPath = req.path && req.path !== '/' ? req.path : '/';
          const fullUrl = `${origin}${cleanPath}`;
          html = html
            .replace(/<link([^>]*id="canonical-url"[^>]*?)(?:\s+href="[^"]*")?\s*\/?>/i, `<link$1 href="${fullUrl}" />`)
            .replace(/(<meta[^>]*id="og-url"[^>]*content=")[^"]*(")/i, `$1${fullUrl}$2`);
        }
        res.setHeader('Cache-Control', 'no-cache');
        res.type('html').send(html);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  // Run month-end 11:55 PM automatic Result Menu refresh check at boot and every 30 seconds
  checkAndRunMonthlyResultRefresh();
  setInterval(() => {
    if (checkAndRunMonthlyResultRefresh()) {
      broadcastDataSync();
    }
  }, 30_000);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ExamPro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
