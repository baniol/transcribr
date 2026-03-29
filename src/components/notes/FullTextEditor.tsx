import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef } from "react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const searchHighlightKey = new PluginKey("searchHighlight");
const searchMetaKey = "searchUpdate";

function buildDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  query: string,
  activeIndex: number
) {
  if (!query || query.length < 2) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "gi");
  let matchCount = 0;
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    let match;
    while ((match = regex.exec(node.text)) !== null) {
      const isActive = matchCount === activeIndex;
      decorations.push(
        Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
          class: isActive ? "search-highlight-active" : "search-highlight",
        })
      );
      matchCount++;
    }
  });
  return DecorationSet.create(doc, decorations);
}

const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addStorage() {
    return { query: "", activeIndex: -1 };
  },

  addProseMirrorPlugins() {
    const storage = this.storage as { query: string; activeIndex: number };
    return [
      new Plugin({
        key: searchHighlightKey,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc, storage.query, storage.activeIndex);
          },
          apply(tr, oldSet) {
            if (tr.docChanged || tr.getMeta(searchMetaKey)) {
              return buildDecorations(tr.doc, storage.query, storage.activeIndex);
            }
            return oldSet;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

interface FullTextEditorProps {
  content: string;
  isHtml: boolean;
  onSave: (html: string) => void;
  searchQuery?: string;
  activeMatchIndex?: number;
  onMatchCount?: (count: number) => void;
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

export function FullTextEditor({
  content,
  isHtml,
  onSave,
  searchQuery = "",
  activeMatchIndex = -1,
  onMatchCount,
}: FullTextEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const dirtyRef = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit, SearchHighlight],
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

  const onMatchCountRef = useRef(onMatchCount);
  onMatchCountRef.current = onMatchCount;

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    // Update storage and trigger decoration rebuild
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = (editor.storage as any).searchHighlight;
    storage.query = searchQuery;
    storage.activeIndex = activeMatchIndex;
    editor.view.dispatch(editor.state.tr.setMeta(searchMetaKey, true));

    // Report match count
    if (onMatchCountRef.current) {
      let count = 0;
      if (searchQuery && searchQuery.length >= 2) {
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "gi");
        editor.state.doc.descendants((node) => {
          if (node.isText && node.text) {
            const matches = node.text.match(regex);
            if (matches) count += matches.length;
          }
        });
      }
      onMatchCountRef.current(count);
    }

    // Scroll to active match
    requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      const el = editor.view.dom.querySelector(".search-highlight-active");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [editor, searchQuery, activeMatchIndex]);

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
