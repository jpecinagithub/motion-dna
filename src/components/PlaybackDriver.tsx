import { useEffect } from 'react';
import { useAppStore } from '../stores/app';
import {
  getVideoElement,
  getTimeMs,
  setTimeMs,
  advanceVirtual,
} from '../lib/playhead';

/**
 * Headless playback driver. A single rAF loop keeps the <video> element
 * (or the virtual clock for sessions without video) in sync with the
 * store's transport state. It reads via getState() — no subscriptions,
 * so it never rerenders.
 */
export function PlaybackDriver() {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;

      const { playing, speed, inMs, outMs, session } = useAppStore.getState();
      const v = getVideoElement();

      if (v && session) {
        if (Math.abs(v.playbackRate - speed) > 0.01) v.playbackRate = speed;
        if (playing && v.paused) {
          v.play().catch(() => {
            /* autoplay policies: stay paused, user can press play */
          });
        } else if (!playing && !v.paused) {
          v.pause();
        }
        const t = v.currentTime * 1000;
        if (t >= outMs) {
          // loop the [in, out] region, keep the playing state
          v.currentTime = inMs / 1000;
        } else if (t < inMs - 1) {
          v.currentTime = inMs / 1000;
        }
      } else if (v) {
        // video element attached but no session: stay paused
        if (!v.paused) v.pause();
      } else if (session) {
        // virtual clock (synthetic / library sessions without video)
        if (playing) {
          advanceVirtual(dt * speed);
          if (getTimeMs() >= outMs) setTimeMs(inMs);
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}
