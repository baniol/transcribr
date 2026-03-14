import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { Button } from "../ui/Button";
import { ProgressBar } from "../ui/ProgressBar";
import { Spinner } from "../ui/Spinner";
import { useSettings } from "../../contexts/SettingsContext";
import { useToast } from "../../contexts/ToastContext";
import {
  getDiarizationModels,
  isDiarizationModelDownloaded,
  downloadDiarizationModel,
  deleteDiarizationModel,
} from "../../api/diarization";
import type { DiarizationModel, DownloadProgress } from "../../types";

interface ModelWithStatus extends DiarizationModel {
  downloaded: boolean;
}

export function DiarizationSettings() {
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();
  const [models, setModels] = useState<ModelWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const available = await getDiarizationModels();
      const withStatus = await Promise.all(
        available.map(async (model) => ({
          ...model,
          downloaded: await isDiarizationModelDownloaded(model.fileName),
        }))
      );
      setModels(withStatus);
    } catch (error) {
      console.error("Failed to load diarization models:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<DownloadProgress>(
        "diarization-model-download-progress",
        (event) => {
          setDownloadProgress(event.payload.percent);
        }
      );
      return unlisten;
    };

    const unlistenPromise = setupListener();
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const enabled =
    settings?.diarizationEnabled === true ||
    settings?.diarizationEnabled === ("true" as unknown as boolean);

  const handleToggle = async () => {
    try {
      await updateSettings("diarizationEnabled", enabled ? "false" : "true");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update setting", "error");
    }
  };

  const handleDownload = async (fileName: string) => {
    try {
      setDownloading(fileName);
      setDownloadProgress(0);
      await downloadDiarizationModel(fileName);
      await refresh();
      showToast("Model downloaded successfully", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Download failed", "error");
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      await deleteDiarizationModel(fileName);
      await refresh();
      showToast("Model deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const allDownloaded = models.every((m) => m.downloaded);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Identify different speakers in your recordings. Requires two additional models (~32MB
            total).
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            enabled ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {enabled && !allDownloaded && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Download both models below to enable speaker diarization during transcription.
        </p>
      )}

      <div className="space-y-3">
        {models.map((model) => {
          const isDownloading = downloading === model.fileName;

          return (
            <div
              key={model.fileName}
              className="p-3 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {model.name}
                    </h3>
                    {model.downloaded && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                        Downloaded
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {model.description}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Size: {model.sizeMb} MB
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {model.downloaded ? (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(model.fileName)}>
                      Delete
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleDownload(model.fileName)}
                      disabled={!!downloading}
                    >
                      {isDownloading ? "Downloading..." : "Download"}
                    </Button>
                  )}
                </div>
              </div>

              {isDownloading && (
                <div className="mt-2">
                  <ProgressBar progress={downloadProgress} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
