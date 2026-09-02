const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { installReceiptRenderer, parseHtml } = require("./dom-test-helpers.js");

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

test("Markdown keeps multiline annotation comments inside the annotation block", () => {
  const markdown = compat.annotationMarkdown([{
    index: 1,
    selectedText: "fragment",
    annotation: "first line\nsecond line"
  }], "en");

  assert.match(markdown, /\*\*Annotation:\*\* first line\n   second line/);
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

function loadFixture(name, withAnnotations = false) {
  const source = readFileSync(resolve(__dirname, "fixtures", name), "utf8");
  const document = parseHtml(source);
  return withAnnotations ? installReceiptRenderer(document) : document;
}

function openReceiptMessageId(document) {
  const panel = document.querySelector(".cga-sent-receipt__panel");
  return panel?.closest(".cga-sent-receipt")?.closest("[data-message-id]")?.getAttribute("data-message-id") || null;
}

function countOccurrences(value, needle) {
  return String(value).split(needle).length - 1;
}

test("capture reads collapsed and expanded receipts, avoids attachment duplication, and restores the global open receipt", async () => {
  const document = loadFixture("chatgpt-annotations-dom.html", true);
  const entries = exporter.findTurns(document);
  const messageB = entries.find((entry) => entry.roleNode.getAttribute("data-message-id") === "annotation-user-b");

  assert.equal(entries.length, 3);
  assert.equal(openReceiptMessageId(document), "annotation-user-a");

  const snapshot = await exporter.capture(document);

  assert.equal(snapshot.messages.length, 3);
  assert.deepEqual(snapshot.messages.map((message) => message.annotations.map((item) => item.annotation)), [
    ["A comment"],
    ["B comment"],
    ["first annotation line\nsecond annotation line"]
  ]);
  assert.equal(openReceiptMessageId(document), "annotation-user-a");
  assert.ok(document.receiptRenderCount >= 3);

  const attachmentMessage = snapshot.messages[2];
  assert.match(attachmentMessage.html, /attachment\.txt/);
  assert.doesNotMatch(attachmentMessage.html, /cga-sent-receipt/);
  assert.equal(countOccurrences(attachmentMessage.html, "C selected text"), 1);
  assert.equal(countOccurrences(attachmentMessage.markdown, "C selected text"), 1);
  assert.match(attachmentMessage.markdown, /\*\*Annotation:\*\* first annotation line\n   second annotation line/);

  const singleMessage = await exporter.capture(document, { turn: messageB.turn });
  assert.equal(singleMessage.messages.length, 1);
  assert.equal(singleMessage.messages[0].annotations[0].selectedText, "B selected text");
  assert.equal(openReceiptMessageId(document), "annotation-user-a");
});

test("capture remains safe when chatgpt-annotations is absent", async () => {
  const document = loadFixture("chatgpt-dom.html");
  const snapshot = await exporter.capture(document);

  assert.equal(snapshot.messages.length, 2);
  assert.ok(snapshot.messages.every((message) => !message.annotations));
  assert.doesNotMatch(exporter.buildMarkdown(snapshot), /Annotations|Adnotacje/);
});

test("capture restores the original receipt even when base capture fails", async () => {
  const document = loadFixture("chatgpt-annotations-dom.html", true);
  document.defaultView.getComputedStyle = () => {
    throw new Error("synthetic capture failure");
  };

  await assert.rejects(() => exporter.capture(document), /synthetic capture failure/);
  assert.equal(openReceiptMessageId(document), "annotation-user-a");
});

test("capture leaves every receipt collapsed when none was open initially", async () => {
  const document = loadFixture("chatgpt-annotations-dom.html", true);
  document.querySelector(".cga-sent-receipt__toggle").click();
  assert.equal(openReceiptMessageId(document), null);

  await exporter.capture(document);

  assert.equal(openReceiptMessageId(document), null);
});
