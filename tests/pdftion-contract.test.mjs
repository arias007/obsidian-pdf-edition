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

  assert.match(source, /if \(element\.pdfSaved === true && !element\.pdfPoints\) \{\s*element\.pdfPoints = element\.points\.map[\s\S]*?this\.updateExternalInkLayerState\(\)/);
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
  assert.match(source, /element\.kind === "cover" && element\.pageIndex === overlay\.pageIndex\)\) \{/);
  assert.doesNotMatch(source, /element\.kind === "cover" && element\.pageIndex === overlay\.pageIndex && !element\.saved/);
  assert.match(source, /for \(let pageIndex = 0; pageIndex < pageCount; pageIndex \+= 1\)/);
  assert.match(source, /Only \$\{pages\.length}\s*\/\s*\$\{pageCount} PDF pages rendered/);
  assert.match(source, /const recentLeaf = this\.app\.workspace\.getMostRecentLeaf\(\)/);
  assert.match(source, /return visibleMatched \?\? matched/);
});

test("Markdown conversion delegates ink and floating images to NoteDraw", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const noteDraw = getNoteDrawWriteApi\(\)/);
  assert.match(source, /const pages = await this\.captureEditableMarkdownPages\(\)/);
  assert.match(source, /const markdown = buildEditableMarkdown\(this\.file, pages\)/);
  assert.doesNotMatch(source, /writeVisualConversionImages\(pages\)/);
  assert.match(source, /noteDraw\.writeDrawings\(targetFile, buildNoteDrawExportData/);
  assert.match(source, /const opened = await this\.openConvertedFile\(targetFile\)/);
  assert.match(source, /brush: element\.tool === "highlight" \? "watercolor" : "pen"/);
  assert.match(source, /kind: "embed"/);
  assert.match(source, /embedType: "image"/);
  assert.match(source, /exportImageDataUrl: element\.dataUrl/);
});

test("Markdown conversion emits editable styled text instead of page screenshots", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /function buildEditableMarkdown\(file: TFile, pages: EditableMarkdownPage\[\]\)/);
  assert.match(source, /function collectEditableMarkdownLines\(overlay: PageOverlay\)/);
  assert.match(source, /font-size:\$\{roundCssNumber\(run\.fontSize\)\}px/);
  assert.match(source, /checked \? "x" : " "/);
  assert.match(source, /<strong>/);
  assert.match(source, /<a href=/);
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
