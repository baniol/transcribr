import type { Segment } from "../../types";

interface SegmentListProps {
  segments: Segment[];
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SegmentList({ segments }: SegmentListProps) {
  if (segments.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
        No segments
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {segments.map((segment) => (
        <div
          key={segment.id}
          className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
        >
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap pt-0.5">
            {formatTime(segment.startMs)}
          </span>
          <p className="text-sm text-gray-900 dark:text-gray-100 flex-1">
            {segment.text}
          </p>
        </div>
      ))}
    </div>
  );
}
