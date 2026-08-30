importScripts("background-core.js");

(function initializeShareGptBackground() {
  "use strict";

  const core = self.ShareGPTBackgroundCore;
  const DEPLOY_URL = "https://ship.page/deploy?ttl=604800";

  function errorMessage(error) {
    if (error instanceof Error && error.message) return error.message;
    return "Nieoczekiwany błąd wtyczki.";
  }

  async function deployHtml(html) {
    core.validateHtml(html);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(DEPLOY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        },
        body: html,
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal
      });

      let payload;
      try {
        payload = await response.json();
      } catch (_error) {
        throw new Error(`Serwer publikacji zwrócił nieczytelną odpowiedź (${response.status}).`);
      }

      if (!response.ok) {
        const detail = payload && typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`;
        throw new Error(`Publikacja nie powiodła się: ${detail}`);
      }

      return core.normalizeDeployResponse(payload);
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("Serwer publikacji nie odpowiedział w ciągu 45 sekund.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function bytesToBase64(bytes) {
    const chunkSize = 0x8000;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  async function inlineAsset(url) {
    if (!core.isAllowedAssetUrl(url)) {
      return { dataUrl: "" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {
        cache: "force-cache",
        credentials: "include",
        redirect: "follow",
        signal: controller.signal
      });
      if (!response.ok) return { dataUrl: "" };

      const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!contentType.startsWith("image/")) return { dataUrl: "" };

      const announcedSize = Number(response.headers.get("content-length") || 0);
      if (announcedSize > core.MAX_IMAGE_BYTES) return { dataUrl: "" };

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > core.MAX_IMAGE_BYTES) return { dataUrl: "" };

      return {
        dataUrl: `data:${contentType};base64,${bytesToBase64(new Uint8Array(buffer))}`
      };
    } catch (_error) {
      return { dataUrl: "" };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const senderUrl = sender && sender.tab ? sender.tab.url : sender && sender.url;
    if (!core.isTrustedSender(senderUrl)) {
      sendResponse({ ok: false, error: "Żądanie nie pochodzi z chatgpt.com." });
      return false;
    }

    if (!message || typeof message.type !== "string") {
      sendResponse({ ok: false, error: "Nieprawidłowe żądanie." });
      return false;
    }

    if (message.type === "SHAREGPT_DEPLOY") {
      deployHtml(message.html)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
      return true;
    }

    if (message.type === "SHAREGPT_INLINE_ASSET") {
      inlineAsset(message.url)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
      return true;
    }

    sendResponse({ ok: false, error: "Nieznany typ żądania." });
    return false;
  });
})();
