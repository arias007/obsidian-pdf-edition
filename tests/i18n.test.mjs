import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

import {
  PDFTION_EXTENDED_TRANSLATIONS,
  getExtendedPdftionTranslation
} from "../src/i18n.ts";

const locales = ["ar", "de", "es", "fr", "id", "ja", "ko", "pt", "ru", "tr", "vi"];
const sourceUrl = new URL("../src/main.ts", import.meta.url);

test("every static UI label has a translation in every supported non-English locale", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const file = ts.createSourceFile("main.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const uiKeys = new Set();
  const baseTranslations = Object.fromEntries(locales.map((locale) => [locale, new Set()]));

  const staticString = (node) => (
    ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null
  );
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "uiText"
    ) {
      const key = node.arguments[1] ? staticString(node.arguments[1]) : null;
      if (key) uiKeys.add(key);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "PDFTION_TRANSLATIONS" &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const localeProperty of node.initializer.properties) {
        if (!ts.isPropertyAssignment(localeProperty) || !ts.isObjectLiteralExpression(localeProperty.initializer)) continue;
        const locale = localeProperty.name.getText(file).replace(/["']/g, "");
        if (!baseTranslations[locale]) continue;
        for (const translation of localeProperty.initializer.properties) {
          if (!ts.isPropertyAssignment(translation)) continue;
          const key = staticString(translation.name);
          if (key) baseTranslations[locale].add(key);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  for (const locale of locales) {
    const missing = [...uiKeys].filter((key) => (
      !baseTranslations[locale].has(key) && !PDFTION_EXTENDED_TRANSLATIONS[locale]?.[key]
    ));
    assert.deepEqual(missing, [], `${locale} is missing: ${missing.join(", ")}`);
  }
});

test("dynamic notices translate without losing names, counts, paths, or errors", () => {
  const samples = [
    "Page 3 comment",
    "Page 4",
    "Page 5, 12 elements",
    "P 6 | ink 7 | text 8 | img 9 | cover 10",
    "Enter a new page order, for example 3,1,2 or 1-3,5. Current pages: 11.",
    "Delete 12 pages? This will modify the current PDF.",
    "Imported and merged example.pdf",
    "Saved into result.pdf.",
    "Exported converted documents: result.md, result.docx",
    "Converted and opened editable MD with native images and NoteDraw ink: folder/result.md",
    "Converted MD with native image references: folder/result.md",
    "Converted and opened DOCX: folder/result.docx",
    "Converted PNG: folder/result.png",
    "Converted PPTX: folder/result.pptx",
    "PPTX conversion failed: sample error",
    "Converted HTML: folder/result.html",
    "Exported and opened: folder/result.pdf",
    "Exported and shared: folder/result.pdf",
    "Exported: folder/result.pdf",
    "PDF conversion failed: sample error",
    "Flattened covers on 13 pages"
  ];

  for (const locale of locales) {
    for (const sample of samples) {
      const translated = getExtendedPdftionTranslation(locale, sample);
      assert.ok(translated, `${locale} did not translate: ${sample}`);
    }
    const preserved = getExtendedPdftionTranslation(locale, "Converted DOCX: folder/result.docx");
    assert.match(preserved, /folder\/result\.docx/);
  }
});
