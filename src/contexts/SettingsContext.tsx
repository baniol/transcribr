import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getSettings, updateSetting } from "../api/settings";
import type { AppSettings } from "../types";

interface SettingsContextValue {
  settings: AppSettings | null;
  loading: boolean;
  updateSettings: (key: keyof AppSettings, value: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const updateSettings = useCallback(async (key: keyof AppSettings, value: string) => {
    const keyMap: Record<keyof AppSettings, string> = {
      transcriptionLanguage: "transcription_language",
      activeWhisperModel: "active_whisper_model",
      customModelPath: "custom_model_path",
      diarizationEnabled: "diarization_enabled",
    };

    await updateSetting(keyMap[key], value);
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
