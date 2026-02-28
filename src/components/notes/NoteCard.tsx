import { Card } from "../ui/Card";
import type { Note } from "../../types";

interface NoteCardProps {
  note: Note;
  onClick: () => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function NoteCard({ note, onClick }: NoteCardProps) {
  return (
    <Card hoverable className="p-4" onClick={onClick}>
      <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{note.title}</h3>
      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
        <span>{formatDate(note.createdAt)}</span>
        {note.durationSeconds && (
          <>
            <span>•</span>
            <span>{formatDuration(note.durationSeconds)}</span>
          </>
        )}
        {note.language && (
          <>
            <span>•</span>
            <span className="uppercase">{note.language}</span>
          </>
        )}
      </div>
    </Card>
  );
}
