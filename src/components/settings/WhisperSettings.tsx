import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "../ui/Button";
import { ProgressBar } from "../ui/ProgressBar";
import { Spinner } from "../ui/Spinner";
import { useWhisperModels } from "../../hooks/useTranscription";
import { useSettings } from "../../contexts/SettingsContext";
import { useToast } from "../../contexts/ToastContext";

export function WhisperSettings() {
  const { models, loading, downloading, downloadProgress, download, remove } =
    useWhisperModels();
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();

  const handleDownload = async (fileName: string) => {
    try {
      await download(fileName);
      showToast("Model downloaded successfully", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Download failed",
        "error"
      );
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      await remove(fileName);
      showToast("Model deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  const handleSetActive = async (fileName: string) => {
    try {
      // Clear custom path when selecting a downloaded model
      await updateSettings("customModelPath", "");
      await updateSettings("activeWhisperModel", fileName);
      showToast("Active model changed", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to set active model",
        "error"
      );
    }
  };

  const handleSelectLocalModel = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Whisper Model",
            extensions: ["bin"],
          },
        ],
      });

      console.log("Dialog result:", selected);

      if (selected) {
        await updateSettings("customModelPath", selected);
        showToast("Custom model path set", "success");
      }
    } catch (err) {
      console.error("Dialog error:", err);
      showToast(
        err instanceof Error ? err.message : String(err),
        "error"
      );
    }
  };

  const handleClearCustomModel = async () => {
    try {
      await updateSettings("customModelPath", "");
      showToast("Custom model path cleared", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to clear custom model",
        "error"
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const hasCustomModel = !!settings?.customModelPath;

  return (
    <div className="space-y-6">
      {/* Custom Model Section */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          Use Local Model
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Select a Whisper model file (.bin) already on your disk.
        </p>

        {hasCustomModel ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                Custom Model Active
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
              {settings?.customModelPath}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={handleSelectLocalModel}>
                Change
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClearCustomModel}>
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={handleSelectLocalModel}>
            Select Model File
          </Button>
        )}
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
            or download a model
          </span>
        </div>
      </div>

      {/* Download Models Section */}
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Download a Whisper model for local transcription. Larger models provide
          better accuracy but require more memory and processing time.
        </div>

        {models.map((model) => {
          const isActive =
            !hasCustomModel && settings?.activeWhisperModel === model.fileName;
          const isDownloading = downloading === model.fileName;

          return (
            <div
              key={model.fileName}
              className={`p-4 rounded-lg border ${
                isActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {model.name}
                    </h3>
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {model.description}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Size: {model.sizeMb} MB
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {model.downloaded ? (
                    <>
                      {!isActive && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSetActive(model.fileName)}
                        >
                          Set Active
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(model.fileName)}
                        disabled={isActive}
                      >
                        Delete
                      </Button>
                    </>
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
                <div className="mt-3">
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
