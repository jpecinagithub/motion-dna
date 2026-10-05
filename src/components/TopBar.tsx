import type { Lang } from '../types';
import { APP_NAME, AUTHOR_NAME } from '../config';
import { useT } from '../i18n';
import { useAppStore } from '../stores/app';

const LANGS: Lang[] = ['es', 'en'];

/** Top bar: brand, privacy badge, language toggle, author credit, session actions. */
export function TopBar({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const { t } = useT();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);

  const handleNewVideo = () => {
    const st = useAppStore.getState();
    if (st.video?.url) URL.revokeObjectURL(st.video.url);
    st.resetWorkspace();
  };

  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 bg-[#05070d]/70 px-4 py-2 backdrop-blur-sm">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="shrink-0 text-sm font-bold tracking-[0.25em] text-[#e8eefc]">
          {APP_NAME}
        </span>
        <span className="hidden truncate text-xs text-[#8b98b8] md:inline">
          {t('app.tagline')}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[#8b98b8] lg:inline-flex">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
          {t('app.privacyBadge')}
        </span>

        <div
          className="flex rounded-full border border-white/10 bg-white/5 p-0.5"
          role="group"
          aria-label="Language / Idioma"
        >
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                lang === l
                  ? 'bg-[#3b82f6] text-white'
                  : 'text-[#8b98b8] hover:text-[#e8eefc]'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <span className="hidden text-xs text-[#8b98b8] sm:inline">
          {t('app.credit')} {AUTHOR_NAME}
        </span>

        <button
          type="button"
          onClick={onOpenLibrary}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#e8eefc] hover:border-white/25 hover:bg-white/10"
        >
          {t('nav.sessions')}
        </button>
        <button
          type="button"
          onClick={handleNewVideo}
          className="rounded-full bg-[#3b82f6] px-3 py-1 text-xs font-semibold text-white hover:bg-[#3b82f6]/80"
        >
          {t('nav.newVideo')}
        </button>
      </div>
    </header>
  );
}
