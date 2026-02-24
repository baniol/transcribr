import { useState, useCallback, useEffect } from "react";
import {
  getNotes,
  getNote,
  createNote,
  updateNoteTitle,
  deleteNote,
  searchNotes,
} from "../api/notes";
import type { Note, NoteWithSegments, TranscriptionSegment } from "../types";

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getNotes();
      setNotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const search = useCallback(async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = query.trim() ? await searchNotes(query) : await getNotes();
      setNotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(
    async (
      title: string,
      originalFilename: string | null,
      language: string | null,
      durationSeconds: number | null,
      segments: TranscriptionSegment[]
    ) => {
      const id = await createNote(
        title,
        originalFilename,
        language,
        durationSeconds,
        segments
      );
      await refresh();
      return id;
    },
    [refresh]
  );

  const update = useCallback(
    async (id: number, title: string) => {
      await updateNoteTitle(id, title);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: number) => {
      await deleteNote(id);
      await refresh();
    },
    [refresh]
  );

  return {
    notes,
    loading,
    error,
    refresh,
    search,
    create,
    update,
    remove,
  };
}

export function useNote(id: number | null) {
  const [note, setNote] = useState<NoteWithSegments | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (id === null) {
      setNote(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getNote(id);
      setNote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load note");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { note, loading, error, refresh: fetch };
}
