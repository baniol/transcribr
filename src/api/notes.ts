import { invoke } from "@tauri-apps/api/core";
import type { Note, NoteWithSegments, TranscriptionSegment } from "../types";

export async function getNotes(): Promise<Note[]> {
  return invoke<Note[]>("get_notes");
}

export async function getNote(id: number): Promise<NoteWithSegments> {
  return invoke<NoteWithSegments>("get_note", { id });
}

export async function createNote(
  title: string,
  originalFilename: string | null,
  language: string | null,
  durationSeconds: number | null,
  segments: TranscriptionSegment[]
): Promise<number> {
  return invoke<number>("create_note", {
    title,
    originalFilename,
    language,
    durationSeconds,
    segments,
  });
}

export async function updateNoteTitle(
  id: number,
  title: string
): Promise<void> {
  return invoke<void>("update_note_title", { id, title });
}

export async function deleteNote(id: number): Promise<void> {
  return invoke<void>("delete_note", { id });
}

export async function searchNotes(query: string): Promise<Note[]> {
  return invoke<Note[]>("search_notes", { query });
}
