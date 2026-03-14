import { invoke } from "@tauri-apps/api/core";
import type { DiarizationModel } from "../types";

export async function getDiarizationModels(): Promise<DiarizationModel[]> {
  return invoke<DiarizationModel[]>("get_diarization_models");
}

export async function isDiarizationModelDownloaded(fileName: string): Promise<boolean> {
  return invoke<boolean>("is_diarization_model_downloaded", { fileName });
}

export async function downloadDiarizationModel(fileName: string): Promise<string> {
  return invoke<string>("download_diarization_model", { fileName });
}

export async function deleteDiarizationModel(fileName: string): Promise<void> {
  return invoke<void>("delete_diarization_model", { fileName });
}
