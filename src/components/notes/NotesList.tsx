import { NoteCard } from "./NoteCard";
import { PageSpinner } from "../ui/Spinner";
import type { Note } from "../../types";

interface NotesListProps {
  notes: Note[];
  loading: boolean;
  error: string | null;
  onNoteClick: (id: number) => void;
}

export function NotesList({ notes, loading, error, onNoteClick }: NotesListProps) {
  if (loading) {
    return <PageSpinner />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg">No notes yet</p>
        <p className="text-sm mt-2">Click "New Transcription" to create your first note</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onClick={() => onNoteClick(note.id)} />
      ))}
    </div>
  );
}
