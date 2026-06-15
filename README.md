# Pdftion

Pdftion is a PDF annotation and editing plugin for note-focused PDF workflows. It adds editable ink, highlights, text overlays, cover blocks, image overlays, visual PDF export, Markdown and DOCX helpers, and an AI-friendly operation API to PDF views and embedded PDF previews.

The plugin is designed for quick annotation inside a note vault: open a PDF, press the pen button in the PDF toolbar, write or edit on the page, and let Pdftion save editable annotation data automatically. When you need a portable file, use the share menu to export a burned-in PDF copy that matches the visible annotated view.

## Features

- Draw pen and highlighter annotations directly on PDF pages.
- Add editable text overlays with color, opacity, size, and font controls.
- Add cover blocks to hide original PDF content visually, then place replacement text or marks on top.
- Insert and move image overlays, including captured regions and vault image files.
- Select, move, resize, delete, undo, and redo plugin-created annotation elements.
- Keep pen, highlighter, text, and eraser settings separate.
- Use an icon-first toolbar and palette that works across language environments.
- Select native PDF text to show an icon-only quick menu for text highlighting and copying a note link.
- Copy a page-aware wiki link whose alias contains the selected text and PDF name.
- Auto-detect the interface language and show Chinese or English notices without a manual language switch.
- Attach the annotation button to normal PDF views and embedded PDF previews where possible.
- Save editable annotation data automatically without modifying the source PDF on every stroke.
- Export a visible burned-in PDF copy for sharing.
- Export visual Markdown and DOCX helper documents.
- Use the Pdftion AI API to inspect, select, update, delete, and export annotation data from scripts or AI agents.

## Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the GitHub release whose tag matches the plugin version.
2. Create a folder named `pdftion` inside your vault's `.obsidian/plugins/` folder.
3. Copy the three downloaded files into `.obsidian/plugins/pdftion/`.
4. Restart the app or reload community plugins.
5. Enable `Pdftion` in Settings -> Community plugins.

## Usage

1. Open a PDF file or an embedded PDF preview.
2. Select PDF text directly to highlight it or copy a page-aware note link.
3. Click the pen button in the PDF toolbar when you want the full annotation toolbar.
4. Use the toolbar icons to select, draw, highlight, add text, add images, erase, undo, redo, export, or open the page navigator.
5. Use the palette icon to adjust the current tool. The palette is icon-first: color swatches, size, opacity, font, and eraser width are exposed through compact controls and tooltips.
6. Edits are saved automatically as editable annotation data.
7. Use the share menu to export a burned-in PDF copy when you need a file that looks like the current annotated view.

## Data Model

Pdftion keeps editable annotation metadata next to the source PDF instead of rewriting the original PDF after every stroke. This avoids frequent PDF preview reloads and keeps ink, text, cover, and image overlays editable after reopening the file.

The original PDF is only rewritten when you explicitly export or share a burned-in copy. Burned-in exports are intended for sharing and review, while the editable metadata remains the preferred working format.

## AI API

Pdftion exposes a `PdftionAI` API on the window for local scripts and AI agents. It can inspect elements, select elements, apply batch edits, export annotation Markdown, insert note links, insert vault images, jump to pages, and trigger export helpers.

This API is meant for local automation inside the current app context. It does not add network requests.

## Limitations

- Pdftion focuses on editable overlays and visual exports. It is not a full low-level PDF object editor.
- Cover blocks visually hide original content, but they do not directly rewrite every original PDF content stream during normal editing.
- Burned-in export creates a shareable copy; keep your source PDF and editable annotation data for future edits.
- Old burned-in annotations without Pdftion metadata cannot always be reconstructed as separate editable objects.
- Encrypted, read-only, or externally locked PDFs may prevent saving or exporting.

## 中文简要说明

Pdftion 是面向笔记工作流的 PDF 批注插件。它支持手写、高亮、文字、遮挡块、图片叠加、自动保存、烧录 PDF 导出、Markdown/DOCX 辅助导出，以及给本地脚本或 AI agent 使用的操作接口。

基本用法：打开 PDF 后可直接选择原生文字，弹出图标菜单进行高亮或复制带页码的 OB 链接；需要完整批注工具时再点击 PDF 工具栏里的笔头按钮。调色板和工具栏尽量图标化，中文/英文界面会自动适配；需要分享时从分享菜单导出烧录 PDF 副本。

注意：平时编辑会保存为可继续修改的标注数据，不会每一笔都改写原 PDF；只有分享/导出烧录 PDF 时才生成所见即所得副本。
