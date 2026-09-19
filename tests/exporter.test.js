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

test("user images are rendered outside the colored text bubble", () => {
  const html = exporter.buildHtml(snapshot({
    messages: [{
      role: "user",
      html: "<p>Opis</p><img src=\"https://example.com/photo.png\" alt=\"photo\">",
      markdown: "Opis"
    }]
  }));
  assert.match(html, /<div class="message-content"><p>Opis<\/p><\/div><div class="message-media"><img/);
  assert.match(html, /\.message-user \.message-content \{[^}]*background: var\(--user\)/);
  assert.match(html, /\.message-media \{[^}]*background: transparent/);
});

test("image-only user messages do not emit an empty colored bubble", () => {
  const html = exporter.buildHtml(snapshot({
    messages: [{
      role: "user",
      html: "<img src=\"https://example.com/photo.png\" alt=\"photo\">",
      markdown: "![photo](https://example.com/photo.png)"
    }]
  }));
  const message = html.match(/<article class="message message-user"[\s\S]*?<\/article>/)[0];
  assert.doesNotMatch(message, /class="message-content"/);
  assert.match(message, /class="message-media"/);
});

test("citation markers stay compact and clickable with a tooltip", () => {
  const html = exporter.buildHtml(snapshot({
    messages: [{
      role: "assistant",
      html: "<p>Fakt<sup class=\"source-ref\"><a class=\"source-ref-link\" href=\"https://example.com/source\" title=\"Example — https://example.com/source\">1</a></sup>.</p>",
      markdown: "Fakt."
    }]
  }));
  assert.match(html, /class="source-ref-link"/);
  assert.match(html, /title="Example — https:\/\/example\.com\/source"/);
  assert.match(html, /\.source-ref-link \{/);
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
