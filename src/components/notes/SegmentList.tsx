import { useState, useRef, useEffect } from "react";
import type { Segment } from "../../types";

interface SegmentListProps {
  segments: Segment[];
  onTimestampClick?: (timeMs: number) => void;
  onSegmentUpdate?: (id: number, text: string) => Promise<void>;
}

const SPEAKER_COLORS = [
  { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-700 dark:text-green-300" },
  { bg: "bg-purple-100 dark:bg-purple-900/50", text: "text-purple-700 dark:text-purple-300" },
  { bg: "bg-orange-100 dark:bg-orange-900/50", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-pink-100 dark:bg-pink-900/50", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-teal-100 dark:bg-teal-900/50", text: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-yellow-100 dark:bg-yellow-900/50", text: "text-yellow-700 dark:text-yellow-300" },
  { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300" },
];

function getSpeakerColor(label: string) {
  const match = label.match(/\d+/);
  const idx = match ? (parseInt(match[0], 10) - 1) % SPEAKER_COLORS.length : 0;
  return SPEAKER_COLORS[idx];
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

interface EditableSegmentProps {
  segment: Segment;
  onTimestampClick?: (timeMs: number) => void;
  onUpdate?: (id: number, text: string) => Promise<void>;
}

function EditableSegment({ segment, onTimestampClick, onUpdate }: EditableSegmentProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(segment.text);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(segment.text);
  }, [segment.text]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  const handleSave = async () => {
    if (!onUpdate || text === segment.text) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onUpdate(segment.id, text);
      setEditing(false);
    } catch (_err) {
      setText(segment.text);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setText(segment.text);
    setEditing(false);
  };

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <button
        type="button"
        onClick={() => onTimestampClick?.(segment.startMs)}
        className="text-xs text-blue-500 dark:text-blue-400 font-mono whitespace-nowrap pt-0.5 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
      >
        {formatTime(segment.startMs)}
      </button>
      {segment.speakerLabel && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap font-medium ${getSpeakerColor(segment.speakerLabel).bg} ${getSpeakerColor(segment.speakerLabel).text}`}
        >
          {segment.speakerLabel}
        </span>
      )}
      {editing ? (
        <div className="flex-1 flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={saving}
            className="w-full p-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-900 dark:text-gray-100 flex-1">{segment.text}</p>
      )}
      {!editing && onUpdate && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          title="Edytuj"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export function SegmentList({ segments, onTimestampClick, onSegmentUpdate }: SegmentListProps) {
  if (segments.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-center py-4">No segments</p>;
  }

  return (
    <div className="space-y-3">
      {segments.map((segment) => (
        <EditableSegment
          key={segment.id}
          segment={segment}
          onTimestampClick={onTimestampClick}
          onUpdate={onSegmentUpdate}
        />
      ))}
    </div>
  );
}
