const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/background-core.js");

test("asset allowlist is limited to OpenAI and ChatGPT HTTPS hosts", () => {
  assert.equal(core.isAllowedAssetUrl("https://files.oaiusercontent.com/file.png"), true);
  assert.equal(core.isAllowedAssetUrl("https://chatgpt.com/backend-api/files/id"), true);
  assert.equal(core.isAllowedAssetUrl("http://chatgpt.com/file.png"), false);
  assert.equal(core.isAllowedAssetUrl("https://chatgpt.com.evil.example/file.png"), false);
  assert.equal(core.isAllowedAssetUrl("https://example.com/file.png"), false);
});

test("deploy response accepts only shipped.run HTTPS URLs", () => {
  const normalized = core.normalizeDeployResponse({
    url: "https://quiet-river-c0ffee.shipped.run/",
    slug: "quiet-river-c0ffee",
    expires_at: "2026-08-27T00:00:00.000Z"
  });
  assert.equal(normalized.url, "https://quiet-river-c0ffee.shipped.run/");
  assert.throws(() => core.normalizeDeployResponse({ url: "https://quiet-river-c0ffee.shipped.page/" }), /zaufanej domeny/);
  assert.throws(() => core.normalizeDeployResponse({ url: "https://evil.example/" }), /zaufanej domeny/);
  assert.throws(() => core.normalizeDeployResponse({}), /nie zwrócił adresu/);
});

test("trusted senders must be ChatGPT pages", () => {
  assert.equal(core.isTrustedSender("https://chatgpt.com/c/123"), true);
  assert.equal(core.isTrustedSender("https://sub.chatgpt.com/c/123"), true);
  assert.equal(core.isTrustedSender("https://chatgpt.com.evil.example/c/123"), false);
});

test("HTML validation rejects empty and oversized payloads", () => {
  assert.throws(() => core.validateHtml(""), /Brak treści/);
  assert.equal(core.validateHtml("<!doctype html><p>ok</p>"), "<!doctype html><p>ok</p>");
  assert.throws(() => core.validateHtml("x".repeat(core.MAX_HTML_BYTES + 1)), /20 MB/);
});
