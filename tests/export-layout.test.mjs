import test from "node:test";
import assert from "node:assert/strict";

import { clusterEditableTextFragments } from "../src/export-layout.ts";

const fragment = (top, left, text, height = 10, width = 40) => ({
  bottom: top + height,
  left,
  right: left + width,
  run: { text },
  top
});

test("text fragments with small baseline differences stay on one line", () => {
  const lines = clusterEditableTextFragments([
    fragment(100, 10, "left", 11),
    fragment(101.5, 60, "right", 10)
  ]);

  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].fragments.map((item) => item.run.text), ["left", "right"]);
});

test("adjacent PDF rows do not merge transitively", () => {
  const fragments = Array.from({ length: 20 }, (_, index) => (
    fragment(100 + index * 14, 10 + (index % 3), `row-${index + 1}`, 10)
  ));
  const lines = clusterEditableTextFragments(fragments);

  assert.equal(lines.length, 20);
  assert.deepEqual(lines.map((line) => line.fragments[0].run.text), fragments.map((item) => item.run.text));
});

test("same-row columns remain separate runs in one line", () => {
  const lines = clusterEditableTextFragments([
    fragment(200, 15, "column-a", 12, 60),
    fragment(200.8, 220, "column-b", 11, 70),
    fragment(218, 15, "next-row", 11, 60)
  ]);

  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0].fragments.map((item) => item.run.text), ["column-a", "column-b"]);
  assert.equal(lines[1].fragments[0].run.text, "next-row");
});
