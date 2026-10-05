import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Lang, MotionSession } from '../types';
import { useT } from '../i18n';
import { useAppStore } from '../stores/app';
import {
  listSessions,
  getSession,
  renameSession,
  duplicateSession,
  deleteSession,
  clearAllSessions,
} from '../storage/db';
import { formatTime } from '../lib/utils';

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="rounded-lg p-1.5 text-[#8b98b8] hover:bg-white/10 hover:text-[#e8eefc]"
    >
      {children}
    </button>
  );
}

function RowIcons({ kind }: { kind: 'open' | 'rename' | 'duplicate' | 'delete' }) {
  const cls = 'h-4 w-4';
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: cls,
    'aria-hidden': true,
  };
  if (kind === 'open')
    return (
      <svg {...common}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    );
  if (kind === 'rename')
    return (
      <svg {...common}>
        <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" />
      </svg>
    );
  if (kind === 'duplicate')
    return (
      <svg {...common}>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m3 0l-.8 12.2a1.5 1.5 0 01-1.5 1.3H8.3a1.5 1.5 0 01-1.5-1.3L6 7" />
    </svg>
  );
}

function LibraryRow({
  session,
  lang,
  onChanged,
  onOpened,
}: {
  session: MotionSession;
  lang: Lang;
  onChanged: () => void;
  onOpened: () => void;
}) {
  const { t } = useT();
  const openSession = useAppStore((s) => s.openSession);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);

  const handleOpen = async () => {
    const full = await getSession(session.id);
    if (full) {
      openSession(full, null);
      onOpened();
    }
  };

  const handleRename = async () => {
    const name = draft.trim() || session.name;
    await renameSession(session.id, name);
    setEditing(false);
    onChanged();
  };

  const handleDuplicate = async () => {
    await duplicateSession(session.id);
    onChanged();
  };

  const handleDelete = async () => {
    await deleteSession(session.id);
    onChanged();
  };

  const date = new Date(session.createdAt).toLocaleDateString(
    lang === 'es' ? 'es-ES' : 'en-US',
    { day: '2-digit', month: 'short', year: 'numeric' },
  );

  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2">
      {session.thumbnail ? (
        <img
          src={session.thumbnail}
          alt=""
          className="h-14 w-20 shrink-0 rounded-lg border border-white/10 object-cover"
        />
      ) : (
        <div className="h-14 w-20 shrink-0 rounded-lg border border-white/10 bg-white/5" />
      )}
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-[#3b82f6]/50 bg-black/40 px-2 py-1 text-sm text-[#e8eefc] outline-none"
            />
            <button
              type="button"
              onClick={() => void handleRename()}
              className="rounded-lg bg-[#3b82f6] px-2 py-1 text-xs font-semibold text-white"
            >
              {t('library.save')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-2 py-1 text-xs text-[#8b98b8] hover:text-[#e8eefc]"
            >
              {t('library.cancel')}
            </button>
          </div>
        ) : (
          <p className="truncate text-sm font-medium text-[#e8eefc]">{session.name}</p>
        )}
        <p className="mt-0.5 text-xs text-[#8b98b8]">
          {date} · {formatTime(session.durationMs)} · {session.source}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <IconBtn title={t('library.open')} onClick={() => void handleOpen()}>
          <RowIcons kind="open" />
        </IconBtn>
        <IconBtn
          title={t('library.rename')}
          onClick={() => {
            setDraft(session.name);
            setEditing(true);
          }}
        >
          <RowIcons kind="rename" />
        </IconBtn>
        <IconBtn title={t('library.duplicate')} onClick={() => void handleDuplicate()}>
          <RowIcons kind="duplicate" />
        </IconBtn>
        <IconBtn title={t('library.delete')} onClick={() => void handleDelete()}>
          <RowIcons kind="delete" />
        </IconBtn>
      </div>
    </li>
  );
}

/**
 * Session library. Embedded mode renders an inline section (start screen);
 * otherwise a fixed right drawer with a close button.
 */
export function SessionLibrary({
  embedded = false,
  onClose,
}: {
  embedded?: boolean;
  onClose?: () => void;
}) {
  const { t, lang } = useT();
  const library = useAppStore((s) => s.library);
  const setLibrary = useAppStore((s) => s.setLibrary);

  const refresh = async () => {
    try {
      setLibrary(await listSessions());
    } catch {
      /* storage unavailable: keep current list */
    }
  };

  const handleClear = async () => {
    if (window.confirm(t('library.clearConfirm'))) {
      await clearAllSessions();
      setLibrary([]);
    }
  };

  const content = (
    <>
      {library.length === 0 ? (
        <p className="py-2 text-sm text-[#8b98b8]">{t('start.libraryEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {library.map((s) => (
            <LibraryRow
              key={s.id}
              session={s}
              lang={lang}
              onChanged={() => void refresh()}
              onOpened={() => onClose?.()}
            />
          ))}
        </ul>
      )}
      {library.length > 0 && (
        <button
          type="button"
          onClick={() => void handleClear()}
          className="mt-3 text-xs text-[#8b98b8] underline-offset-2 hover:text-[#fb7185] hover:underline"
        >
          {t('library.clear')}
        </button>
      )}
    </>
  );

  if (embedded) {
    return (
      <section className="mt-12 w-full max-w-2xl">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#8b98b8]">
          {t('start.library')}
        </h2>
        {content}
      </section>
    );
  }

  return (
    <aside className="fixed bottom-0 right-0 top-0 z-40 flex w-80 max-w-[85vw] flex-col border-l border-white/10 bg-[#0a0f1c]/95 p-4 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8b98b8]">
          {t('start.library')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#e8eefc] hover:bg-white/10"
        >
          {t('common.close')}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{content}</div>
    </aside>
  );
}
