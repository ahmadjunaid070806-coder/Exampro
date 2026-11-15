import React from 'react';
import { X, MessageCircle } from 'lucide-react';
import type { AppSettings } from '../types';

export type InfoPageKey = 'about' | 'offer' | 'contact' | 'privacy' | 'terms' | 'refund';

interface Props {
  page: InfoPageKey | null;
  settings: AppSettings;
  onClose: () => void;
  onOpenSupportTicket?: () => void;
}

export const InfoPagesModal: React.FC<Props> = ({
  page,
  settings,
  onClose,
  onOpenSupportTicket,
}) => {
  if (!page) return null;

  const waHref = `https://wa.me/${settings.whatsappSupportNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
    settings.whatsappSupportMessage
  )}`;

  const content: Record<InfoPageKey, { title: string; paragraphs: string[] }> = {
    about: {
      title: 'About ExamPro',
      paragraphs: [
        'ExamPro is Jammu & Kashmir’s dedicated mock-test and exam-preparation platform built to help aspirants crack JKSSB, JKPSC KAS, J&K Police (JKP), JK Bank, and JKBOSE examinations.',
        'Our mission is to make exam-pattern CBT practice tests, instant solutions, automated mistake notebooks, and real-time District Rankings accessible and affordable for every student across all 20 districts of J&K.',
      ],
    },
    offer: {
      title: 'What We Offer',
      paragraphs: [
        '• Full-Length CBT Mock Tests modeled strictly on JKSSB, JKPSC, and JKP blueprints with real negative marking.',
        '• Subject-Wise Sectional Tests (History, Geography, J&K GK, English, Math, Reasoning, Computer) and Test Series Bundles.',
        '• Automated Mistake Notebook that captures wrong answers and removes them once you solve them correctly.',
        '• District-Wise & All-J&K Leaderboard with shareable #1 District Topper certificates, plus Official Syllabus PDFs.',
      ],
    },
    contact: {
      title: 'Contact & Support',
      paragraphs: [
        `Email: ${settings.adminEmail}`,
        `Phone / WhatsApp: +91 ${settings.adminPhone}`,
        'For payment or test access assistance on ExamPro, share your Order ID or Razorpay Payment ID via WhatsApp or the Support Ticket form.',
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      paragraphs: [
        'We collect your email address, full name, 10-digit mobile number, J&K district, and target exam solely to create your ExamPro student account, enforce single-device protection, and generate district leaderboards.',
        'We never sell or rent your personal information to third parties. Payments are processed and verified automatically via Razorpay HMAC SHA256 verification; ExamPro never stores your banking PINs or card credentials.',
        'You can update your profile anytime or request account deletion by contacting ExamPro support.',
      ],
    },
    terms: {
      title: 'Terms & Conditions',
      paragraphs: [
        'One account per student: each email address and 10-digit mobile number can be registered to one ExamPro account only.',
        'Single-Device Policy: student accounts can stay signed in on one device at a time. Signing in on a second device automatically logs out the older session.',
        'All mock tests, explanations, and syllabus PDFs are strictly for personal preparation and must not be redistributed or resold.',
      ],
    },
    refund: {
      title: 'Cancellation & Refund Policy',
      paragraphs: [
        'In case of a duplicate transaction or technical issue where test access could not be granted automatically, students can raise a support ticket with their ExamPro Order ID or Razorpay Payment ID.',
        'Verified refund requests are processed back to the original payment source within 3–5 business days.',
        'Once a mock test or bundle has been unlocked and attempted, payments are non-refundable.',
      ],
    },
  };

  const active = content[page];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {active.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {active.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {page === 'contact' && (
          <div className="mt-5 flex flex-wrap gap-2.5">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Chat on WhatsApp</span>
            </a>
            {onOpenSupportTicket && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSupportTicket();
                }}
                className="btn-press rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Submit Support Ticket
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
