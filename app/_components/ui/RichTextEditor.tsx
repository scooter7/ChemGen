// app/_components/ui/RichTextEditor.tsx
"use client";

import React, { useCallback } from "react";
import { useEditor, EditorContent, Editor, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import UnderlineExtension from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Link2,
  Undo,
  Redo,
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";

interface MenuBarProps {
  editor: Editor | null;
}

const MenuBar: React.FC<MenuBarProps> = ({ editor }) => {
    
  const setLink = useCallback(() => {
    if (!editor) {
        return;
    }
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) {
      return; // cancelled
    }
    if (url === "") {
      // empty → unset link
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }
  
  const commonButtonClass =
    "p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50";
  const activeCommonButtonClass = "bg-indigo-500 text-white";

  return (
    <div className="flex flex-wrap items-center gap-1 border border-b-0 border-gray-300 dark:border-gray-600 p-2 rounded-t-md bg-gray-50 dark:bg-gray-700/50">
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={commonButtonClass}
        title="Undo"
      >
        <Undo size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={commonButtonClass}
        title="Redo"
      >
        <Redo size={18} />
      </button>

      <div className="h-5 border-l border-gray-300 dark:border-gray-500 mx-1"></div>

      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`${
          commonButtonClass
        } ${editor.isActive("bold") ? activeCommonButtonClass : ""}`}
        title="Bold"
      >
        <Bold size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`${
          commonButtonClass
        } ${editor.isActive("italic") ? activeCommonButtonClass : ""}`}
        title="Italic"
      >
        <Italic size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        className={`${
          commonButtonClass
        } ${editor.isActive("underline") ? activeCommonButtonClass : ""}`}
        title="Underline"
      >
        <UnderlineIcon size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={`${
          commonButtonClass
        } ${editor.isActive("strike") ? activeCommonButtonClass : ""}`}
        title="Strikethrough"
      >
        <Strikethrough size={18} />
      </button>

      <div className="h-5 border-l border-gray-300 dark:border-gray-500 mx-1"></div>

      <button
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={`${
          commonButtonClass
        } ${editor.isActive("paragraph") ? activeCommonButtonClass : ""}`}
        title="Paragraph"
      >
        <Pilcrow size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`${
          commonButtonClass
        } ${editor.isActive("heading", { level: 1 }) ? activeCommonButtonClass : ""}`}
        title="Heading 1"
      >
        <Heading1 size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`${
          commonButtonClass
        } ${editor.isActive("heading", { level: 2 }) ? activeCommonButtonClass : ""}`}
        title="Heading 2"
      >
        <Heading2 size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`${
          commonButtonClass
        } ${editor.isActive("heading", { level: 3 }) ? activeCommonButtonClass : ""}`}
        title="Heading 3"
      >
        <Heading3 size={18} />
      </button>

      <div className="h-5 border-l border-gray-300 dark:border-gray-500 mx-1"></div>

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`${
          commonButtonClass
        } ${editor.isActive("bulletList") ? activeCommonButtonClass : ""}`}
        title="Bullet List"
      >
        <List size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`${
          commonButtonClass
        } ${editor.isActive("orderedList") ? activeCommonButtonClass : ""}`}
        title="Numbered List"
      >
        <ListOrdered size={18} />
      </button>

      <div className="h-5 border-l border-gray-300 dark:border-gray-500 mx-1"></div>

      <button
        onClick={setLink}
        className={`${
          commonButtonClass
        } ${editor.isActive("link") ? activeCommonButtonClass : ""}`}
        title="Add Link"
      >
        <Link2 size={18} />
      </button>
    </div>
  );
};

interface RichTextEditorProps {
  initialContent: string;
  onChange?: (htmlContent: string) => void;
  editable?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialContent,
  onChange,
  editable = true,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // history: true, // Removed: Enabled by default
        // strike: true,  // Removed: Enabled by default
      }),
      UnderlineExtension,
      // The StrikeExtension is part of StarterKit, so it can be removed from here
      // if you are not passing specific configurations to it.
      // StrikeExtension, 
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer nofollow",
          class: "text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer",
        },
      }),
    ],
    content: initialContent,
    editable,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base lg:prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[250px] p-4 border border-gray-300 dark:border-gray-600 rounded-b-md bg-white dark:bg-gray-700/30 overflow-y-auto custom-scrollbar",
      },
    },
  });

  const setLinkForBubbleMenu = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  React.useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent, false);
    }
  }, [initialContent, editor]);

  return (
    <div className="rounded-md border border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800 focus-within:ring-indigo-500">
      {editable && editor && <MenuBar editor={editor} />}
      {editor && editable && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100, placement: "bottom-start" }}
          className="bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600 p-1 flex gap-1 items-center"
          shouldShow={({ editor }) => editor.isActive("link")}
        >
          <button
            onClick={setLinkForBubbleMenu}
            className="text-sm px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
          >
            Edit Link
          </button>
          <button
            onClick={() => editor.chain().focus().unsetLink().run()}
            className="text-sm px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
          >
            Remove Link
          </button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;