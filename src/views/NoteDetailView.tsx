import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PageSpinner } from "../components/ui/Spinner";
import { Dialog } from "../components/ui/Dialog";
import { SegmentList } from "../components/notes/SegmentList";
import { AudioPlayer, AudioPlayerRef } from "../components/AudioPlayer";
import { useNote } from "../hooks/useNotes";
import { updateNoteTitle, deleteNote, updateSegmentText, updateNoteFullText } from "../api/notes";
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
  const [editingFullText, setEditingFullText] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
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

  const handleEditFullText = useCallback(() => {
    if (!note) return;
    setEditingFullText(true);
  }, [note]);

  // Set initial content when entering edit mode
  useEffect(() => {
    if (editingFullText && editorRef.current && note) {
      editorRef.current.innerText = note.fullText || "";
      editorRef.current.focus();
    }
  }, [editingFullText, note]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value ?? null);
  }, []);

  const handleSaveFullText = useCallback(async () => {
    if (!note || !editorRef.current) return;

    const text = editorRef.current.innerText.trim();
    if (!text) return;

    try {
      await updateNoteFullText(note.id, text);
      await refresh();
      setEditingFullText(false);
      showToast("Full text updated", "success");
    } catch (err) {
      console.error("Error saving full text:", err);
      showToast("Failed to update full text", "error");
    }
  }, [note, refresh, showToast]);

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
          <div>
            {editingFullText ? (
              <div className="flex flex-col gap-2 h-full">
                <div className="flex gap-1 flex-wrap border border-gray-300 dark:border-gray-600 rounded-t-md bg-gray-100 dark:bg-gray-800 px-2 py-1.5">
                  <button
                    className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm font-bold"
                    onMouseDown={(e) => { e.preventDefault(); execCommand("bold"); }}
                    title="Bold (Ctrl+B)"
                  >
                    B
                  </button>
                  <button
                    className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm italic"
                    onMouseDown={(e) => { e.preventDefault(); execCommand("italic"); }}
                    title="Italic (Ctrl+I)"
                  >
                    I
                  </button>
                  <button
                    className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm underline"
                    onMouseDown={(e) => { e.preventDefault(); execCommand("underline"); }}
                    title="Underline (Ctrl+U)"
                  >
                    U
                  </button>
                  <span className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
                  <button
                    className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm"
                    onMouseDown={(e) => { e.preventDefault(); execCommand("insertUnorderedList"); }}
                    title="Bullet List"
                  >
                    &bull; List
                  </button>
                  <button
                    className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm"
                    onMouseDown={(e) => { e.preventDefault(); execCommand("insertOrderedList"); }}
                    title="Numbered List"
                  >
                    1. List
                  </button>
                  <span className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
                  <button
                    className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm"
                    onMouseDown={(e) => { e.preventDefault(); execCommand("indent"); }}
                    title="Indent"
                  >
                    &rarr; Indent
                  </button>
                  <button
                    className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm"
                    onMouseDown={(e) => { e.preventDefault(); execCommand("outdent"); }}
                    title="Outdent"
                  >
                    &larr; Outdent
                  </button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  className="flex-1 min-h-[24rem] p-3 border border-t-0 border-gray-300 dark:border-gray-600 rounded-b-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none overflow-y-auto whitespace-pre-wrap"
                  suppressContentEditableWarning
                />
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveFullText}>Save Changes</Button>
                  <Button
                    variant="secondary"
                    onClick={() => setEditingFullText(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {note.fullText}
                </p>
                <div className="mt-4">
                  <Button onClick={handleEditFullText}>
                    Edit Full Text
                  </Button>
                </div>
              </div>
            )}
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
