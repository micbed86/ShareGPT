const test = require("node:test");
const assert = require("node:assert/strict");
const exporter = require("../src/exporter.js");

function snapshot(overrides = {}) {
  return {
    title: "Plan wdrożenia | ChatGPT",
    language: "pl",
    generatedAt: "2026-08-20T00:00:00.000Z",
    scope: "conversation",
    theme: {
      mode: "dark",
      background: "rgb(33, 33, 33)",
      text: "rgb(236, 236, 236)",
      userBackground: "rgb(48, 48, 48)"
    },
    messages: [
      { role: "user", html: "<p>Podaj <strong>plan</strong>.</p>", markdown: "Podaj **plan**." },
      { role: "assistant", html: "<p>Gotowe.</p><pre><code class=\"language-js\">const ok = true;</code></pre>", markdown: "Gotowe.\n\n```js\nconst ok = true;\n```" }
    ],
    ...overrides
  };
}

test("slugify handles Polish diacritics and produces a safe filename stem", () => {
  assert.equal(exporter.slugify("Zażółć gęślą jaźń"), "zazolc-gesla-jazn");
  assert.match(exporter.filename(snapshot(), "html"), /^[a-z0-9-]+-rozmowa\.html$/);
});

test("buildHtml emits one responsive static document in the captured theme", () => {
  const html = exporter.buildHtml(snapshot());
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /@media \(max-width: 640px\)/);
  assert.match(html, /--page: rgb\(33, 33, 33\)/);
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /class="message message-user"/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /noindex, nofollow/);
});

test("buildHtml strips active content as defense in depth", () => {
  const html = exporter.buildHtml(snapshot({
    messages: [{
      role: "assistant",
      html: "<p onclick=\"alert(1)\">Tekst</p><script>alert(2)</script><iframe src=\"https://evil.example\"></iframe>",
      markdown: "Tekst"
    }]
  }));
  assert.doesNotMatch(html, /onclick=/i);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<iframe/i);
});

test("buildMarkdown labels both roles and keeps source markdown", () => {
  const markdown = exporter.buildMarkdown(snapshot());
  assert.match(markdown, /^# Plan wdrożenia/m);
  assert.match(markdown, /^## Użytkownik/m);
  assert.match(markdown, /^## Asystent/m);
  assert.match(markdown, /```js\nconst ok = true;/);
});

test("safe URL policy blocks script protocols", () => {
  assert.equal(exporter.isSafeUrl("javascript:alert(1)", "link"), false);
  assert.equal(exporter.isSafeUrl("https://example.com/path", "link"), true);
  assert.equal(exporter.isSafeUrl("data:text/html;base64,QQ==", "image"), false);
});
