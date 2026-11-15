import React from 'react';
import { Copy, MessageCircle, Youtube, Instagram, Facebook } from 'lucide-react';
import type { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  onToast: (msg: string) => void;
  title?: string;
}

export const SocialShareBar: React.FC<Props> = ({ settings, onToast, title }) => {
  const { social, shareMessage, shareAppUrl } = settings;
  const appUrl = (shareAppUrl && !/\.jk\.in\b/i.test(shareAppUrl) ? shareAppUrl : '') || window.location.origin;
  const fullText = `${shareMessage} ${appUrl}`.trim();

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(appUrl);
    } catch {
      // ignore
    }
    onToast('Link Copied!');
  };

  const waShareHref = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
  const fbShareHref =
    social.fb.url && social.fb.url.trim().length > 0
      ? social.fb.url.trim()
      : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(appUrl)}`;

  const showWa = social.wa.on;
  const showFb = social.fb.on;
  const showIg = social.ig.on && Boolean(social.ig.url?.trim());
  const showYt = social.yt.on && Boolean(social.yt.url?.trim());
  const showCp = social.cp.on;

  const anyEnabled = showWa || showFb || showIg || showYt || showCp;
  if (!anyEnabled) return null;

  return (
    <div className="flex flex-col items-center gap-2.5">
      {title && (
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {title}
        </span>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {showWa && (
          <a
            href={waShareHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Share on WhatsApp"
            aria-label="Share on WhatsApp"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-110 hover:shadow-[0_6px_18px_rgba(37,211,102,0.45)]"
          >
            <MessageCircle className="w-5 h-5" />
          </a>
        )}
        {showFb && (
          <a
            href={fbShareHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Facebook"
            aria-label="Facebook"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-110 hover:shadow-[0_6px_18px_rgba(24,119,242,0.45)]"
          >
            <Facebook className="w-5 h-5" />
          </a>
        )}
        {showIg && (
          <a
            href={social.ig.url.trim()}
            target="_blank"
            rel="noopener noreferrer"
            title="Instagram"
            aria-label="Instagram"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-110 hover:shadow-[0_6px_18px_rgba(221,42,123,0.45)]"
          >
            <Instagram className="w-5 h-5" />
          </a>
        )}
        {showYt && (
          <a
            href={social.yt.url.trim()}
            target="_blank"
            rel="noopener noreferrer"
            title="YouTube"
            aria-label="YouTube"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF0000] text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-110 hover:shadow-[0_6px_18px_rgba(255,0,0,0.45)]"
          >
            <Youtube className="w-5 h-5" />
          </a>
        )}
        {social.cp.on && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copy Link"
            aria-label="Copy Link"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-600 dark:bg-slate-700 text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-110 hover:bg-indigo-600 hover:shadow-[0_6px_18px_rgba(79,70,229,0.45)] cursor-pointer"
          >
            <Copy className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
