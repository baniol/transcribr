import { Select } from "../ui/Select";
import { useSettings } from "../../contexts/SettingsContext";
import { useToast } from "../../contexts/ToastContext";

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

export function LanguageSettings() {
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      await updateSettings("transcriptionLanguage", e.target.value);
      showToast("Language setting saved", "success");
    } catch (_err) {
      showToast("Failed to save language setting", "error");
    }
  };

  return (
    <div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Set the default language for transcription. "Auto-detect" will automatically identify the
        spoken language.
      </div>

      <Select
        label="Default Transcription Language"
        value={settings?.transcriptionLanguage || "auto"}
        onChange={handleChange}
        options={LANGUAGE_OPTIONS}
      />
    </div>
  );
}
