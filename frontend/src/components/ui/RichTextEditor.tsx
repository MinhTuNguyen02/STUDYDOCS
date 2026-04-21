import { useMemo, useRef, useCallback, Suspense, lazy } from "react";
import "react-quill-new/dist/quill.snow.css";

// Lazy-load ReactQuill to avoid Quill global register issues during Vite HMR/SSR-like init
const ReactQuill = lazy(() => import("react-quill-new"));

const getEmbedUrl = (url: string): string => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}?rel=0`;
    return url;
};

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
}

const toolbarTitles: Record<string, string> = {
    font: 'Phông chữ', header: 'Đầu mục', size: 'Kích thước chữ',
    bold: 'In đậm', italic: 'In nghiêng', underline: 'Gạch chân', strike: 'Gạch ngang',
    color: 'Màu chữ', background: 'Màu nền', script: 'Chỉ số',
    list: 'Danh sách', indent: 'Thụt lề', direction: 'Hướng văn bản', align: 'Căn lề',
    link: 'Chèn liên kết', image: 'Chèn ảnh', video: 'Chèn video',
    blockquote: 'Trích dẫn', 'code-block': 'Khối mã', clean: 'Xóa định dạng'
};

const RichTextEditor = ({ value, onChange }: RichTextEditorProps) => {
    const quillRef = useRef<any>(null);

    const setupTooltips = useCallback(() => {
        const toolbar = document.querySelector('.ql-toolbar');
        if (!toolbar) return;
        toolbar.querySelectorAll<HTMLElement>('button, .ql-picker').forEach(el => {
            const cls = Array.from(el.classList).find(c => c.startsWith('ql-'));
            if (cls) {
                const key = cls.replace('ql-', '');
                if (toolbarTitles[key]) el.setAttribute('title', toolbarTitles[key]);
            }
        });
    }, []);

    const videoHandler = useCallback(() => {
        const url = prompt("Nhập link YouTube:");
        if (!url) return;
        const quill = quillRef.current?.getEditor?.();
        const range = quill?.getSelection?.();
        if (quill && range) {
            quill.insertEmbed(range.index, "video", getEmbedUrl(url), "user");
            quill.insertText(range.index + 1, '\n', "user");
            quill.setSelection(range.index + 2);
        }
    }, []);

    const modules = useMemo(() => ({
        toolbar: {
            container: [
                [{ font: [] }],
                [{ header: [1, 2, 3, 4, 5, 6, false] }],
                [{ size: ["small", false, "large", "huge"] }],
                ["bold", "italic", "underline", "strike"],
                [{ color: [] }, { background: [] }],
                [{ script: "sub" }, { script: "super" }],
                [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
                [{ align: [] }],
                ["link", "image", "video", "blockquote", "code-block"],
                ["clean"]
            ],
            handlers: { video: videoHandler }
        }
    }), [videoHandler]);

    return (
        <div className="rich-text-editor-wrapper">
            <Suspense fallback={<div className="h-[400px] bg-muted animate-pulse rounded-lg border border-border flex items-center justify-center text-muted-foreground text-sm">Đang tải editor...</div>}>
                <ReactQuill
                    ref={(el: any) => {
                        quillRef.current = el;
                        if (el) setTimeout(setupTooltips, 100);
                    }}
                    theme="snow"
                    value={value}
                    onChange={onChange}
                    modules={modules}
                    placeholder="Nhập nội dung bài viết..."
                />
            </Suspense>
            <style>{`
                .rich-text-editor-wrapper {
                    border: 2px solid var(--border, #e5e7eb);
                    border-radius: 0.5rem;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    max-height: 700px;
                    background: var(--card, #fff);
                }
                .rich-text-editor-wrapper .quill {
                    display: flex;
                    flex-direction: column;
                }
                .rich-text-editor-wrapper .ql-toolbar.ql-snow {
                    border: none !important;
                    border-bottom: 1px solid var(--border, #e5e7eb) !important;
                    padding: 10px;
                    background: var(--muted, #f9fafb);
                }
                .rich-text-editor-wrapper .ql-container.ql-snow {
                    border: none !important;
                    font-family: inherit;
                    font-size: 1rem;
                    height: 500px;
                }
                .rich-text-editor-wrapper .ql-editor {
                    padding: 20px 24px;
                    line-height: 1.75;
                }
                .rich-text-editor-wrapper .ql-editor.ql-blank::before {
                    font-style: italic;
                    color: #9ca3af;
                    left: 24px;
                }
                /* Dark mode */
                :is(.dark, [data-theme="dark"]) .rich-text-editor-wrapper {
                    border-color: #374151;
                    background: #1f2937;
                }
                :is(.dark, [data-theme="dark"]) .rich-text-editor-wrapper .ql-toolbar.ql-snow {
                    background: #1f2937;
                    border-bottom-color: #374151 !important;
                }
                :is(.dark, [data-theme="dark"]) .rich-text-editor-wrapper .ql-toolbar .ql-stroke { stroke: #d1d5db; }
                :is(.dark, [data-theme="dark"]) .rich-text-editor-wrapper .ql-toolbar .ql-fill { fill: #d1d5db; }
                :is(.dark, [data-theme="dark"]) .rich-text-editor-wrapper .ql-toolbar .ql-picker { color: #d1d5db; }
                :is(.dark, [data-theme="dark"]) .rich-text-editor-wrapper .ql-container.ql-snow { background: #111827; }
                :is(.dark, [data-theme="dark"]) .rich-text-editor-wrapper .ql-editor { color: #f3f4f6; background: #111827; }
                :is(.dark, [data-theme="dark"]) .rich-text-editor-wrapper .ql-picker-options {
                    background: #1f2937 !important;
                    border-color: #374151 !important;
                    color: #f3f4f6;
                }
            `}</style>
        </div>
    );
};

export default RichTextEditor;
