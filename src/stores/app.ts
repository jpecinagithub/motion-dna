import { create } from 'zustand';
import type {
  JointId,
  Lang,
  MotionSession,
  Phase,
  VideoMeta,
  ViewMode,
} from '../types';

export interface ExplodeConfig {
  count: number;
  spacing: number;
  collapsed: boolean;
}

export interface GhostConfig {
  opacityB: number;
  offsetMs: number;
  normalized: boolean;
  differenceOnly: boolean;
}

export interface ProcessingState {
  active: boolean;
  loadingModel: boolean;
  done: number;
  total: number;
  error: string | null;
}

interface AppState {
  lang: Lang;
  phase: Phase;
  viewMode: ViewMode;

  /** active session (take A) */
  session: MotionSession | null;
  /** take B for compare mode */
  compareSession: MotionSession | null;
  /** lightweight library list (metadata; full frames loaded on open) */
  library: MotionSession[];
  video: VideoMeta | null;

  playing: boolean;
  speed: number;
  inMs: number;
  outMs: number;

  selectedJoints: JointId[];
  trailLength: number;
  showLabels: boolean;

  explode: ExplodeConfig;
  ghost: GhostConfig;

  processing: ProcessingState;
  notice: string | null;

  /** live camera overlay active */
  liveActive: boolean;
  setLiveActive: (v: boolean) => void;

  setLang: (l: Lang) => void;
  setPhase: (p: Phase) => void;
  setViewMode: (m: ViewMode) => void;

  setSession: (s: MotionSession | null) => void;
  setCompareSession: (s: MotionSession | null) => void;
  setLibrary: (list: MotionSession[]) => void;
  setVideo: (v: VideoMeta | null) => void;

  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  setInOut: (inMs: number, outMs: number) => void;

  toggleJoint: (id: JointId) => void;
  setSelectedJoints: (ids: JointId[]) => void;
  setTrailLength: (n: number) => void;
  setShowLabels: (v: boolean) => void;

  setExplode: (p: Partial<ExplodeConfig>) => void;
  setGhost: (p: Partial<GhostConfig>) => void;

  setProcessing: (p: Partial<ProcessingState>) => void;
  resetProcessing: () => void;
  setNotice: (n: string | null) => void;

  /** Load a session into the workspace (resets playhead, range, selections). */
  openSession: (s: MotionSession, video: VideoMeta | null) => void;
  /** Reset workspace back to the start screen. */
  resetWorkspace: () => void;
}

const DEFAULT_EXPLODE: ExplodeConfig = { count: 8, spacing: 1.2, collapsed: false };
const DEFAULT_GHOST: GhostConfig = { opacityB: 0.45, offsetMs: 0, normalized: true, differenceOnly: false };

export const useAppStore = create<AppState>()((set) => ({
  lang: 'es',
  phase: 'start',
  viewMode: 'skeleton',

  session: null,
  compareSession: null,
  library: [],
  video: null,

  playing: false,
  speed: 1,
  inMs: 0,
  outMs: 0,

  selectedJoints: ['elbowL', 'elbowR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR'],
  trailLength: 40,
  showLabels: true,

  explode: DEFAULT_EXPLODE,
  ghost: DEFAULT_GHOST,

  processing: { active: false, loadingModel: false, done: 0, total: 0, error: null },
  notice: null,
  liveActive: false,

  setLang: (lang) => set({ lang }),
  setPhase: (phase) => set({ phase }),
  setViewMode: (viewMode) => set({ viewMode }),

  setSession: (session) => set({ session }),
  setCompareSession: (compareSession) => set({ compareSession }),
  setLibrary: (library) => set({ library }),
  setVideo: (video) => set({ video }),

  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setInOut: (inMs, outMs) => set({ inMs, outMs }),

  toggleJoint: (id) =>
    set((s) => ({
      selectedJoints: s.selectedJoints.includes(id)
        ? s.selectedJoints.filter((j) => j !== id)
        : [...s.selectedJoints, id],
    })),
  setSelectedJoints: (selectedJoints) => set({ selectedJoints }),
  setTrailLength: (trailLength) => set({ trailLength }),
  setShowLabels: (showLabels) => set({ showLabels }),

  setExplode: (p) => set((s) => ({ explode: { ...s.explode, ...p } })),
  setGhost: (p) => set((s) => ({ ghost: { ...s.ghost, ...p } })),

  setProcessing: (p) =>
    set((s) => ({ processing: { ...s.processing, ...p } })),
  resetProcessing: () =>
    set({ processing: { active: false, loadingModel: false, done: 0, total: 0, error: null } }),
  setNotice: (notice) => set({ notice }),
  setLiveActive: (liveActive) => set({ liveActive }),

  openSession: (session, video) =>
    set({
      session,
      video,
      phase: 'explore',
      viewMode: video ? 'overlay' : 'skeleton',
      playing: false,
      speed: 1,
      inMs: 0,
      outMs: session.durationMs,
      compareSession: null,
      explode: DEFAULT_EXPLODE,
      ghost: DEFAULT_GHOST,
      notice: null,
    }),

  resetWorkspace: () =>
    set({
      phase: 'start',
      session: null,
      compareSession: null,
      video: null,
      playing: false,
      viewMode: 'skeleton',
      processing: { active: false, loadingModel: false, done: 0, total: 0, error: null },
      notice: null,
      liveActive: false,
    }),
}));
