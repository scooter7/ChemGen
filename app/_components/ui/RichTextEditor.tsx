// app/_components/ui/RichTextEditor.tsx
"use client";

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline'; // Import the Underline extension
import React from 'react';

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 border border-gray-300 dark:border-gray-600 p-2 rounded-t-md bg-gray-50 dark:bg-gray-700">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`px-2 py-1 text-sm rounded ${editor.isActive('bold') ? 'bg-indigo-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        title="Bold"
      >
        B
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`px-2 py-1 text-sm rounded ${editor.isActive('italic') ? 'bg-indigo-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        title="Italic"
      >
        I
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={!editor.can().chain().focus().toggleUnderline().run()} // This should now work
        className={`px-2 py-1 text-sm rounded ${editor.isActive('underline') ? 'bg-indigo-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        title="Underline"
      >
        U
      </button>
    </div>
  );
};

interface RichTextEditorProps {
  initialContent: string;
  onChange?: (htmlContent: string) => void;
  editable?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialContent, onChange, editable = true }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // You can configure StarterKit options here if needed
        // e.g., heading: { levels: [1, 2, 3] }
      }),
      Underline, // Add the Underline extension here
    ],
    content: initialContent,
    editable: editable,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert prose-sm sm:prose-base focus:outline-none min-h-[150px] p-3 border-x border-b border-gray-300 dark:border-gray-600 rounded-b-md bg-white dark:bg-gray-700/30',
      },
    },
  });

  React.useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent, false);
    }
  }, [initialContent, editor]);

  return (
    <div>
      {editable && <MenuBar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;