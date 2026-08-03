import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("../src/main.ts", import.meta.url);
const buildConfigUrl = new URL("../esbuild.config.mjs", import.meta.url);
const bundleUrl = new URL("../main.js", import.meta.url);
const manifestUrl = new URL("../manifest.json", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

test("settings expose and persist every supported interface language", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /type PdftionLanguageSetting = "auto" \| PdftionLocale/);
  assert.match(source, /language: PdftionLanguageSetting/);
  assert.match(source, /language: normalizePdftionLanguageSetting\(record\.language\)/);
  assert.match(source, /if \(pdftionLanguagePreference !== "auto"\)/);
  assert.match(source, /\.setName\(uiText\("界面语言", "Interface language"\)\)/);
  assert.match(source, /for \(const option of PDFTION_LANGUAGE_OPTIONS\)/);
  assert.match(source, /this\.plugin\.settings\.language = normalizePdftionLanguageSetting\(value\)/);
});

test("saved PDF ink hides its original native layer as soon as editing begins", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const pdfInkStrokes = state \? \[\] : await this\.plugin\.loadPdfInkAnnotations\(this\.file\)/);
  assert.match(source, /if \(element\.pdfSaved === true\) \{[\s\S]*?this\.pendingNativeInkHidePages\.add\(element\.pageIndex\);\s*this\.updateExternalInkLayerState\(\)/);
  assert.match(source, /translateElement\(element, dx, dy\)/);
});

test("selection interiors move while only the four visible corner handles resize", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /return findResizeHandleAt\(bounds, point, overlay\.cssWidth, overlay\.cssHeight, 8, 0\)/);
  assert.doesNotMatch(source, /textOnly \? 10 : 5/);
  assert.doesNotMatch(source, /textOnly \? 12 : 0/);
  assert.doesNotMatch(source, /canMoveFreshSelection|selectionWasExplicitTap|startedFromFreshSelection/);
  assert.match(source, /this\.selectionBoxContainsPoint\(overlay, point, selectionBounds\)[\s\S]{0,500}?mode: "move"/);
  assert.match(source, /const padX = 9 \/ Math\.max\(1, overlay\.cssWidth\)/);
  assert.match(source, /private setSelectedElementForEditing\(element: InkElement\): void \{\s*this\.setSingleSelectedElement\(element\.id\);\s*\}/);
  assert.doesNotMatch(source, /findStrokeEditGroup|strokesAreVisuallyConnected/);
  assert.match(source, /const ordered = this\.getEditableElementsForPage\(overlay\.pageIndex\)\.reverse\(\)/);
  assert.match(source, /const selectedElements = this\.findElementsInSelection[\s\S]{0,160}?this\.setSelectedElements\(selectedElements\)/);
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

test("Markdown conversion prioritizes links and keeps floating media in NoteDraw", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const noteDraw = getNoteDrawWriteApi\(\)/);
  assert.match(source, /const visualPages = await this\.captureVisualConversionPages\(\{/);
  assert.match(source, /collectNoteDrawExportImages\(visualPages, this\.getEditableElements\(\)\)/);
  assert.match(source, /\.filter\(isUsefulMarkdownExportImage\)/);
  assert.match(source, /partitionMarkdownExportImages\(pages, persistedImages\)/);
  assert.match(source, /noteDraw \? inlineImages : \[\.\.\.inlineImages, \.\.\.floatingImages\]/);
  assert.match(source, /function isUsefulNativeExportImage\(image: VisualConversionImage\)/);
  assert.match(source, /estimatedBytes >= 16_000 \|\| image\.width \* image\.height >= 0\.12/);
  assert.match(source, /placement\?: "floating" \| "flow" \| "ink-preview"/);
  assert.match(source, /placement: "floating" as const/);
  assert.match(source, /usesFullPageImage && image\.id\.startsWith\("pdf-raster-page-"\)/);
  assert.doesNotMatch(source, /writeVisualConversionImages\(pages\)/);
  assert.match(source, /persistNoteDrawExportImages/);
  assert.ok(source.includes('const assetDir = `${targetPath.replace(/\\.md$/i, "")}-assets`;'));
  assert.match(source, /assetPath: image\.assetPath/);
  assert.match(source, /const commonImage = `!\[\$\{alt\}\]\(\$\{escapeMarkdownLinkDestination\(relativePath\)\}\)`/);
  assert.match(source, /return `!\[\[\$\{escapeObsidianWikilink\(image\.assetPath\)\}\]\]`/);
  assert.match(source, /buildNoteDrawExportData\(targetPath, pages, this\.getEditableElements\(\), floatingImages\)/);
  assert.match(source, /function getRelativeMarkdownPath/);
  assert.match(source, /const opened = await this\.openConvertedMarkdownFile\(targetFile\)/);
  assert.match(source, /brush: element\.tool === "highlight" \? "watercolor" : "pen"/);
});

