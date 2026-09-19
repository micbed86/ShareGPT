(function shareGptBackgroundCoreModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ShareGPTBackgroundCore = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function createBackgroundCore() {
  "use strict";

  const MAX_HTML_BYTES = 20 * 1024 * 1024;
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const DEPLOY_HOST = "ship.page";
  const PUBLIC_HOST_SUFFIX = ".shipped.run";
  const LEGACY_PUBLIC_HOST_SUFFIX = ".shipped.page";

  function byteLength(value) {
    return new TextEncoder().encode(String(value || "")).byteLength;
  }

  function validateHtml(html) {
    if (typeof html !== "string" || !html.trim()) {
      throw new Error("Brak treści HTML do opublikowania.");
    }
    if (byteLength(html) > MAX_HTML_BYTES) {
      throw new Error("Plik HTML przekracza bezpieczny limit 20 MB wtyczki.");
    }
    return html;
  }

  function isAllowedAssetUrl(value) {
    let url;
    try {
      url = new URL(value);
    } catch (_error) {
      return false;
    }
    if (url.protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();
    return host === "chatgpt.com"
      || host.endsWith(".chatgpt.com")
      || host === "oaiusercontent.com"
      || host.endsWith(".oaiusercontent.com")
      || host === "oaistatic.com"
      || host.endsWith(".oaistatic.com")
      || host === "openai.com"
      || host.endsWith(".openai.com");
  }

  function normalizeSlug(value) {
    const slug = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!slug || slug.length > 63) return "";
    return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug) ? slug : "";
  }

  function slugFromPublicUrl(value) {
    let url;
    try {
      url = new URL(value);
    } catch (_error) {
      return "";
    }
    if (url.protocol !== "https:") return "";

    const host = url.hostname.toLowerCase();
    for (const suffix of [PUBLIC_HOST_SUFFIX, LEGACY_PUBLIC_HOST_SUFFIX]) {
      if (!host.endsWith(suffix)) continue;
      return normalizeSlug(host.slice(0, -suffix.length));
    }
    return "";
  }

  function normalizeDeployResponse(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Serwer publikacji zwrócił nieprawidłową odpowiedź.");
    }

    // ship.page has changed its public serving domain before. The deployment
    // response is trusted because it comes directly from https://ship.page;
    // use the stable drop slug as the source of truth and construct the
    // canonical public URL locally instead of coupling the extension to the
    // hostname currently returned by the API.
    const slug = normalizeSlug(payload.slug) || slugFromPublicUrl(payload.url);
    if (!slug) {
      throw new Error("Serwer nie zwrócił prawidłowego identyfikatora publikacji.");
    }

    return {
      url: `https://${slug}${PUBLIC_HOST_SUFFIX}/`,
      slug,
      expiresAt: typeof payload.expires_at === "string" ? payload.expires_at : ""
    };
  }

  function isTrustedSender(senderUrl) {
    try {
      const url = new URL(senderUrl || "");
      return url.protocol === "https:" && (url.hostname === "chatgpt.com" || url.hostname.endsWith(".chatgpt.com"));
    } catch (_error) {
      return false;
    }
  }

  return {
    DEPLOY_HOST,
    MAX_HTML_BYTES,
    MAX_IMAGE_BYTES,
    byteLength,
    isAllowedAssetUrl,
    isTrustedSender,
    normalizeDeployResponse,
    validateHtml
  };
});
