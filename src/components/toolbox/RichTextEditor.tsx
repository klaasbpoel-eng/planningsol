import { useState, useCallback } from "react";
import { marked } from "marked";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import CharacterCount from "@tiptap/extension-character-count";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, Heading2, Heading3,
    Undo, Redo, Link as LinkIcon, AlignLeft, AlignCenter,
    AlignRight, Highlighter, Code, Quote, Minus, Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

function ToolbarDivider() {
    return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

function ToolbarToggle({
    pressed,
    onPressedChange,
    label,
    children,
    className,
}: {
    pressed: boolean;
    onPressedChange: () => void;
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <Toggle
            size="sm"
            pressed={pressed}
            onPressedChange={onPressedChange}
            aria-label={label}
            className={cn("h-7 w-7 p-0 data-[state=on]:bg-primary/15 data-[state=on]:text-primary", className)}
        >
            {children}
        </Toggle>
    );
}

// Convert content to HTML if it looks like Markdown (contains ** or starts with *)
function normalizeContent(raw: string): string {
    if (!raw) return "";
    // Already HTML
    if (raw.trimStart().startsWith("<")) return raw;
    // Markdown → HTML
    return marked.parse(raw, { async: false }) as string;
}

export function RichTextEditor({ content, onChange, placeholder }: Props) {
    const [linkUrl, setLinkUrl] = useState("");
    const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: placeholder || "Schrijf hier...",
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: "text-primary underline cursor-pointer" },
            }),
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            Highlight.configure({ multicolor: false }),
            CharacterCount,
        ],
        content: normalizeContent(content),
        editorProps: {
            attributes: {
                class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[180px] px-3 py-2",
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    const setLink = useCallback(() => {
        if (!editor) return;
        if (!linkUrl) {
            editor.chain().focus().unsetLink().run();
        } else {
            const url = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
            editor.chain().focus().setLink({ href: url }).run();
        }
        setLinkUrl("");
        setLinkPopoverOpen(false);
    }, [editor, linkUrl]);

    const openLinkPopover = useCallback(() => {
        if (!editor) return;
        const existing = editor.getAttributes("link").href || "";
        setLinkUrl(existing);
        setLinkPopoverOpen(true);
    }, [editor]);

    if (!editor) return null;

    const wordCount = editor.storage.characterCount?.words() ?? 0;
    const charCount = editor.storage.characterCount?.characters() ?? 0;

    return (
        <div className="border rounded-md overflow-hidden bg-card">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30 flex-wrap">

                {/* History */}
                <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()} className="h-7 w-7 p-0" aria-label="Ongedaan maken">
                    <Undo className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()} className="h-7 w-7 p-0" aria-label="Opnieuw">
                    <Redo className="h-3.5 w-3.5" />
                </Button>

                <ToolbarDivider />

                {/* Headings */}
                <ToolbarToggle pressed={editor.isActive("heading", { level: 2 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    label="Kop 2">
                    <Heading2 className="h-3.5 w-3.5" />
                </ToolbarToggle>
                <ToolbarToggle pressed={editor.isActive("heading", { level: 3 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    label="Kop 3">
                    <Heading3 className="h-3.5 w-3.5" />
                </ToolbarToggle>

                <ToolbarDivider />

                {/* Inline formatting */}
                <ToolbarToggle pressed={editor.isActive("bold")}
                    onPressedChange={() => editor.chain().focus().toggleBold().run()} label="Vet">
                    <Bold className="h-3.5 w-3.5" />
                </ToolbarToggle>
                <ToolbarToggle pressed={editor.isActive("italic")}
                    onPressedChange={() => editor.chain().focus().toggleItalic().run()} label="Cursief">
                    <Italic className="h-3.5 w-3.5" />
                </ToolbarToggle>
                <ToolbarToggle pressed={editor.isActive("underline")}
                    onPressedChange={() => editor.chain().focus().toggleUnderline().run()} label="Onderstrepen">
                    <UnderlineIcon className="h-3.5 w-3.5" />
                </ToolbarToggle>
                <ToolbarToggle pressed={editor.isActive("strike")}
                    onPressedChange={() => editor.chain().focus().toggleStrike().run()} label="Doorhalen">
                    <Strikethrough className="h-3.5 w-3.5" />
                </ToolbarToggle>
                <ToolbarToggle pressed={editor.isActive("highlight")}
                    onPressedChange={() => editor.chain().focus().toggleHighlight().run()} label="Markeren"
                    className="data-[state=on]:bg-yellow-200 data-[state=on]:text-yellow-800 dark:data-[state=on]:bg-yellow-700 dark:data-[state=on]:text-yellow-100">
                    <Highlighter className="h-3.5 w-3.5" />
                </ToolbarToggle>
                <ToolbarToggle pressed={editor.isActive("code")}
                    onPressedChange={() => editor.chain().focus().toggleCode().run()} label="Inline code">
                    <Code className="h-3.5 w-3.5" />
                </ToolbarToggle>

                <ToolbarDivider />

                {/* Alignment */}
                <ToolbarToggle pressed={editor.isActive({ textAlign: "left" })}
                    onPressedChange={() => editor.chain().focus().setTextAlign("left").run()} label="Links uitlijnen">
                    <AlignLeft className="h-3.5 w-3.5" />
                </ToolbarToggle>
                <ToolbarToggle pressed={editor.isActive({ textAlign: "center" })}
                    onPressedChange={() => editor.chain().focus().setTextAlign("center").run()} label="Centreren">
                    <AlignCenter className="h-3.5 w-3.5" />
                </ToolbarToggle>
                <ToolbarToggle pressed={editor.isActive({ textAlign: "right" })}
                    onPressedChange={() => editor.chain().focus().setTextAlign("right").run()} label="Rechts uitlijnen">
                    <AlignRight className="h-3.5 w-3.5" />
                </ToolbarToggle>

                <ToolbarDivider />

                {/* Lists */}
                <ToolbarToggle pressed={editor.isActive("bulletList")}
                    onPressedChange={() => editor.chain().focus().toggleBulletList().run()} label="Opsommingslijst">
                    <List className="h-3.5 w-3.5" />
                </ToolbarToggle>
                <ToolbarToggle pressed={editor.isActive("orderedList")}
                    onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} label="Genummerde lijst">
                    <ListOrdered className="h-3.5 w-3.5" />
                </ToolbarToggle>
                <ToolbarToggle pressed={editor.isActive("blockquote")}
                    onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} label="Citaat">
                    <Quote className="h-3.5 w-3.5" />
                </ToolbarToggle>
                <Button variant="ghost" size="sm"
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    className="h-7 w-7 p-0" aria-label="Horizontale lijn">
                    <Minus className="h-3.5 w-3.5" />
                </Button>

                <ToolbarDivider />

                {/* Link */}
                <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Toggle size="sm" pressed={editor.isActive("link")} onPressedChange={openLinkPopover}
                            aria-label="Link invoegen"
                            className="h-7 w-7 p-0 data-[state=on]:bg-primary/15 data-[state=on]:text-primary">
                            <LinkIcon className="h-3.5 w-3.5" />
                        </Toggle>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="start">
                        <p className="text-xs font-medium mb-2 text-muted-foreground">Link invoegen</p>
                        <div className="flex gap-2">
                            <Input
                                placeholder="https://..."
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && setLink()}
                                className="h-8 text-sm"
                                autoFocus
                            />
                            <Button size="sm" className="h-8 px-3 shrink-0" onClick={setLink}>
                                OK
                            </Button>
                        </div>
                        {editor.isActive("link") && (
                            <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs text-destructive hover:text-destructive gap-1 px-2"
                                onClick={() => { editor.chain().focus().unsetLink().run(); setLinkPopoverOpen(false); }}>
                                <Unlink className="h-3 w-3" /> Link verwijderen
                            </Button>
                        )}
                    </PopoverContent>
                </Popover>
            </div>

            {/* Editor content */}
            <EditorContent editor={editor} />

            {/* Footer: word/char count */}
            <div className="flex items-center justify-end gap-3 px-3 py-1 border-t bg-muted/20 text-[11px] text-muted-foreground">
                <span>{wordCount} {wordCount === 1 ? "woord" : "woorden"}</span>
                <Separator orientation="vertical" className="h-3" />
                <span>{charCount} tekens</span>
            </div>
        </div>
    );
}
