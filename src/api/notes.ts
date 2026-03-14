import { invoke } from "@tauri-apps/api/core";
import type { Note, NoteWithSegments, SegmentUpdate, TranscriptionSegment } from "../types";

export async function getNotes(): Promise<Note[]> {
  return invoke<Note[]>("get_notes");
}

export async function getNote(id: number): Promise<NoteWithSegments> {
  return invoke<NoteWithSegments>("get_note", { id });
}

export async function createNote(
  title: string,
  originalFilename: string | null,
  audioPath: string | null,
  language: string | null,
  durationSeconds: number | null,
  segments: TranscriptionSegment[]
): Promise<number> {
  return invoke<number>("create_note", {
    title,
    originalFilename,
    audioPath,
    language,
    durationSeconds,
    segments,
  });
}

export async function updateNoteTitle(id: number, title: string): Promise<void> {
  return invoke<void>("update_note_title", { id, title });
}

export async function deleteNote(id: number): Promise<void> {
  return invoke<void>("delete_note", { id });
}

export async function updateSegmentText(id: number, text: string): Promise<void> {
  return invoke<void>("update_segment_text", { id, text });
}

export async function updateNoteFullText(id: number, fullText: string): Promise<void> {
  return invoke<void>("update_note_full_text", { id, fullText });
}

export async function saveFullTextWithSegments(
  id: number,
  fullText: string,
  segmentUpdates: SegmentUpdate[]
): Promise<void> {
  return invoke<void>("save_full_text_with_segments", { id, fullText, segmentUpdates });
}

export async function searchNotes(query: string): Promise<Note[]> {
  return invoke<Note[]>("search_notes", { query });
}
