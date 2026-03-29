import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef } from "react";

interface FullTextEditorProps {
  content: string;
  isHtml: boolean;
  onSave: (html: string) => void;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
        active
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

export function FullTextEditor({ content, isHtml, onSave }: FullTextEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const dirtyRef = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: isHtml ? content : `<p>${content}</p>`,
    onUpdate: ({ editor }) => {
      dirtyRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        dirtyRef.current = false;
        onSaveRef.current(editor.getHTML());
      }, 1000);
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (dirtyRef.current && editor) {
        onSaveRef.current(editor.getHTML());
      }
    };
  }, [editor]);

  const toggle = useCallback(
    (cmd: string, attrs?: Record<string, unknown>) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      (chain as never as Record<string, (attrs?: Record<string, unknown>) => typeof chain>)
        [`toggle${cmd}`](attrs)
        .run();
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="sticky top-0 z-10 flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <ToolbarButton onClick={() => toggle("Bold")} active={editor.isActive("bold")} title="Bold">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => toggle("Italic")}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => toggle("Strike")}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <s>S</s>
        </ToolbarButton>

        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />

        <ToolbarButton
          onClick={() => toggle("Heading", { level: 1 })}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => toggle("Heading", { level: 2 })}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => toggle("Heading", { level: 3 })}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarButton>

        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />

        <ToolbarButton
          onClick={() => toggle("BulletList")}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          &bull; List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => toggle("OrderedList")}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          1. List
        </ToolbarButton>

        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          Undo
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          Redo
        </ToolbarButton>
      </div>

      <EditorContent
        editor={editor}
        className="tiptap-editor p-4 min-h-[200px] flex-1 overflow-y-auto prose dark:prose-invert max-w-none"
      />
    </div>
  );
}
