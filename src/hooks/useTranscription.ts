import { useState, useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  getAvailableModels,
  getModelStatus,
  isModelDownloaded,
  downloadModel,
  deleteModel,
  initWhisper,
  isWhisperReady,
  transcribeFile,
} from "../api/transcription";
import type { WhisperModel, DownloadProgress, TranscriptionResult } from "../types";

interface ModelWithStatus extends WhisperModel {
  downloaded: boolean;
}

export function useWhisperModels() {
  const [models, setModels] = useState<ModelWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const availableModels = await getAvailableModels();
      const modelsWithStatus = await Promise.all(
        availableModels.map(async (model) => ({
          ...model,
          downloaded: await getModelStatus(model.fileName),
        }))
      );
      setModels(modelsWithStatus);
    } catch (error) {
      console.error("Failed to load models:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<DownloadProgress>("model-download-progress", (event) => {
        setDownloadProgress(event.payload.percent);
      });
      return unlisten;
    };

    const unlistenPromise = setupListener();

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const download = useCallback(
    async (fileName: string) => {
      try {
        setDownloading(fileName);
        setDownloadProgress(0);
        await downloadModel(fileName);
        await refresh();
      } finally {
        setDownloading(null);
        setDownloadProgress(0);
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (fileName: string) => {
      await deleteModel(fileName);
      await refresh();
    },
    [refresh]
  );

  return {
    models,
    loading,
    downloading,
    downloadProgress,
    refresh,
    download,
    remove,
  };
}

export function useTranscription() {
  const [ready, setReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkReady = useCallback(async () => {
    try {
      const modelDownloaded = await isModelDownloaded();
      if (!modelDownloaded) {
        setReady(false);
        return false;
      }

      const whisperReady = await isWhisperReady();
      setReady(whisperReady);
      return whisperReady;
    } catch {
      setReady(false);
      return false;
    }
  }, []);

  useEffect(() => {
    checkReady();
  }, [checkReady]);

  const initialize = useCallback(async () => {
    try {
      setInitializing(true);
      setError(null);
      await initWhisper();
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize");
      throw err;
    } finally {
      setInitializing(false);
    }
  }, []);

  const transcribe = useCallback(
    async (filePath: string, language?: string): Promise<TranscriptionResult> => {
      try {
        setTranscribing(true);
        setError(null);

        if (!ready) {
          await initialize();
        }

        const result = await transcribeFile(filePath, language);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transcription failed";
        setError(message);
        throw err;
      } finally {
        setTranscribing(false);
      }
    },
    [ready, initialize]
  );

  return {
    ready,
    initializing,
    transcribing,
    error,
    checkReady,
    initialize,
    transcribe,
  };
}