test("Markdown conversion recovers external, Obsidian, PDF, image, and attachment links", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /annotation\.url \?\? annotation\.unsafeUrl/);
  assert.match(source, /getPdfAnnotationExportLink\(annotation\)/);
  assert.match(source, /\["href", "data-href", "data-linkpath", "data-url"\]/);
  assert.match(source, /#nameddest=\$\{encodeURIComponent\(destination\)\}/);
  assert.match(source, /normalizeSafeMarkdownExportLink\(run\.link\)/);
  assert.match(source, /\^\(\?:data\|javascript\|vbscript\):/);
  assert.match(source, /new URLSearchParams\(query\)\.get\("file"\)/);
  assert.match(source, /escapeObsidianWikilink\(obsidianTarget \?\? pdfTarget \?\? ""\)/);
  assert.match(source, /destination \? `\[\$\{commonImage\}\]\(\$\{escapeMarkdownLinkDestination\(destination\)\}\)`/);
  assert.match(source, /image\.link \|\| image\.placement === "flow"/);
});

test("Markdown conversion uses native Markdown without HTML presentation elements", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const markdownSource = source.slice(source.indexOf("function buildEditableMarkdown"), source.indexOf("function getCommonCalloutIcon"));

  assert.match(source, /function buildEditableMarkdown\([\s\S]{0,220}?targetPath = ""/);
  assert.match(source, /function collectEditableMarkdownLines\(overlay: PageOverlay\)/);
  assert.match(markdownSource, /buildNativeExportDocument\(pages, images\)/);
  assert.ok(markdownSource.includes('output.push(`${"    ".repeat(block.listLevel ?? 0)}- [${block.checked ? "x" : " "}] ${text}`'));
  assert.match(markdownSource, /block\.kind === "code"/);
  assert.match(markdownSource, /block\.kind === "table"/);
  assert.match(markdownSource, /block\.kind === "callout-title"/);
  assert.match(markdownSource, /renderMarkdownExportImage\(file, block\.image, targetPath\)/);
  assert.doesNotMatch(markdownSource, /<\/?(?:a|div|font|label|section|span|style)\b/i);
  assert.match(source, /const headingProfile = buildEditableMarkdownHeadingProfile\(pages\)/);
  assert.match(source, /getEditableMarkdownHeadingLevel\(line, baseFontSize, text, headingProfile\)/);
  assert.match(markdownSource, /renderEditableMarkdownRun\(run, document\.baseFontSize, false, file\)/);
  assert.match(source, /detectEditableMarkdownTables\(page\.lines\)/);
  assert.match(source, /const taskMarker = text\.match\(\/\^\[☐□◻☑☒✅\]/);
  assert.match(source, /getEditableMarkdownSemanticSection\(text\)/);
  assert.match(source, /semanticSection\?\.kind === "unordered"/);
  assert.match(source, /semanticSection\?\.kind === "ordered"/);
  assert.match(source, /applyEditableMarkdownSemanticStyles/);
  assert.doesNotMatch(markdownSource, /来源 PDF|Source PDF|pagePosition/);
  assert.doesNotMatch(markdownSource, /<section\b|<div\b|<input\b|<label\b/i);
});

test("document exports use native editable text, tables, links, and image-only visual layers", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const renderedLines = collectEditableMarkdownLines\(overlay\)/);
  assert.match(source, /collectPdfJsEditableLines\(pageView, overlay\)/);
  assert.match(source, /const text = \(item\.str \?\? ""\).*?if \(!text\.trim\(\)/s);
  assert.match(source, /lines,\s*pageIndex: overlay\.pageIndex/);
  assert.match(source, /exportConvertedPptx[\s\S]{0,300}?captureVisualConversionPages\(\)/);
  assert.match(source, /exportConvertedDocx[\s\S]{0,220}?const pages = await this\.captureVisualConversionPages\(\)/);
  assert.match(source, /exportConvertedPptx[\s\S]{0,220}?const pages = await this\.captureVisualConversionPages\(\)/);
  assert.match(source, /slide\.addText\(textRuns/);
  assert.match(source, /slide\.addTable\(rows/);
  assert.match(source, /element\.kind === "image" && options\.includeImages !== false/);
  assert.match(source, /await this\.drawImageElementForExport/);
  assert.match(source, /renderNativeExportHtmlBlock/);
  assert.match(source, /<span style=/);
  assert.doesNotMatch(source, /<svg class="text-layer"|lengthAdjust="spacingAndGlyphs"/);
  assert.match(source, /await buildDocxFromPageImages\(pages, this\.file\.basename\)/);
  assert.match(source, /await import\("docx"\)/);
  assert.match(source, /new ImageRun\(\{/);
  assert.match(source, /new TextRun\(\{/);
  assert.match(source, /new Table\(\{/);
  assert.match(source, /new ExternalHyperlink\(\{/);
  assert.match(source, /data: dataUrlToBytes\(image\.dataUrl\)/);
  assert.equal((source.match(/return injectOfficePreviewPages\(/g) ?? []).length, 2);
  assert.match(source, /zip\.file\("mpe\/preview\/manifest\.json"/);
  assert.match(source, /generator: "Obsidian Mobile PDF Exporter"/);
  assert.match(source, /producer: "Pdftion"/);
  assert.match(source, /mpe\/preview\/page-\$\{String\(pageIndex \+ 1\)\.padStart\(4, "0"\)\}\.png/);
  assert.match(source, /pageCount: sortedPages\.length/);
  assert.match(source, /transparency: Math\.round\(\(1 - clamp\(run\.opacity \?\? 1, 0, 1\)\) \* 100\)/);
  assert.match(source, /const sorted = fragments\.sort\(\(a, b\) => \(a\.top - b\.top\) \|\| \(a\.left - b\.left\)\)/);
  assert.match(source, /function buildNativeExportDocument/);
  assert.match(source, /function buildInkVisualExportImages/);
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
  assert.match(source, /this\.startLayerLongPress\(overlay, point, event\.clientX, event\.clientY, hitElement\)/);
  assert.match(source, /this\.startLayerLongPress\(overlay, point, touch\.clientX, touch\.clientY, hitElement\)/);
  assert.doesNotMatch(source.slice(source.indexOf("private createPaletteSelectionGroup"), source.indexOf("private createPaletteColorButton")), /pdftion-layer-actions/);
  assert.match(source, /preview\.textContent = comment\.text\.trim\(\)/);
  assert.match(source, /normalizeInkElementLayers\(elements\)/);
  assert.match(source, /return elements\.sort\(compareInkElements\)/);
  assert.match(source, /const orderedElements = this\.getEditableElementsForPage\(overlay\.pageIndex\)/);
  assert.match(source, /const ordered = this\.getEditableElementsForPage\(overlay\.pageIndex\)\.reverse\(\)/);
  assert.match(source, /elements\.sort\(compareInkElements\)/);
});

test("visual capture recovers native PDF text and separates text from image and ink layers", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /pageEl\?\.scrollIntoView\(\{ behavior: "auto", block: "center", inline: "nearest" \}\)/);
  assert.match(source, /ensurePdfPageRenderedForExport\(pageIndex, pageEl\)/);
  assert.match(source, /renderPdfPageCanvasForExport\(overlay\)/);
  assert.match(source, /pdfPage\.render\(\{/);
  assert.match(source, /transform: outputScale === 1 \? undefined : \[outputScale, 0, 0, outputScale, 0, 0\]/);
  assert.match(source, /directPageView\?\.pdfPage\?\.render/);
  assert.match(source, /canvasStillBlank = candidate\.sourceVisualRatio < 0\.00035 && candidate\.lines\.length > 0/);
  assert.match(source, /ctx\.drawImage\(pdfCanvas/);
  assert.match(source, /dataUrl: await convertImageDataUrlToPng\(image\.dataUrl\)/);
  assert.match(source, /await this\.drawImageElementForExport\(ctx, element/);
  assert.match(source, /drawStroke\(ctx, element, overlay\.cssWidth, overlay\.cssHeight, false\)/);
  assert.match(source, /drawTextElement\(ctx, element, overlay\.cssWidth, overlay\.cssHeight, false\)/);
  assert.match(source, /extractHtmlDerivedVisualLayers\(canvas, lines, overlay\.pageIndex\)/);
  assert.match(source, /selectCompleteEditableLines\(renderedLines, pdfLines\)/);
  assert.match(source, /hasLinks\(pdfLines\) && !hasLinks\(renderedLines\)/);
  assert.match(source, /enrichEditableLineMetadata\(renderedLines, pdfLines\)/);
  assert.match(source, /const link = run\.link \?\? supplementalLink/);
  assert.match(source, /underline: run\.underline \|\| supplemental\.underline \|\| Boolean\(link\)/);
  assert.match(source, /mergeInkTextExportLines/);
  assert.match(source, /sampleEditableTextColors\(pdfCanvas, lines\)/);
  assert.match(source, /buildInkVisualExportImages/);
  assert.match(source, /findOverlappingExportLink/);
  assert.match(source, /id: `pdf-raster-page-\$\{pageIndex \+ 1\}-\$\{visuals\.length \+ 1\}`/);
  assert.match(source, /page\.images\s*\.filter\(isUsefulNativeExportImage\)/);
  assert.match(source, /return `\$\{leadingSpace\}\$\{content\}\$\{trailingSpace\}`/);
  assert.match(source, /colors\.size >= 8/);
  assert.match(source, /density >= 0\.055/);
  const pptSource = source.slice(source.indexOf("async function buildPptxFromPageImages"), source.indexOf("function buildSelfContainedVisualHtml"));
  assert.match(pptSource, /data: image\.dataUrl/);
  assert.doesNotMatch(pptSource, /uint8ArrayToDataUrl\(page\.bytes/);
  assert.match(pptSource, /fit: "shrink"/);
  assert.doesNotMatch(pptSource, /transparency: 100/);
});

test("placeholder pages, precise stroke hits, and immediate drag redraw stay interactive", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const dragEndSource = source.slice(
    source.indexOf("private endSelectionInteraction"),
    source.indexOf("private onTouchStart")
  );

  assert.match(source, /return candidate\.clientWidth > 0 && candidate\.clientHeight > 0/);
  assert.match(source, /return strokeContainsPoint\(stroke, point, cssWidth, cssHeight, hitRadius\)/);
  assert.match(source, /Math\.max\(12, displayWidth \* 2\.4\)/);
  assert.match(source, /coverBoxContainsPoint\(element, point, overlay\.cssWidth, overlay\.cssHeight, 7\)/);
  assert.doesNotMatch(source, /startedFromFreshSelection|selectionWasExplicitTap/);
  const dragMoveSource = source.slice(
    source.indexOf("private moveSelectionInteraction"),
    source.indexOf("private onPointerUp")
  );
  assert.match(dragMoveSource, /this\.redrawPageOverlays\(overlay\.pageIndex\)/);
  assert.match(dragMoveSource, /drag\.elements \?\? this\.getSelectedEditableElements/);
  assert.doesNotMatch(dragMoveSource, /updateExternalInkLayerState|scheduleExternalInkLayerUpdate/);
  assert.match(source, /private redrawPageOverlays[\s\S]{0,220}?this\.requestOverlayRedraw\(candidate\)/);
  assert.match(source, /private redrawSelectionState[\s\S]{0,260}?this\.requestOverlayRedraw\(overlay\)/);
  assert.match(source, /const orderedElements = this\.getEditableElementsForPage\(overlay\.pageIndex\)/);
  assert.match(source, /const hitElement = this\.findElementAt\(overlay, point\);\s*this\.startLayerLongPress[\s\S]{0,180}?this\.beginInkInteraction\(point, overlay, hitElement\)/);
  assert.doesNotMatch(source.slice(source.indexOf("private rememberHistory"), source.indexOf("private findElementById")), /JSON\.stringify/);
  assert.equal((dragEndSource.match(/this\.scheduleAutoSave\(250\)/g) ?? []).length, 2);
  assert.doesNotMatch(dragEndSource, /saveIntoPdf|reloadNativePdfView|requestNativePdfPageRender|commitDetachedInkPages/);
});

test("PDF zoom debounces mutation work and preserves transient sessions", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const mutationSource = source.slice(
    source.indexOf("this.mutationObserver = new MutationObserver"),
    source.indexOf("this.mutationObserver.observe")
  );
  const surfaceScanSource = source.slice(
    source.indexOf("private scanPdfSurfaces"),
    source.indexOf("private findLeafForFile")
  );

  assert.match(mutationSource, /this\.scheduleEditableInkPrepare\(320, true\)/);
  assert.doesNotMatch(mutationSource, /window\.setTimeout/);
  assert.match(source, /const PDF_SURFACE_MISSING_GRACE_MS = 2500/);
  assert.match(surfaceScanSource, /this\.missingPdfSurfaces\.set\(rootEl, now\)/);
  assert.match(surfaceScanSource, /now - missingSince < PDF_SURFACE_MISSING_GRACE_MS/);
  assert.ok(surfaceScanSource.indexOf("now - missingSince < PDF_SURFACE_MISSING_GRACE_MS") < surfaceScanSource.indexOf("session.destroy()"));
});

test("text selection supports no highlight and frequent rendering work is frame-coalesced", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /createIconButton\("ban", uiText\("无色", "No highlight"\)\)/);
  assert.match(source, /private applyNativeTextNoHighlight\(\): void/);
  assert.match(source, /const covers = this\.findNativeTextHighlightCovers\(info\)/);
  assert.match(source, /this\.collapseNativeTextHighlightCovers\(info, this\.findNativeTextHighlightCovers\(info\)\)/);
  assert.match(source, /this\.coverHistory = this\.coverHistory\.filter\(\(cover\) => !ids\.has\(cover\.id\)\)/);
  assert.match(source, /private scheduleVisibleOverlayRefresh\(\): void[\s\S]{0,420}?window\.requestAnimationFrame/);
  assert.match(source, /private scheduleExternalInkLayerUpdate\(\): void[\s\S]{0,420}?window\.requestAnimationFrame/);
  assert.match(source, /overlay\.geometryFrame = window\.requestAnimationFrame/);
  assert.match(source, /private redrawAll\(\): void \{\s*this\.scheduleExternalInkLayerUpdate\(\)/);
  assert.doesNotMatch(source.slice(source.indexOf("private moveSelectionInteraction"), source.indexOf("private onPointerUp")), /updateExternalInkLayerState/);
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
  assert.match(source, /nativeTextSelectionAction: "copy"/);
  assert.doesNotMatch(source, /if \(this\.nativeTextSelectionAction === "highlight"\) \{\s*this\.ensureNativeTextAutoHighlight\(info\)/);
  assert.match(source, /private ensureNativeTextAutoHighlight\(info: NativeTextSelectionInfo/);
  assert.match(source, /createdIds: \[\]/);
  assert.match(source, /private prepareNativeTextCopy\(info: NativeTextSelectionInfo\)/);
  assert.match(source, /const ids = new Set\(pending\.createdIds\)/);
  assert.match(source, /this\.nativeTextSelectionAction = "copy"/);
  assert.match(source, /this\.coverHistory = this\.coverHistory\.filter\(\(cover\) => !ids\.has\(cover\.id\)\)/);
  assert.match(source, /this\.nativeTextSelectionAction = "highlight"/);
  assert.match(source, /horizontalOverlap >= 0\.55 && verticalOverlap >= 0\.6/);
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
  assert.equal(packageJson.dependencies.jszip, "^3.10.1");
  assert.equal(manifest.author, "Murat");
  assert.equal(packageJson.author, "Murat");
});
