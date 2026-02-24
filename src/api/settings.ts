import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types";

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function updateSetting(key: string, value: string): Promise<void> {
  return invoke<void>("update_setting", { key, value });
}
