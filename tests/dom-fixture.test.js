const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const fixture = readFileSync(resolve(__dirname, "fixtures", "chatgpt-dom.html"), "utf8");

function openingTags(pattern) {
  return [...fixture.matchAll(/<[^>]+>/g)]
    .map((match) => match[0])
    .filter((tag) => pattern.test(tag));
}

test("current ChatGPT DOM fixture exposes stable turn and role contracts", () => {
  const roles = openingTags(/data-message-author-role="(?:user|assistant)"/);
  const turns = openingTags(/data-testid="conversation-turn-\d+"/);
  assert.equal(roles.length, 2);
  assert.equal(turns.length, 2);
  assert.match(roles[0], /data-message-author-role="user"/);
  assert.match(roles[1], /data-message-author-role="assistant"/);
  assert.ok(roles.every((tag) => /data-message-id="[^"]+"/.test(tag)));
});

test("current fixture has the content containers used by the exporter", () => {
  assert.equal(openingTags(/whitespace-pre-wrap/).length, 1);
  assert.equal(openingTags(/class="[^"]*\bmarkdown\b/).length, 1);
  assert.ok(openingTags(/class="[^"]*\bcm-line\b/).length > 0);
});

test("current fixture has native action anchors used for subtle placement", () => {
  const copyButtons = openingTags(/data-testid="copy-turn-action-button"/);
  assert.equal(copyButtons.length, 2);
  assert.match(copyButtons[0], /aria-label="Copy message"/);
  assert.match(copyButtons[1], /aria-label="Copy response"/);
  assert.equal(openingTags(/data-testid="share-chat-button"/).length, 1);
  assert.equal(openingTags(/data-testid="share-prompt-link-turn-action-button"/).length, 1);
  assert.equal(openingTags(/id="conversation-header-actions"/).length, 1);
  assert.equal(openingTags(/data-testid="conversation-options-button"/).length, 1);
});

test("the DOM fixture is not included by the release packaging script", () => {
  const packageScript = readFileSync(resolve(__dirname, "..", "tools", "package.mjs"), "utf8");
  assert.doesNotMatch(packageScript, /DOM\.html/);
  assert.match(packageScript, /manifest\.json/);
  assert.match(packageScript, /"src"/);
});
