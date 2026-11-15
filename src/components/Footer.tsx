import React from 'react';
import type { AppSettings } from '../types';
import { SocialShareBar } from './SocialShareBar';
import type { InfoPageKey } from './InfoPagesModal';

interface Props {
  settings: AppSettings;
  onSelectCategoryFilter: (filterKeyword: string) => void;
  onOpenPage: (page: InfoPageKey) => void;
  onToast: (msg: string) => void;
}

export const Footer: React.FC<Props> = ({
  settings,
  onSelectCategoryFilter,
  onOpenPage,
  onToast,
}) => {
  const categories = [
    { label: 'JKSSB Mock Tests', key: 'JKSSB' },
    { label: 'JKPSC KAS Prelims', key: 'JKPSC' },
    { label: 'J&K Police (JKP)', key: 'JKP' },
    { label: 'JKBOSE & Entrances', key: 'JKBOSE' },
    { label: 'Free Mock Tests', key: 'FREE' },
  ];

  return (
    <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-8 pb-6">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
          <div>
            <h4 className="font-display text-xs font-bold tracking-wide text-slate-900 dark:text-white mb-3">
              Exam Categories
            </h4>
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li key={cat.key}>
                  <button
                    type="button"
                    onClick={() => onSelectCategoryFilter(cat.key)}
                    className="text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 transition-all duration-150 cursor-pointer text-left"
                  >
                    {cat.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display text-xs font-bold tracking-wide text-slate-900 dark:text-white mb-3">
              Explore ExamPro
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPage('about')}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 transition-all duration-150 cursor-pointer"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPage('offer')}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 transition-all duration-150 cursor-pointer"
                >
                  What We Offer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPage('contact')}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 transition-all duration-150 cursor-pointer"
                >
                  Contact &amp; Support
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-xs font-bold tracking-wide text-slate-900 dark:text-white mb-3">
              Legal &amp; Policies
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPage('privacy')}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 transition-all duration-150 cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPage('terms')}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 transition-all duration-150 cursor-pointer"
                >
                  Terms &amp; Conditions
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPage('refund')}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 transition-all duration-150 cursor-pointer"
                >
                  Cancellation &amp; Refund Policy
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-col items-center gap-4">
          <SocialShareBar settings={settings} onToast={onToast} />
          <div className="text-center space-y-1">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Made with love ❤️ by Ahmad Junaid
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              © {new Date().getFullYear()} ExamPro. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
