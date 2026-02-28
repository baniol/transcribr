import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { useSettings } from "../contexts/SettingsContext";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onStartTranscription: (
    filePath: string,
    fileName: string,
    title: string,
    language: string
  ) => void;
}

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "pl", label: "Polski" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Espanol" },
  { value: "fr", label: "Francais" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Portugues" },
  { value: "ru", label: "Russian" },
  { value: "uk", label: "Ukrainian" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

export function UploadDialog({ open: isOpen, onClose, onStartTranscription }: UploadDialogProps) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("auto");

  const { settings } = useSettings();

  const handleSelectFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Audio",
            extensions: ["wav", "mp3", "m4a", "aac", "mp4"],
          },
        ],
      });

      if (selected) {
        setFilePath(selected);
        const name = selected.split("/").pop() || selected;
        setFileName(name);
        setTitle(name.replace(/\.[^/.]+$/, ""));
      }
    } catch (error) {
      console.error("Failed to select file:", error);
    }
  }, []);

  const handleTranscribe = useCallback(() => {
    if (!filePath || !title.trim() || !fileName) return;

    // Close dialog immediately and start transcription
    onStartTranscription(filePath, fileName, title.trim(), language);

    // Reset state
    setFilePath(null);
    setFileName(null);
    setTitle("");
    setLanguage(settings?.transcriptionLanguage || "auto");
    onClose();
  }, [filePath, fileName, title, language, onStartTranscription, onClose, settings]);

  const handleClose = useCallback(() => {
    setFilePath(null);
    setFileName(null);
    setTitle("");
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onClose={handleClose} title="New Transcription">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Audio File
          </label>
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            onClick={handleSelectFile}
          >
            {filePath ? (
              <div className="text-sm text-gray-900 dark:text-gray-100">{fileName}</div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Click to select audio file
                <br />
                <span className="text-xs">WAV, MP3, M4A</span>
              </div>
            )}
          </div>
        </div>

        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter note title"
        />

        <Select
          label="Language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          options={LANGUAGE_OPTIONS}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleTranscribe} disabled={!filePath || !title.trim()}>
            Transcribe
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
