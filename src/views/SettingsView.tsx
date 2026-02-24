import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { WhisperSettings } from "../components/settings/WhisperSettings";
import { LanguageSettings } from "../components/settings/LanguageSettings";

interface SettingsViewProps {
  onBack: () => void;
}

export function SettingsView({ onBack }: SettingsViewProps) {
  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <Button variant="ghost" onClick={onBack}>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Settings
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <Card className="p-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Language
          </h2>
          <LanguageSettings />
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Whisper Models
          </h2>
          <WhisperSettings />
        </Card>
      </div>
    </div>
  );
}
