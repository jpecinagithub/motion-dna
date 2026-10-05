import { useEffect, useRef } from 'react';
import type { VideoMeta } from '../types';
import { setVideoElement } from '../lib/playhead';

/**
 * Hosts the source <video> element and registers it with the playhead
 * module so PlaybackDriver can drive it. The 2D pose overlay is drawn
 * by the parent (App) via Overlay2D when mode === 'overlay'.
 */
export function VideoStage({ video }: { video: VideoMeta }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setVideoElement(ref.current);
    return () => setVideoElement(null);
  }, []);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={ref}
        src={video.url}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}
