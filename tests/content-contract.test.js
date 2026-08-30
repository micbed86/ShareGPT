const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const source = readFileSync(resolve(__dirname, "..", "src", "content.js"), "utf8");

test("conversation and message menus expose Markdown copy actions", () => {
  assert.match(source, /menuItem\(copy\.copyConversationMarkdown, \(\) => copyMarkdownContent\(null\)\)/);
  assert.match(source, /menuItem\(copy\.copyMessageMarkdown, \(\) => copyMarkdownContent\(turn\)\)/);
});

test("clipboard copy reuses the exact Markdown export builder", () => {
  const functionSource = source.match(/async function copyMarkdownContent\(turn\) \{[\s\S]*?\n  \}/);
  assert.ok(functionSource, "copyMarkdownContent function is missing");
  assert.match(functionSource[0], /capture\(turn, false\)/);
  assert.match(functionSource[0], /exporter\.buildMarkdown\(snapshot\)/);
  assert.match(functionSource[0], /copyToClipboard\(markdown\)/);
});
