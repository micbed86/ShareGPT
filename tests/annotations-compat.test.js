const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const exporter = require("../src/exporter.js");
globalThis.ShareGPTExporter = exporter;
require("../src/annotations-compat.js");

const compat = exporter.__annotationsCompatibility;

test("compatibility layer renders annotations without exposing transport JSON", () => {
  const items = [{ index: 1, selectedText: "ważny fragment", annotation: "moja uwaga" }];
  const html = compat.annotationHtml(items, "pl");
  const markdown = compat.annotationMarkdown(items, "pl");

  assert.match(html, /Adnotacje/);
  assert.match(html, /Zaznaczony tekst/);
  assert.match(html, /ważny fragment/);
  assert.match(html, /moja uwaga/);
  assert.doesNotMatch(html, /CHATGPT_ANNOTATIONS_V1|selected_text|source_role/);

  assert.match(markdown, /### Adnotacje/);
  assert.match(markdown, /> ważny fragment/);
  assert.match(markdown, /\*\*Adnotacja:\*\* moja uwaga/);
  assert.doesNotMatch(markdown, /CHATGPT_ANNOTATIONS_V1|selected_text|source_role/);
});

test("compatibility layer targets the public annotation receipt UI", () => {
  const source = readFileSync(resolve(__dirname, "..", "src", "annotations-compat.js"), "utf8");
  assert.match(source, /\.cga-sent-receipt/);
  assert.match(source, /\.cga-sent-receipt__toggle/);
  assert.match(source, /\.cga-sent-receipt__quote/);
  assert.match(source, /\.cga-sent-receipt__comment/);
});

test("manifest loads compatibility after exporter and before content script", () => {
  const manifest = JSON.parse(readFileSync(resolve(__dirname, "..", "manifest.json"), "utf8"));
  const scripts = manifest.content_scripts[0].js;
  assert.deepEqual(scripts.slice(0, 3), ["src/exporter.js", "src/annotations-compat.js", "src/content.js"]);
});
