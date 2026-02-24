import { useState, useCallback, useRef } from "react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PageSpinner } from "../components/ui/Spinner";
import { Dialog } from "../components/ui/Dialog";
import { SegmentList } from "../components/notes/SegmentList";
import { AudioPlayer, AudioPlayerRef } from "../components/AudioPlayer";
import { useNote } from "../hooks/useNotes";
import { updateNoteTitle, deleteNote, updateSegmentText } from "../api/notes";
import { useToast } from "../contexts/ToastContext";

interface NoteDetailViewProps {
  noteId: number;
  onBack: () => void;
}

export function NoteDetailView({ noteId, onBack }: NoteDetailViewProps) {
  const { note, loading, error, refresh } = useNote(noteId);
  const { showToast } = useToast();

  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showSegments, setShowSegments] = useState(true);
  const [seekTo, setSeekTo] = useState<{ timeMs: number; id: number } | undefined>(undefined);
  const seekIdRef = useRef(0);
  const audioPlayerRef = useRef<AudioPlayerRef>(null);

  const handleTimestampClick = useCallback((timeMs: number) => {
    seekIdRef.current += 1;
    setSeekTo({ timeMs, id: seekIdRef.current });
  }, []);

  const handleSegmentUpdate = useCallback(async (id: number, text: string) => {
    await updateSegmentText(id, text);
    await refresh();
    showToast("Segment updated", "success");
  }, [refresh, showToast]);

  const handleEditTitle = useCallback(() => {
    if (note) {
      setNewTitle(note.title);
      setEditingTitle(true);
    }
  }, [note]);

  const handleSaveTitle = useCallback(async () => {
    if (!note || !newTitle.trim()) return;

    try {
      await updateNoteTitle(note.id, newTitle.trim());
      await refresh();
      setEditingTitle(false);
      showToast("Title updated", "success");
    } catch (err) {
      showToast("Failed to update title", "error");
    }
  }, [note, newTitle, refresh, showToast]);

  const handleDelete = useCallback(async () => {
    if (!note) return;

    try {
      await deleteNote(note.id);
      showToast("Note deleted", "success");
      onBack();
    } catch (err) {
      showToast("Failed to delete note", "error");
    }
  }, [note, onBack, showToast]);

  const handleCopyText = useCallback(async () => {
    if (!note) return;

    try {
      await navigator.clipboard.writeText(note.fullText);
      showToast("Text copied to clipboard", "success");
    } catch (err) {
      showToast("Failed to copy text", "error");
    }
  }, [note, showToast]);

  if (loading) {
    return <PageSpinner />;
  }

  if (error || !note) {
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
            Note not found
          </h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-500">{error || "Note not found"}</p>
        </div>
      </div>
    );
  }

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

        {editingTitle ? (
          <div className="flex-1 flex items-center gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
            />
            <Button size="sm" onClick={handleSaveTitle}>
              Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditingTitle(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <h1
            className="flex-1 text-xl font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
            onClick={handleEditTitle}
            title="Click to edit"
          >
            {note.title}
          </h1>
        )}

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleCopyText}>
            Copy Text
          </Button>
          <Button variant="danger" onClick={() => setDeleteDialogOpen(true)}>
            Delete
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-400">
        {note.durationSeconds && (
          <span>
            Duration:{" "}
            {Math.floor(note.durationSeconds / 60)}:
            {(note.durationSeconds % 60).toString().padStart(2, "0")}
          </span>
        )}
        {note.language && (
          <span>Language: {note.language.toUpperCase()}</span>
        )}
        <span>Segments: {note.segments.length}</span>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            showSegments
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
          onClick={() => setShowSegments(true)}
        >
          Segments
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            !showSegments
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
          onClick={() => setShowSegments(false)}
        >
          Full Text
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {showSegments ? (
          <SegmentList
            segments={note.segments}
            onTimestampClick={note.audioPath ? handleTimestampClick : undefined}
            onSegmentUpdate={handleSegmentUpdate}
          />
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {note.fullText}
            </p>
          </div>
        )}
      </div>

      {note.audioPath && (
        <AudioPlayer
          ref={audioPlayerRef}
          audioPath={note.audioPath}
          seekTo={seekTo}
        />
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete Note"
        size="sm"
      >
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete "{note.title}"? This action cannot be
          undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setDeleteDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
