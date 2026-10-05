import { useEffect } from 'react';
import { useAppStore } from '../stores/app';
import { useT } from '../i18n';

/** Fixed bottom toast for notices (errors / warnings). Auto-dismisses after 5 s. */
export function Notice() {
  const { t } = useT();
  const notice = useAppStore((s) => s.notice);
  const setNotice = useAppStore((s) => s.setNotice);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [notice, setNotice]);

  if (!notice) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 max-w-[90vw] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-[#fb7185]/50 bg-[#3a0f18] px-4 py-3 text-[#e8eefc] shadow-2xl">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fb7185"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path d="M12 3l10 17H2L12 3z" />
          <path d="M12 10v4" />
          <circle cx="12" cy="17" r="0.6" fill="#fb7185" stroke="none" />
        </svg>
        <p className="text-sm">{notice}</p>
        <button
          type="button"
          onClick={() => setNotice(null)}
          aria-label={t('errors.dismiss')}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#8b98b8] hover:bg-white/10 hover:text-[#e8eefc]"
        >
          {t('errors.dismiss')}
        </button>
      </div>
    </div>
  );
}
