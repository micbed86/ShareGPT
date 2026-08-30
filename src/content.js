(function initializeShareGptContentScript() {
  "use strict";

  const exporter = globalThis.ShareGPTExporter;
  if (!exporter || document.documentElement.hasAttribute("data-sharegpt-extension")) return;
  document.documentElement.setAttribute("data-sharegpt-extension", "1");

  const isPolish = String(document.documentElement.lang || navigator.language || "").toLowerCase().startsWith("pl");
  const copy = isPolish ? {
    globalLabel: "Udostępnij lub eksportuj rozmowę",
    globalShort: "Udostępnij / eksportuj",
    messageLabel: "Udostępnij lub eksportuj tę wypowiedź",
    shareConversation: "Udostępnij rozmowę",
    copyConversationMarkdown: "Kopiuj rozmowę jako Markdown",
    exportConversationHtml: "Eksportuj rozmowę jako HTML",
    exportConversationMarkdown: "Eksportuj rozmowę jako Markdown",
    shareMessage: "Udostępnij wypowiedź",
    copyMessageMarkdown: "Kopiuj wypowiedź jako Markdown",
    exportMessageHtml: "Eksportuj wypowiedź jako HTML",
    exportMessageMarkdown: "Eksportuj wypowiedź jako Markdown",
    shareTitleConversation: "Udostępnij rozmowę",
    shareTitleMessage: "Udostępnij wypowiedź",
    shareDescriptionConversation: "Responsywna, statyczna kopia bieżącej rozmowy zostanie wysłana do ship.page.",
    shareDescriptionMessage: "Responsywna, statyczna kopia tej wypowiedzi zostanie wysłana do ship.page.",
    privacy: "Każda osoba posiadająca link będzie mogła odczytać treść. Bezpłatny link wygaśnie po 7 dniach. Nie publikuj danych wrażliwych.",
    cancel: "Anuluj",
    confirmShare: "Udostępnij",
    publishing: "Publikowanie…",
    success: "Link jest gotowy",
    copied: "Link został automatycznie skopiowany do schowka.",
    copyFailed: "Automatyczne kopiowanie nie powiodło się. Skopiuj link przyciskiem poniżej.",
    copyLink: "Kopiuj link",
    openLink: "Otwórz",
    close: "Zamknij",
    copiedToast: "Skopiowano link",
    markdownCopied: "Skopiowano Markdown do schowka",
    markdownCopyFailed: "Przeglądarka nie pozwoliła skopiować Markdown do schowka.",
    copyWorking: "Przygotowuję Markdown…",
    exportDone: "Zapisano plik",
    exportWorking: "Przygotowuję eksport…",
    errorTitle: "Nie udało się wykonać operacji",
    noConversation: "Na tej stronie nie wykryto jeszcze rozmowy.",
    menu: "Menu ShareGPT"
  } : {
    globalLabel: "Share or export conversation",
    globalShort: "Share / export",
    messageLabel: "Share or export this message",
    shareConversation: "Share conversation",
    copyConversationMarkdown: "Copy conversation as Markdown",
    exportConversationHtml: "Export conversation as HTML",
    exportConversationMarkdown: "Export conversation as Markdown",
    shareMessage: "Share message",
    copyMessageMarkdown: "Copy message as Markdown",
    exportMessageHtml: "Export message as HTML",
    exportMessageMarkdown: "Export message as Markdown",
    shareTitleConversation: "Share conversation",
    shareTitleMessage: "Share message",
    shareDescriptionConversation: "A responsive static copy of this conversation will be sent to ship.page.",
    shareDescriptionMessage: "A responsive static copy of this message will be sent to ship.page.",
    privacy: "Anyone with the link can read the content. The free link expires after 7 days. Do not publish sensitive data.",
    cancel: "Cancel",
    confirmShare: "Share",
    publishing: "Publishing…",
    success: "Your link is ready",
    copied: "The link was copied to the clipboard automatically.",
    copyFailed: "Automatic copying failed. Use the button below to copy the link.",
    copyLink: "Copy link",
    openLink: "Open",
    close: "Close",
    copiedToast: "Link copied",
    markdownCopied: "Markdown copied to clipboard",
    markdownCopyFailed: "The browser did not allow Markdown to be copied to the clipboard.",
    copyWorking: "Preparing Markdown…",
    exportDone: "File saved",
    exportWorking: "Preparing export…",
    errorTitle: "The operation failed",
    noConversation: "No conversation has been detected on this page yet.",
    menu: "ShareGPT menu"
  };

  let activeMenu = null;
  let activeDialog = null;
  let mutationTimer = 0;

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function sendMessage(message, timeoutMs = 50000) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Przekroczono czas oczekiwania na odpowiedź wtyczki.")), timeoutMs);
      chrome.runtime.sendMessage(message, (response) => {
        window.clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.ok) {
          reject(new Error(response && response.error ? response.error : "Nieznany błąd wtyczki."));
          return;
        }
        resolve(response.result);
      });
    });
  }

  async function inlineAsset(url) {
    if (String(url).startsWith("data:")) return url;
    if (String(url).startsWith("blob:")) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        if (blob.size > 8 * 1024 * 1024 || !blob.type.startsWith("image/")) return "";
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => resolve("");
          reader.readAsDataURL(blob);
        });
      } catch (_error) {
        return "";
      }
    }
    const result = await sendMessage({ type: "SHAREGPT_INLINE_ASSET", url }, 25000);
    return result && result.dataUrl ? result.dataUrl : "";
  }

  function getGlobalMount() {
    const nativeShareButton = document.querySelector("[data-testid='share-chat-button']");
    const actionCluster = document.querySelector("#conversation-header-actions, [data-testid='thread-header-right-actions']");
    if (actionCluster) {
      const optionsButton = actionCluster.querySelector("[data-testid='conversation-options-button']");
      let insertBefore = optionsButton;
      while (insertBefore && insertBefore.parentElement !== actionCluster) insertBefore = insertBefore.parentElement;
      return { mount: actionCluster, insertBefore, nativeActions: true };
    }
    if (nativeShareButton && nativeShareButton.parentElement) {
      return { mount: nativeShareButton.parentElement, insertBefore: nativeShareButton, nativeActions: true };
    }
    const headers = [...document.querySelectorAll("header")];
    const header = headers.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 200 && rect.height > 24 && rect.top < 160;
    }) || null;
    return { mount: header || document.body, insertBefore: null, nativeActions: false };
  }

  function ensureGlobalAction() {
    let root = document.querySelector("[data-sharegpt-global]");
    const { mount, insertBefore, nativeActions } = getGlobalMount();
    if (root && root.isConnected) {
      const button = root.querySelector("button");
      if (button) button.disabled = exporter.findTurns(document).length === 0;
      return;
    }

    root = createElement("div", "sgpt-global-action");
    root.setAttribute("data-sharegpt-global", "");
    root.setAttribute("data-sharegpt-ui", "");
    if (nativeActions) root.setAttribute("data-sharegpt-native-actions", "");
    const button = createElement("button", "sgpt-global-button");
    button.type = "button";
    button.setAttribute("aria-label", copy.globalLabel);
    button.setAttribute("aria-haspopup", "menu");
    button.disabled = exporter.findTurns(document).length === 0;
    button.append(
      createElement("span", "sgpt-global-label", copy.globalShort),
      createElement("span", "sgpt-global-label-mobile", isPolish ? "Eksport" : "Export")
    );
    button.addEventListener("click", () => openMenu(button, null));
    root.append(button);
    if (insertBefore) mount.insertBefore(root, insertBefore);
    else mount.append(root);
  }

  function nativeActionRow(turn) {
    const candidates = [...turn.querySelectorAll("button")].filter((button) => {
      if (button.closest("pre") || button.hasAttribute("data-sharegpt-ui")) return false;
      const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`.trim();
      return /^(copy|kopiuj|good response|bad response|read aloud|czytaj|edit|edytuj|regenerate)/i.test(label);
    });
    return candidates.length ? candidates[0].parentElement : null;
  }

  function decorateTurns() {
    for (const entry of exporter.findTurns(document)) {
      if (entry.turn.querySelector(":scope [data-sharegpt-turn-button]")) continue;

      const wrapper = createElement("span", "sgpt-turn-action");
      wrapper.setAttribute("data-sharegpt-ui", "");
      const button = createElement("button", "sgpt-turn-button", "•••");
      button.type = "button";
      button.setAttribute("data-sharegpt-turn-button", "");
      button.setAttribute("aria-label", copy.messageLabel);
      button.setAttribute("aria-haspopup", "menu");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openMenu(button, entry.turn);
      });
      wrapper.append(button);

      const row = nativeActionRow(entry.turn);
      if (row) row.append(wrapper);
      else entry.turn.append(wrapper);
    }
  }

  function closeMenu() {
    if (!activeMenu) return;
    activeMenu.remove();
    activeMenu = null;
  }

  function menuItem(label, action) {
    const item = createElement("button", "sgpt-menu-item", label);
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.addEventListener("click", () => {
      closeMenu();
      action();
    });
    return item;
  }

  function positionMenu(menu, anchor) {
    const rect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - menuRect.width - 8, rect.right - menuRect.width));
    const below = rect.bottom + 6;
    const top = below + menuRect.height <= window.innerHeight - 8
      ? below
      : Math.max(8, rect.top - menuRect.height - 6);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function openMenu(anchor, turn) {
    if (activeMenu) {
      closeMenu();
      return;
    }

    const menu = createElement("div", "sgpt-menu");
    menu.setAttribute("data-sharegpt-ui", "");
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", copy.menu);
    if (turn) {
      menu.append(
        menuItem(copy.shareMessage, () => openShareDialog(turn)),
        menuItem(copy.copyMessageMarkdown, () => copyMarkdownContent(turn)),
        menuItem(copy.exportMessageHtml, () => exportContent("html", turn)),
        menuItem(copy.exportMessageMarkdown, () => exportContent("markdown", turn))
      );
    } else {
      menu.append(
        menuItem(copy.shareConversation, () => openShareDialog(null)),
        menuItem(copy.copyConversationMarkdown, () => copyMarkdownContent(null)),
        menuItem(copy.exportConversationHtml, () => exportContent("html", null)),
        menuItem(copy.exportConversationMarkdown, () => exportContent("markdown", null))
      );
    }

    document.body.append(menu);
    activeMenu = menu;
    positionMenu(menu, anchor);
    menu.querySelector("button").focus({ preventScroll: true });
  }

  async function capture(turn, includeImages = true) {
    return exporter.capture(document, { turn, inlineAsset: includeImages ? inlineAsset : null });
  }

  function downloadText(content, filename, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function exportContent(format, turn) {
    showToast(copy.exportWorking, true);
    try {
      const snapshot = await capture(turn, format === "html");
      if (format === "html") {
        downloadText(exporter.buildHtml(snapshot), exporter.filename(snapshot, "html"), "text/html");
      } else {
        downloadText(exporter.buildMarkdown(snapshot), exporter.filename(snapshot, "md"), "text/markdown");
      }
      showToast(copy.exportDone);
    } catch (error) {
      showError(error);
    }
  }

  async function copyMarkdownContent(turn) {
    showToast(copy.copyWorking, true);
    try {
      const snapshot = await capture(turn, false);
      const markdown = exporter.buildMarkdown(snapshot);
      const copied = await copyToClipboard(markdown);
      if (!copied) throw new Error(copy.markdownCopyFailed);
      showToast(copy.markdownCopied);
    } catch (error) {
      showError(error);
    }
  }

  async function copyToClipboard(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_error) {
      const textarea = createElement("textarea", "sgpt-copy-fallback");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    }
  }

  function closeDialog() {
    if (!activeDialog) return;
    const restoreFocus = activeDialog.restoreFocus;
    activeDialog.root.remove();
    document.removeEventListener("keydown", activeDialog.keyHandler, true);
    activeDialog = null;
    if (restoreFocus && restoreFocus.isConnected) restoreFocus.focus({ preventScroll: true });
  }

  function openDialog(title) {
    closeDialog();
    const restoreFocus = document.activeElement;
    const root = createElement("div", "sgpt-dialog-backdrop");
    root.setAttribute("data-sharegpt-ui", "");
    const panel = createElement("div", "sgpt-dialog");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    const heading = createElement("h2", "sgpt-dialog-title", title);
    const body = createElement("div", "sgpt-dialog-body");
    panel.append(heading, body);
    root.append(panel);
    root.addEventListener("mousedown", (event) => {
      if (event.target === root) closeDialog();
    });

    const keyHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab" || !activeDialog) return;
      const focusable = [...panel.querySelectorAll("button:not(:disabled), a[href], input:not(:disabled)")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keyHandler, true);
    document.body.append(root);
    activeDialog = { root, panel, body, restoreFocus, keyHandler };
    return activeDialog;
  }

  function dialogActions(...buttons) {
    const actions = createElement("div", "sgpt-dialog-actions");
    actions.append(...buttons);
    return actions;
  }

  function dialogButton(label, primary, handler) {
    const button = createElement("button", primary ? "sgpt-dialog-button sgpt-dialog-button-primary" : "sgpt-dialog-button", label);
    button.type = "button";
    button.addEventListener("click", handler);
    return button;
  }

  function showError(error) {
    for (const existing of document.querySelectorAll(".sgpt-toast")) existing.remove();
    const dialog = openDialog(copy.errorTitle);
    const message = createElement("p", "sgpt-dialog-copy", error instanceof Error ? error.message : String(error));
    const closeButton = dialogButton(copy.close, true, closeDialog);
    dialog.body.append(message, dialogActions(closeButton));
    closeButton.focus();
  }

  function renderShareSuccess(dialog, result, copiedAutomatically) {
    dialog.panel.querySelector(".sgpt-dialog-title").textContent = copy.success;
    dialog.body.replaceChildren();
    const message = createElement("p", "sgpt-dialog-copy", copiedAutomatically ? copy.copied : copy.copyFailed);
    const linkBox = createElement("div", "sgpt-link-box");
    const input = createElement("input", "sgpt-link-input");
    input.type = "url";
    input.readOnly = true;
    input.value = result.url;
    input.setAttribute("aria-label", copy.success);
    const copyButton = dialogButton(copy.copyLink, false, async () => {
      await copyToClipboard(result.url);
      showToast(copy.copiedToast);
      input.select();
    });
    linkBox.append(input, copyButton);
    const open = createElement("a", "sgpt-dialog-button sgpt-dialog-button-primary", copy.openLink);
    open.href = result.url;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    const close = dialogButton(copy.close, false, closeDialog);
    dialog.body.append(message, linkBox, dialogActions(close, open));
    input.focus();
    input.select();
  }

  function openShareDialog(turn) {
    const isMessage = Boolean(turn);
    const dialog = openDialog(isMessage ? copy.shareTitleMessage : copy.shareTitleConversation);
    const description = createElement("p", "sgpt-dialog-copy", isMessage ? copy.shareDescriptionMessage : copy.shareDescriptionConversation);
    const warning = createElement("p", "sgpt-privacy-note", copy.privacy);
    const cancel = dialogButton(copy.cancel, false, closeDialog);
    const confirm = dialogButton(copy.confirmShare, true, async () => {
      cancel.disabled = true;
      confirm.disabled = true;
      confirm.textContent = copy.publishing;
      try {
        const snapshot = await capture(turn);
        const html = exporter.buildHtml(snapshot);
        const result = await sendMessage({ type: "SHAREGPT_DEPLOY", html });
        const copiedAutomatically = await copyToClipboard(result.url);
        if (activeDialog === dialog) renderShareSuccess(dialog, result, copiedAutomatically);
      } catch (error) {
        if (activeDialog === dialog) {
          closeDialog();
          showError(error);
        }
      }
    });
    dialog.body.append(description, warning, dialogActions(cancel, confirm));
    confirm.focus();
  }

  function showToast(message, persistent) {
    for (const existing of document.querySelectorAll(".sgpt-toast")) existing.remove();
    const toast = createElement("div", "sgpt-toast", message);
    toast.setAttribute("data-sharegpt-ui", "");
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.append(toast);
    if (!persistent) window.setTimeout(() => toast.remove(), 2600);
    return toast;
  }

  function closeOnOutsideClick(event) {
    if (activeMenu && !activeMenu.contains(event.target) && !event.target.closest("[aria-haspopup='menu']")) closeMenu();
  }

  function scan() {
    ensureGlobalAction();
    decorateTurns();
  }

  const observer = new MutationObserver(() => {
    window.clearTimeout(mutationTimer);
    mutationTimer = window.setTimeout(scan, 120);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("pointerdown", closeOnOutsideClick, true);
  window.addEventListener("resize", closeMenu, { passive: true });
  window.addEventListener("popstate", () => window.setTimeout(scan, 50));
  scan();
})();
