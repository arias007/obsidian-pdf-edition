import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("../src/main.ts", import.meta.url);
const buildConfigUrl = new URL("../esbuild.config.mjs", import.meta.url);
const bundleUrl = new URL("../main.js", import.meta.url);
const manifestUrl = new URL("../manifest.json", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

test("saved PDF ink hides its original native layer as soon as editing begins", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /if \(element\.pdfSaved === true\) \{[\s\S]*?this\.pendingNativeInkHidePages\.add\(element\.pageIndex\);\s*this\.updateExternalInkLayerState\(\)/);
  assert.match(source, /translateElement\(element, dx, dy\)/);
});

test("selection interiors move while only the four visible corner handles resize", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /return findResizeHandleAt\(bounds, point, overlay\.cssWidth, overlay\.cssHeight, 5, 0\)/);
  assert.doesNotMatch(source, /textOnly \? 10 : 5/);
  assert.doesNotMatch(source, /textOnly \? 12 : 0/);
  assert.match(source, /private canMoveFreshSelection\(\): boolean \{\s*return this\.selectionWasExplicitTap/);
  assert.match(source, /this\.selectionBoxContainsPoint\(overlay, point\)[\s\S]{0,400}?mode: "move"/);
});

test("all requested visual formats share the page capture pipeline", async () => {
  const source = await readFile(sourceUrl, "utf8");

  for (const format of ["Png", "Pptx", "Html", "Docx", "Markdown"]) {
    assert.match(source, new RegExp(`exportConverted${format}`));
  }
  for (const format of ["Png", "Pptx", "Html"]) {
    assert.match(source, new RegExp(`exportAnnotations${format}: \\(\\) => this\\.getActivePdfSession\\(\\)\\?\\.exportConverted${format}\\(\\)`));
  }
  assert.match(source, /buildCombinedPagePng\(pages\)/);
  assert.match(source, /buildPptxFromPageImages\(pages, this\.file\.basename\)/);
  assert.match(source, /buildSelfContainedVisualHtml\(this\.file, pages\)/);
  assert.match(source, /buildDocxFromPageImages\(pages, this\.file\.basename\)/);
  assert.match(source, /for \(const element of elements\.filter\(\(candidate\) => candidate\.pageIndex === overlay\.pageIndex\)\) \{/);
  assert.match(source, /element\.kind === "cover" && options\.includeCovers !== false/);
  assert.match(source, /for \(let pageIndex = 0; pageIndex < pageCount; pageIndex \+= 1\)/);
  assert.match(source, /Only \$\{pages\.length}\s*\/\s*\$\{pageCount} PDF pages rendered/);
  assert.match(source, /const recentLeaf = this\.app\.workspace\.getMostRecentLeaf\(\)/);
  assert.match(source, /return visiblePdf \?\? visibleOther \?\? matchedPdf \?\? matchedOther/);
  assert.equal((source.match(/await this\.openConvertedFile\((?:targetFile|exportedFile)\)/g) ?? []).length, 5);
  assert.match(source, /await this\.openConvertedMarkdownFile\(targetFile\)/);
  assert.match(source, /const timeout = window\.setTimeout\(finish, 120\)/);
});

test("Markdown conversion keeps native image references and delegates ink to NoteDraw", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const noteDraw = getNoteDrawWriteApi\(\)/);
  assert.match(source, /const visualPages = await this\.captureVisualConversionPages\(\{/);
  assert.match(source, /collectNoteDrawExportImages\(visualPages, this\.getEditableElements\(\)\)/);
  assert.match(source, /\.filter\(isUsefulMarkdownExportImage\)/);
  assert.match(source, /!image\.id\.startsWith\("html-visual-page-"\) && !image\.id\.startsWith\("native-page-"\)/);
  assert.match(source, /partitionMarkdownExportImages\(pages, images\)/);
  assert.match(source, /const inlineImages = noteDraw \? partitionedImages\.inline : images/);
  assert.match(source, /const noteDrawImages = noteDraw \? partitionedImages\.floating : \[\]/);
  assert.match(source, /const markdown = buildEditableMarkdown\(this\.file, pages, inlineImages\)/);
  assert.doesNotMatch(source, /writeVisualConversionImages\(pages\)/);
  assert.match(source, /persistNoteDrawExportImages/);
  assert.ok(source.includes('const assetDir = `${targetPath.replace(/\\.md$/i, "")}-assets`;'));
  assert.match(source, /assetPath: image\.assetPath/);
  assert.ok(source.includes('output.push(`![[${escapeObsidianWikilink(item.value.assetPath ?? item.value.assetName)}]]`'));
  assert.match(source, /noteDraw\.writeDrawings\(targetFile, buildNoteDrawExportData\(targetPath, pages, this\.getEditableElements\(\), noteDrawImages\)\)/);
  assert.match(source, /findSafeMarkdownFloatingImagePosition\(page, image\)/);
  assert.match(source, /if \(!safePosition\) \{\s*inline\.push\(image\)/);
  assert.match(source, /const opened = await this\.openConvertedMarkdownFile\(targetFile\)/);
  assert.match(source, /brush: element\.tool === "highlight" \? "watercolor" : "pen"/);
});

test("Markdown conversion keeps native Markdown and uses minimal HTML for non-native styles", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const markdownSource = source.slice(
    source.indexOf("function buildEditableMarkdown"),
    source.indexOf("function getNoteDrawWriteApi")
  );

  assert.match(source, /function buildEditableMarkdown\(file: TFile, pages: EditableMarkdownPage\[\], images: NoteDrawExportImage\[\] = \[\]\)/);
  assert.match(source, /function collectEditableMarkdownLines\(overlay: PageOverlay\)/);
  assert.match(markdownSource, /function escapeMarkdownInline/);
  assert.ok(markdownSource.includes('return `- [${checked ? "x" : " "}]'));
  assert.ok(markdownSource.includes('content = `**${content}**`;'));
  assert.match(markdownSource, /escapeMarkdownLinkDestination\(validLink\)/);
  assert.match(markdownSource, /<span style=/);
  assert.match(markdownSource, /getEditableMarkdownHeadingLevel\(line, baseFontSize, text\)/);
  assert.match(markdownSource, /renderEditableMarkdownRun\(run, baseFontSize, true\)/);
  assert.match(markdownSource, /detectEditableMarkdownTables\(page\.lines\)/);
  assert.match(markdownSource, /function splitEditableMarkdownTableRow/);
  assert.match(markdownSource, /`\| \$\{rows\[0\]\.join\(" \| "\)\} \|`/);
  assert.match(markdownSource, /Math\.max\(4, baseFontSize \* 0\.30\)/);
  assert.match(markdownSource, /isNearDefaultTextColor\(run\.color\)/);
  assert.match(markdownSource, /const customUnderline = run\.underline && !validLink/);
  assert.doesNotMatch(markdownSource, /<section\b|<div\b|<input\b|<label\b/i);
});

test("visual exports reuse the HTML-quality snapshot and keep editable text", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const lines = collectEditableMarkdownLines\(overlay\)/);
  assert.match(source, /lines,\s*pageIndex: overlay\.pageIndex/);
  assert.match(source, /exportConvertedPptx[\s\S]{0,300}?captureVisualConversionPages\(\)/);
  assert.match(source, /mergeVisualConversionPageImages\([\s\S]{0,180}?collectNoteDrawExportImages\(capturedPages, this\.getEditableElements\(\)\)/);
  assert.match(source, /slide\.addText\(textRuns/);
  assert.match(source, /element\.kind === "image" && options\.includeImages !== false/);
  assert.match(source, /await this\.drawImageElementForExport/);
  assert.match(source, /<div class="text-layer"/);
  assert.ok(source.includes('<w:t xml:space="preserve">'));
  assert.match(source, /buildDocxEditableTextParagraph\(item\.value, baseFontSize, contentWidthTwips, spacingBefore, horizontalOrigin, addHyperlink\)/);
  assert.match(source, /buildDocxEditableTable\(item\.value, baseFontSize, contentWidthTwips, spacingBefore, horizontalOrigin, addHyperlink\)/);
  assert.match(source, /buildDocxInlineImageParagraph\(/);
  assert.match(source, /addImage\(dataUrlToBytes\(image\.dataUrl\), "png"\)/);
  assert.match(source, /<w:hyperlink r:id=/);
  assert.match(source, /<wp:inline distT="0" distB="0" distL="0" distR="0">/);
  assert.doesNotMatch(source, /buildDocxAbsoluteTextLayer|<v:textbox/);
  assert.doesNotMatch(source, /w:right="\$\{rightTwips\}"/);
  assert.doesNotMatch(source, /<w:vanish\/>/);
});

test("comments and element layers are interactive, persistent, and shared by rendering and export", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /type ToolMode = [^;]*"comment"/);
  assert.match(source, /presentation\?: "text" \| "comment"/);
  assert.match(source, /private showTextMenu\(\)/);
  assert.match(source, /private showCommentManager\(\)/);
  assert.match(source, /private showCommentPopover\(comment: InkText, overlay: PageOverlay\)/);
  assert.match(source, /addStandardTextCommentAnnotation\(pdf, page, element/);
  assert.match(source, /zIndex\?: number/);
  assert.match(source, /private reorderSelectedLayers\(mode: "up" \| "down" \| "top" \| "bottom"\)/);
  assert.match(source, /private startLayerLongPress\(overlay: PageOverlay/);
  assert.match(source, /private showLayerMenuForElement\(element: InkElement, overlay: PageOverlay\)/);
  assert.match(source, /this\.startLayerLongPress\(overlay, point, event\.clientX, event\.clientY\)/);
  assert.match(source, /this\.startLayerLongPress\(overlay, point, touch\.clientX, touch\.clientY\)/);
  assert.doesNotMatch(source.slice(source.indexOf("private createPaletteSelectionGroup"), source.indexOf("private createPaletteColorButton")), /pdftion-layer-actions/);
  assert.match(source, /preview\.textContent = comment\.text\.trim\(\)/);
  assert.match(source, /normalizeInkElementLayers\(elements\)/);
  assert.match(source, /return elements\.sort\(compareInkElements\)/);
  assert.match(source, /const orderedElements = this\.getEditableElements\(\)\.filter/);
  assert.match(source, /const ordered = this\.getEditableElements\(\).*\.reverse\(\)/);
  assert.match(source, /elements\.sort\(compareInkElements\)/);
});

test("visual export waits for rendered pages and keeps inserted images compatible", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /pageEl\?\.scrollIntoView\(\{ behavior: "auto", block: "center", inline: "nearest" \}\)/);
  assert.match(source, /ensurePdfPageRenderedForExport\(pageIndex, pageEl\)/);
  assert.match(source, /canvasStillBlank = candidate\.sourceVisualRatio < 0\.00035 && candidate\.lines\.length > 0/);
  assert.match(source, /page\.images[\s\S]{0,500}?slide\.addImage/);
  assert.match(source, /dataUrl: await convertImageDataUrlToPng\(image\.dataUrl\)/);
  assert.match(source, /await this\.drawImageElementForExport\(ctx, element/);
  assert.match(source, /for \(const image of \[\.\.\.page\.images\]\.sort/);
  assert.match(source, /extractHtmlDerivedVisualLayers\(canvas, lines, overlay\.pageIndex\)/);
  assert.match(source, /id: `pdf-raster-page-\$\{pageIndex \+ 1\}-\$\{visuals\.length \+ 1\}`/);
  assert.match(source, /colors\.size >= 8/);
  assert.match(source, /density >= 0\.055/);
  const pptSource = source.slice(source.indexOf("async function buildPptxFromPageImages"), source.indexOf("function buildSelfContainedVisualHtml"));
  assert.ok(pptSource.indexOf("for (const image of [...page.images]") < pptSource.indexOf("for (const line of page.lines)"));
  assert.match(pptSource, /if \(page\.lines\.length === 0\) \{[\s\S]*?uint8ArrayToDataUrl\(page\.bytes/);
  assert.match(pptSource, /slide\.addTable\(tableRows/);
  assert.match(pptSource, /const fontScale = clamp\(12\.5 \/ Math\.max\(1, baseFontSize\), 0\.85, 1\.35\)/);
  assert.doesNotMatch(pptSource, /fit: "shrink"/);
  assert.doesNotMatch(pptSource, /transparency: 100/);
  assert.doesNotMatch(source, /function buildDocxFloatingImageLayer\(/);
});

test("placeholder pages, precise stroke hits, and immediate drag redraw stay interactive", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /return candidate\.clientWidth > 0 && candidate\.clientHeight > 0/);
  assert.match(source, /return strokeContainsPoint\(stroke, point, cssWidth, cssHeight, hitRadius\)/);
  assert.match(source, /startedFromFreshSelection: true/);
  assert.match(source, /this\.updateExternalInkLayerState\(\);\s*this\.redrawPageOverlays\(overlay\.pageIndex\)/);
  assert.match(source, /selectionContainsPdfInk\(overlay\.pageIndex\)/);
  assert.match(source, /await this\.saveIntoPdf\(true\);\s*this\.requestNativePdfPageRender\(pageIndex\)/);
});

test("PDF ink editing is transactional and restores interrupted work", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const prepareSource = source.slice(
    source.indexOf("private async preparePdfInkOverlayForEditing"),
    source.indexOf("private async commitDetachedInkPages")
  );
  const autoSaveSource = source.slice(
    source.indexOf("private scheduleAutoSave"),
    source.indexOf("private clearAutoSaveTimer")
  );

  assert.match(source, /data\/ink-edit-transactions/);
  assert.match(source, /beginInkEditTransaction\(file: TFile, pageIndexes: Set<number>\)/);
  assert.match(source, /Array\.from\(\{ length: pdf\.getPageCount\(\) \}, \(_, pageIndex\) => pageIndex\)/);
  assert.match(source, /removeAllInkAnnotationsOnPages\(pdf, new Set\(transactionPages\)\)/);
  assert.match(source, /backupAnnotationStatePath/);
  assert.match(source, /completeInkEditTransaction\(file: TFile, elements: InkElement\[\], pageIndexes: Set<number>\)/);
  assert.match(source, /Ink verification failed/);
  assert.match(source, /recoverPendingInkEditTransactions\(\)/);
  assert.match(source, /await this\.plugin\.rollbackInkEditTransaction\(this\.file\)/);
  assert.match(source, /await this\.reloadNativePdfView\(\)/);
  assert.doesNotMatch(prepareSource, /commitDetachedInkPages/);
  assert.match(autoSaveSource, /if \(this\.enabled\) \{[\s\S]*?checkpointEditableState\(\)/);
  assert.doesNotMatch(source, /activeWindow, "blur", \(\) => this\.flushAllSessionsSoon\(\)/);
  assert.match(source, /this\.flushSessionsOutsideFile\(file\)/);
  assert.match(source, /checkpointAllSessionsSoon\(\)/);
  assert.match(source, /readPendingInkEditElements\(file\)/);
  assert.match(source, /completeInkEditTransaction\(file, elements, new Set\(record\.pageIndexes\)\)/);
  assert.match(source, /private inkCommitPromises = new Map<string, Promise<boolean>>\(\)/);
  assert.match(prepareSource, /const hasNativeInk = this\.strokeHistory\.some\(\(stroke\) => stroke\.pdfSaved === true\)/);
  assert.doesNotMatch(source, /this\.detachedInkEditPages\.clear\(\);\s*this\.scheduleEditableInkPrepare\(0, true\)/);
  assert.match(source, /flushSessionsOutsideLeaf\(leaf\)/);
  assert.match(source, /void this\.finishPdfInkEditing\(\)/);
});

test("native PDF text selection follows the last highlight or copy action", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /nativeTextSelectionAction: "copy" \| "highlight"/);
  assert.match(source, /if \(this\.nativeTextSelectionAction === "highlight"\) \{\s*this\.ensureNativeTextAutoHighlight\(info\)/);
  assert.match(source, /private ensureNativeTextAutoHighlight\(info: NativeTextSelectionInfo/);
  assert.match(source, /this\.nativeTextAutoHighlight\?\.key === selectionKey/);
  assert.match(source, /private prepareNativeTextCopy\(info: NativeTextSelectionInfo\)/);
  assert.match(source, /this\.nativeTextSelectionAction = "copy"/);
  assert.match(source, /this\.coverHistory = this\.coverHistory\.filter\(\(cover\) => !ids\.has\(cover\.id\)\)/);
  assert.match(source, /this\.nativeTextSelectionAction = "highlight"/);
});

test("PPTX dependencies are browser-safe and the release bundle has no dynamic execution", async () => {
  const [config, bundle, manifestText, packageText] = await Promise.all([
    readFile(buildConfigUrl, "utf8"),
    readFile(bundleUrl, "utf8"),
    readFile(manifestUrl, "utf8"),
    readFile(packageUrl, "utf8")
  ]);
  const manifest = JSON.parse(manifestText);
  const packageJson = JSON.parse(packageText);

  assert.match(config, /name: "pptxgen-browser-runtime"/);
  assert.match(config, /name: "safe-zip-scheduler"/);
  assert.match(config, /dynamicFunctionCount !== 1 \|\| dynamicScriptCount !== 4/);
  assert.doesNotMatch(bundle, /\beval\s*\(/);
  assert.doesNotMatch(bundle, /new\s+Function\s*\(/);
  assert.doesNotMatch(bundle, /createElement\s*\(\s*["']script["']/);
  assert.equal(packageJson.dependencies.pptxgenjs, "^4.0.1");
  assert.equal(manifest.author, "Murat");
  assert.equal(packageJson.author, "Murat");
});
