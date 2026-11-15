import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface Props {
  variant?: 'student' | 'admin';
  threshold?: number;
}

export const BackToTopButton: React.FC<Props> = ({
  variant = 'student',
  threshold = 280,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      setVisible(window.scrollY > threshold);
    };
    checkScroll();
    window.addEventListener('scroll', checkScroll, { passive: true });
    return () => window.removeEventListener('scroll', checkScroll);
  }, [threshold]);

  const scrollToTop = () => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to Top"
      title="Back to Top"
      className={`btn-press fixed right-5 z-40 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-bold shadow-lg transition-all duration-200 cursor-pointer ${
        variant === 'admin'
          ? 'bottom-6 border border-[#3a3848] bg-[#4f46e5] text-white hover:bg-[#4338ca] shadow-[0_10px_25px_rgba(0,0,0,0.45)]'
          : 'bottom-20 lg:bottom-6 border border-indigo-200/80 dark:border-indigo-700/60 bg-[#4F46E5] text-white hover:bg-indigo-700 shadow-[0_10px_25px_rgba(79,70,229,0.35)]'
      } ${
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <ArrowUp className="w-4 h-4" />
      <span className="hidden sm:inline">Top</span>
    </button>
  );
};
