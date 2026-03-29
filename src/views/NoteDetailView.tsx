import { useState, useCallback, useRef } from "react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PageSpinner } from "../components/ui/Spinner";
import { Dialog } from "../components/ui/Dialog";
import { SegmentList } from "../components/notes/SegmentList";
import { FullTextEditor } from "../components/notes/FullTextEditor";
import { AudioPlayer, AudioPlayerRef } from "../components/AudioPlayer";
import { useNote } from "../hooks/useNotes";
import {
  updateNoteTitle,
  deleteNote,
  updateSegmentText,
  updateNoteFullText,
  saveFullTextWithSegments,
} from "../api/notes";
import { stripHtml, computeSegmentChanges, replaceSegmentTextInHtml } from "../utils/segmentSync";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [editorVersion, setEditorVersion] = useState(0);
  const [seekTo, setSeekTo] = useState<{ timeMs: number; id: number } | undefined>(undefined);
  const seekIdRef = useRef(0);
  const audioPlayerRef = useRef<AudioPlayerRef>(null);
  const segmentsScrollRef = useRef<HTMLDivElement>(null);

  const handleTimestampClick = useCallback((timeMs: number) => {
    seekIdRef.current += 1;
    setSeekTo({ timeMs, id: seekIdRef.current });
  }, []);

  const handleSegmentUpdate = useCallback(
    async (id: number, newText: string) => {
      if (!note) return;
      await updateSegmentText(id, newText);
      if (note.fullTextStored) {
        const oldSegment = note.segments.find((s) => s.id === id);
        if (oldSegment) {
          const updatedHtml = replaceSegmentTextInHtml(note.fullText, oldSegment.text, newText);
          await updateNoteFullText(note.id, updatedHtml);
        }
      }
      const scrollTop = segmentsScrollRef.current?.scrollTop ?? 0;
      await refresh();
      requestAnimationFrame(() => {
        if (segmentsScrollRef.current) {
          segmentsScrollRef.current.scrollTop = scrollTop;
        }
      });
      setEditorVersion((v) => v + 1);
      showToast("Segment updated", "success");
    },
    [note, refresh, showToast]
  );

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
    } catch (_err) {
      showToast("Failed to update title", "error");
    }
  }, [note, newTitle, refresh, showToast]);

  const handleDelete = useCallback(async () => {
    if (!note) return;

    try {
      await deleteNote(note.id);
      showToast("Note deleted", "success");
      onBack();
    } catch (_err) {
      showToast("Failed to delete note", "error");
    }
  }, [note, onBack, showToast]);

  const handleFullTextSave = useCallback(
    async (html: string) => {
      if (!note) return;
      try {
        const newPlainText = stripHtml(html);
        const changes = computeSegmentChanges(note.segments, newPlainText);
        if (changes.length > 0) {
          await saveFullTextWithSegments(note.id, html, changes);
          await refresh();
        } else {
          await updateNoteFullText(note.id, html);
        }
      } catch (_err) {
        showToast("Failed to save text", "error");
      }
    },
    [note, refresh, showToast]
  );

  const handleCopyText = useCallback(async () => {
    if (!note) return;

    try {
      const text = note.fullTextStored ? stripHtml(note.fullText) : note.fullText;
      await navigator.clipboard.writeText(text);
      showToast("Text copied to clipboard", "success");
    } catch (_err) {
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Note not found</h1>
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
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <Button size="sm" variant="secondary" onClick={() => setEditingTitle(false)}>
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
            Duration: {Math.floor(note.durationSeconds / 60)}:
            {(note.durationSeconds % 60).toString().padStart(2, "0")}
          </span>
        )}
        {note.language && <span>Language: {note.language.toUpperCase()}</span>}
        <span>Segments: {note.segments.length}</span>
      </div>

      <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
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
        <div className="ml-auto pr-3">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveMatchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && totalMatches > 0) {
                  e.preventDefault();
                  if (e.shiftKey) {
                    setActiveMatchIndex((i) => (i - 1 + totalMatches) % totalMatches);
                  } else {
                    setActiveMatchIndex((i) => (i + 1) % totalMatches);
                  }
                }
              }}
              placeholder="Search..."
              className="w-56 pl-8 pr-16 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery.length >= 2 && (
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                {totalMatches > 0 ? `${activeMatchIndex + 1}/${totalMatches}` : "0"}
              </span>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveMatchIndex(0);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div ref={segmentsScrollRef} className={`flex-1 overflow-y-auto p-4 ${showSegments ? "" : "hidden"}`}>
        <SegmentList
          segments={note.segments}
          onTimestampClick={note.audioPath ? handleTimestampClick : undefined}
          onSegmentUpdate={handleSegmentUpdate}
          searchQuery={searchQuery}
          activeMatchIndex={showSegments ? activeMatchIndex : -1}
          onMatchCount={showSegments ? setTotalMatches : undefined}
        />
      </div>
      <div className={`flex-1 overflow-hidden p-4 ${showSegments ? "hidden" : ""}`}>
        <FullTextEditor
          key={editorVersion}
          content={note.fullText}
          isHtml={note.fullTextStored}
          onSave={handleFullTextSave}
          searchQuery={searchQuery}
          activeMatchIndex={showSegments ? -1 : activeMatchIndex}
          onMatchCount={showSegments ? undefined : setTotalMatches}
        />
      </div>

      {note.audioPath && (
        <AudioPlayer ref={audioPlayerRef} audioPath={note.audioPath} seekTo={seekTo} />
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete Note"
        size="sm"
      >
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete "{note.title}"? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
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
