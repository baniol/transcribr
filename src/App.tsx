import { useState, useCallback } from "react";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ToastProvider } from "./contexts/ToastContext";
import { NotesListView } from "./views/NotesListView";
import { NoteDetailView } from "./views/NoteDetailView";
import { SettingsView } from "./views/SettingsView";
import type { ViewState } from "./types";

function AppContent() {
  const [viewState, setViewState] = useState<ViewState>({ view: "notes" });

  const handleNoteClick = useCallback((noteId: number) => {
    setViewState({ view: "note-detail", noteId });
  }, []);

  const handleSettingsClick = useCallback(() => {
    setViewState({ view: "settings" });
  }, []);

  const handleBack = useCallback(() => {
    setViewState({ view: "notes" });
  }, []);

  switch (viewState.view) {
    case "note-detail":
      return (
        <NoteDetailView
          noteId={viewState.noteId!}
          onBack={handleBack}
        />
      );
    case "settings":
      return <SettingsView onBack={handleBack} />;
    default:
      return (
        <NotesListView
          onNoteClick={handleNoteClick}
          onSettingsClick={handleSettingsClick}
        />
      );
  }
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <div className="h-screen bg-white dark:bg-gray-900">
          <AppContent />
        </div>
      </ToastProvider>
    </SettingsProvider>
  );
}
