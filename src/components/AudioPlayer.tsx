import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

interface AudioPlayerProps {
  audioPath: string;
  seekTo?: { timeMs: number; id: number };
}

export interface AudioPlayerRef {
  seekTo: (timeMs: number) => void;
  play: () => void;
  pause: () => void;
}

export const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(function AudioPlayer(
  { audioPath, seekTo },
  ref
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioSrc = convertFileSrc(audioPath);

  useImperativeHandle(ref, () => ({
    seekTo: (timeMs: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = timeMs / 1000;
        audioRef.current.play();
      }
    },
    play: () => {
      audioRef.current?.play();
    },
    pause: () => {
      audioRef.current?.pause();
    },
  }));

  useEffect(() => {
    if (seekTo && audioRef.current) {
      audioRef.current.currentTime = seekTo.timeMs / 1000;
      audioRef.current.play();
    }
  }, [seekTo]);

  return (
    <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-3">
      <audio ref={audioRef} src={audioSrc} controls className="w-full h-10" />
    </div>
  );
});
