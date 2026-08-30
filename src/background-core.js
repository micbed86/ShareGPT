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
  const PUBLIC_HOST_SUFFIX = ".shipped.page";

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

  function normalizeDeployResponse(payload) {
    if (!payload || typeof payload.url !== "string") {
      throw new Error("Serwer nie zwrócił adresu opublikowanej strony.");
    }

    let publicUrl;
    try {
      publicUrl = new URL(payload.url);
    } catch (_error) {
      throw new Error("Serwer zwrócił nieprawidłowy adres strony.");
    }

    if (publicUrl.protocol !== "https:" || !publicUrl.hostname.endsWith(PUBLIC_HOST_SUFFIX)) {
      throw new Error("Serwer zwrócił adres spoza zaufanej domeny shipped.page.");
    }

    return {
      url: publicUrl.href,
      slug: typeof payload.slug === "string" ? payload.slug : "",
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
