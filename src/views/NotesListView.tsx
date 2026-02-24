import { useState, useCallback, useRef } from "react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { NotesList } from "../components/notes/NotesList";
import { UploadDialog } from "../components/UploadDialog";
import { TranscriptionProgress } from "../components/TranscriptionProgress";
import { useNotes } from "../hooks/useNotes";
import { useTranscription } from "../hooks/useTranscription";
import { useToast } from "../contexts/ToastContext";

interface NotesListViewProps {
  onNoteClick: (id: number) => void;
  onSettingsClick: () => void;
}

interface PendingTranscription {
  title: string;
  fileName: string;
  language: string;
}

export function NotesListView({
  onNoteClick,
  onSettingsClick,
}: NotesListViewProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [transcribingFile, setTranscribingFile] = useState<string | null>(null);
  const pendingRef = useRef<PendingTranscription | null>(null);
  const cancelledRef = useRef(false);

  const { notes, loading, error, search, create, refresh } = useNotes();
  const { transcribe, ready, initialize } = useTranscription();
  const { showToast } = useToast();

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);
      search(query);
    },
    [search]
  );

  const handleStartTranscription = useCallback(
    async (
      filePath: string,
      fileName: string,
      title: string,
      language: string
    ) => {
      setTranscribingFile(fileName);
      pendingRef.current = { title, fileName, language };
      cancelledRef.current = false;

      try {
        // Initialize Whisper if needed
        if (!ready) {
          await initialize();
        }

        // Transcribe
        const lang = language === "auto" ? undefined : language;
        const result = await transcribe(filePath, lang);

        // Create note (even if cancelled - partial results)
        if (result.segments.length > 0) {
          const noteTitle = cancelledRef.current
            ? `${title} (partial)`
            : title;

          const noteId = await create(
            noteTitle,
            fileName,
            filePath,
            language === "auto" ? null : language,
            result.durationSeconds,
            result.segments
          );

          if (cancelledRef.current) {
            showToast(
              `Saved ${result.segments.length} segments (partial)`,
              "info"
            );
            await refresh();
          } else {
            showToast("Transcription completed", "success");
            onNoteClick(noteId);
          }
        } else if (cancelledRef.current) {
          showToast("Cancelled - no segments to save", "info");
        }
      } catch (err) {
        if (!cancelledRef.current) {
          showToast(
            err instanceof Error ? err.message : "Transcription failed",
            "error"
          );
        }
      } finally {
        setTranscribingFile(null);
        pendingRef.current = null;
      }
    },
    [ready, initialize, transcribe, create, refresh, onNoteClick, showToast]
  );

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Transcribr
        </h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setUploadOpen(true)}>New Transcription</Button>
          <Button variant="ghost" onClick={onSettingsClick}>
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
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </Button>
        </div>
      </header>

      <div className="p-4">
        <Input
          placeholder="Search notes..."
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-0">
        <NotesList
          notes={notes}
          loading={loading}
          error={error}
          onNoteClick={onNoteClick}
        />
      </div>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onStartTranscription={handleStartTranscription}
      />

      {transcribingFile && (
        <TranscriptionProgress
          fileName={transcribingFile}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
