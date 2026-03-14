export interface Note {
  id: number;
  title: string;
  originalFilename: string | null;
  audioPath: string | null;
  language: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Segment {
  id: number;
  noteId: number;
  text: string;
  startMs: number;
  endMs: number;
  speakerLabel: string | null;
}

export interface NoteWithSegments extends Note {
  segments: Segment[];
  fullText: string;
  fullTextStored: boolean;
}

export interface SegmentUpdate {
  id: number;
  text: string;
}

export interface TranscriptionSegment {
  text: string;
  startMs: number;
  endMs: number;
  speakerLabel: string | null;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  fullText: string;
  durationSeconds: number;
}

export interface WhisperModel {
  name: string;
  fileName: string;
  sizeMb: number;
  url: string;
  description: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

export interface TranscriptionProgress {
  phase: "loading" | "transcribing" | "diarizing";
  processedChunks: number;
  totalChunks: number;
  chunkProgress: number;
  percent: number;
  currentSegments: number;
}

export interface AppSettings {
  transcriptionLanguage: string;
  activeWhisperModel: string;
  customModelPath: string | null;
  diarizationEnabled: boolean;
}

export interface DiarizationModel {
  name: string;
  fileName: string;
  sizeMb: number;
  url: string;
  description: string;
}

export type ViewType = "notes" | "note-detail" | "settings";

export interface ViewState {
  view: ViewType;
  noteId?: number;
}
