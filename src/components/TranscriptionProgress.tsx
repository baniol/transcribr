import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Spinner } from "./ui/Spinner";
import { Button } from "./ui/Button";
import { ProgressBar } from "./ui/ProgressBar";
import { cancelTranscription } from "../api/transcription";
import type { TranscriptionProgress as TranscriptionProgressType } from "../types";

interface TranscriptionProgressProps {
  fileName: string | null;
  onCancel: () => void;
}

export function TranscriptionProgress({ fileName, onCancel }: TranscriptionProgressProps) {
  const [progress, setProgress] = useState<TranscriptionProgressType | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<TranscriptionProgressType>(
        "transcription-progress",
        (event) => {
          setProgress(event.payload);
        }
      );
      return unlisten;
    };

    const unlistenPromise = setupListener();

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelTranscription();
      onCancel();
    } catch (err) {
      console.error("Failed to cancel:", err);
    }
  };

  const getStatusText = () => {
    if (cancelling) return "Cancelling...";
    if (!progress) return "Starting...";
    if (progress.phase === "loading") return "Loading audio...";
    return "Transcribing...";
  };

  const getDetailText = () => {
    if (!progress) return null;
    if (progress.phase === "loading") {
      return "Converting audio to required format...";
    }
    if (progress.totalChunks > 1) {
      return `Chunk ${progress.processedChunks + 1} / ${progress.totalChunks} (${progress.chunkProgress}%)`;
    }
    return `Progress: ${Math.round(progress.percent)}%`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-xl max-w-md w-full mx-4">
        <div className="flex flex-col items-center text-center">
          <Spinner size="lg" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
            {getStatusText()}
          </h3>
          {fileName && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 truncate max-w-full">
              {fileName}
            </p>
          )}

          <div className="w-full mt-4">
            <ProgressBar
              progress={progress?.phase === "transcribing" ? progress.percent : 0}
              indeterminate={!progress || progress.phase === "loading"}
            />
            {progress && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {getDetailText()}
                {progress.currentSegments > 0 && (
                  <span className="ml-2">({progress.currentSegments} segments found)</span>
                )}
              </p>
            )}
          </div>

          <Button variant="secondary" className="mt-6" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? "Cancelling..." : "Cancel"}
          </Button>

          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            {cancelling
              ? "Saving partial results..."
              : "Partial results will be saved if cancelled"}
          </p>
        </div>
      </div>
    </div>
  );
}
