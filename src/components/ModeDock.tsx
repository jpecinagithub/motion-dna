import type { ViewMode } from '../types';
import type { DictKey } from '../i18n';
import { useT } from '../i18n';
import { useAppStore } from '../stores/app';

const MODES: Array<{ id: ViewMode; label: DictKey }> = [
  { id: 'video', label: 'modes.video' },
  { id: 'overlay', label: 'modes.overlay' },
  { id: 'skeleton', label: 'modes.skeleton' },
  { id: 'trails', label: 'modes.trails' },
  { id: 'heat', label: 'modes.heat' },
  { id: 'explode', label: 'modes.explode' },
  { id: 'ghost', label: 'modes.ghost' },
  { id: 'difference', label: 'modes.difference' },
  { id: 'signature', label: 'modes.signature' },
];

function ModeIcon({ mode, className }: { mode: ViewMode; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: className ?? 'h-5 w-5',
    'aria-hidden': true,
  };
  switch (mode) {
    case 'video':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M10.5 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'overlay':
      return (
        <svg {...common}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M4.5 12.5L12 16.5l7.5-4" />
          <path d="M4.5 16.5L12 20.5l7.5-4" />
        </svg>
      );
    case 'skeleton':
      return (
        <svg {...common}>
          <path d="M12 2.5l8 4.6v9.2l-8 4.6-8-4.6V7.1z" />
          <path d="M12 12V2.5M12 12l8 4.5M12 12l-8 4.5" />
        </svg>
      );
    case 'trails':
      return (
        <svg {...common}>
          <path d="M4 18c6 0 4-12 9-12s5 8 7 8" />
          <circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="20" cy="14" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'heat':
      return (
        <svg {...common}>
          <path d="M12 3c3.5 4.5 6 7.5 6 11a6 6 0 01-12 0c0-3.5 2.5-6.5 6-11z" />
          <path d="M12 20a3 3 0 003-3c0-1.7-1.3-3-3-5.2-1.7 2.2-3 3.5-3 5.2a3 3 0 003 3z" />
        </svg>
      );
    case 'explode':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M5 5l2.5 2.5M16.5 16.5L19 19M19 5l-2.5 2.5M7.5 16.5L5 19" />
        </svg>
      );
    case 'ghost':
      return (
        <svg {...common}>
          <path d="M12 3a6 6 0 00-6 6v11l2.5-1.5L11 20l1-1.2 1 1.2 2.5-1.5L18 20V9a6 6 0 00-6-6z" />
          <circle cx="9.5" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="10" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'difference':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="11" height="11" rx="2" />
          <rect x="10" y="10" width="11" height="11" rx="2" />
        </svg>
      );
    case 'signature':
      return (
        <svg {...common}>
          <path d="M12 12h.01M12 15.5a3.5 3.5 0 01-3.5-3.5A5.5 5.5 0 0114 6.5 7.5 7.5 0 0121.5 14c0 3.5-2 5.8-4.5 7.2" />
          <path d="M9 21c-2.3-1-4-3-4-6a9 9 0 0118 0c0 1.2-.2 2.3-.6 3.3" />
        </svg>
      );
  }
}

/**
 * View-mode dock: vertical on desktop (left center), horizontal on mobile
 * (bottom center). Disabled until a session is loaded.
 */
export function ModeDock() {
  const { t } = useT();
  const session = useAppStore((s) => s.session);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);

  return (
    <div className="absolute bottom-24 left-1/2 z-30 flex -translate-x-1/2 flex-row gap-1.5 rounded-2xl border border-white/10 bg-[#0a0f1c]/90 p-1.5 backdrop-blur md:bottom-auto md:left-4 md:top-1/2 md:-translate-x-0 md:-translate-y-1/2 md:flex-col">
      {MODES.map((m) => {
        const active = viewMode === m.id;
        const disabled = !session;
        return (
          <button
            key={m.id}
            type="button"
            title={t(m.label)}
            aria-label={t(m.label)}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => setViewMode(m.id)}
            className={`rounded-xl border p-2 transition-colors ${
              active
                ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                : 'border-transparent bg-white/5 text-[#8b98b8] hover:border-white/25 hover:text-[#e8eefc]'
            } ${disabled ? 'cursor-not-allowed opacity-40 hover:border-transparent hover:text-[#8b98b8]' : ''}`}
          >
            <ModeIcon mode={m.id} />
            <span className="sr-only">{t(m.label)}</span>
          </button>
        );
      })}
    </div>
  );
}
