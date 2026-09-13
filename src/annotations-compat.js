(function initializeAnnotationsCompatibility(root) {
  "use strict";

  const exporter = root.ShareGPTExporter;
  if (!exporter || exporter.__annotationsCompatibility) return;

  const RECEIPT_SELECTOR = ".cga-sent-receipt";
  const TOGGLE_SELECTOR = ".cga-sent-receipt__toggle";
  const PANEL_SELECTOR = ".cga-sent-receipt__panel";
  const ITEM_SELECTOR = ".cga-sent-receipt__item";
  const QUOTE_SELECTOR = ".cga-sent-receipt__quote";
  const COMMENT_SELECTOR = ".cga-sent-receipt__comment";

  function cleanText(value) {
    return String(value || "").replace(/\u200b/g, "").replace(/\r\n?/g, "\n").trim();
  }

  function readItems(receipt) {
    if (!receipt) return [];
    return [...receipt.querySelectorAll(ITEM_SELECTOR)].map((item, index) => ({
      index: index + 1,
      selectedText: cleanText(item.querySelector(QUOTE_SELECTOR)?.textContent),
      annotation: cleanText(item.querySelector(COMMENT_SELECTOR)?.textContent)
    })).filter((item) => item.selectedText || item.annotation);
  }

  function receiptsIn(doc) {
    return doc?.querySelectorAll ? [...doc.querySelectorAll(RECEIPT_SELECTOR)] : [];
  }

  function receiptLocator(receipt, doc) {
    const message = receipt?.closest?.("[data-message-id]");
    const turn = receipt?.closest?.("[data-testid^='conversation-turn-']");
    return {
      messageId: message?.getAttribute("data-message-id") || "",
      turnId: turn?.getAttribute("data-testid") || "",
      index: receiptsIn(doc).indexOf(receipt),
      receipt
    };
  }

  function findOpenReceipt(doc) {
    return receiptsIn(doc).find((receipt) => receipt.querySelector(PANEL_SELECTOR)) || null;
  }

  function saveReceiptState(doc) {
    const openReceipt = findOpenReceipt(doc);
    return openReceipt ? receiptLocator(openReceipt, doc) : null;
  }

  function findReceipt(doc, locator) {
    if (!locator) return null;
    const receipts = receiptsIn(doc);
    const byMessage = locator.messageId
      ? receipts.find((receipt) => receipt.closest?.("[data-message-id]")?.getAttribute("data-message-id") === locator.messageId)
      : null;
    if (byMessage) return byMessage;

    const byTurn = locator.turnId
      ? receipts.find((receipt) => receipt.closest?.("[data-testid^='conversation-turn-']")?.getAttribute("data-testid") === locator.turnId)
      : null;
    if (byTurn) return byTurn;

    if (locator.receipt && (locator.receipt.isConnected === true || doc?.contains?.(locator.receipt))) return locator.receipt;
    return locator.index >= 0 ? receipts[locator.index] || null : null;
  }

  function toggleReceipt(receipt) {
    const toggle = receipt?.querySelector?.(TOGGLE_SELECTOR);
    if (toggle) toggle.click();
  }

  function restoreReceiptState(doc, originalOpen) {
    const currentOpen = findOpenReceipt(doc);
    if (!originalOpen) {
      if (currentOpen) toggleReceipt(currentOpen);
      return;
    }

    const target = findReceipt(doc, originalOpen);
    if (!target || target.querySelector(PANEL_SELECTOR)) return;
    toggleReceipt(target);
  }

  function collectAnnotations(turn) {
    let receipt = turn?.querySelector?.(RECEIPT_SELECTOR);
    if (!receipt) return [];

    if (!receipt.querySelector(PANEL_SELECTOR)) {
      const toggle = receipt.querySelector(TOGGLE_SELECTOR);
      if (toggle) {
        const locator = receiptLocator(receipt, turn.ownerDocument);
        toggle.click();
        receipt = findReceipt(turn.ownerDocument, locator) || turn.querySelector(RECEIPT_SELECTOR) || receipt;
      }
    }

    return readItems(receipt);
  }

  function annotationHtml(items, language) {
    if (!items.length) return "";
    const polish = String(language || "").toLowerCase().startsWith("pl");
    const heading = polish ? "Adnotacje" : "Annotations";
    const selectedLabel = polish ? "Zaznaczony tekst" : "Selected text";
    const annotationLabel = polish ? "Adnotacja" : "Annotation";

    const rows = items.map((item) => {
      const comment = item.annotation
        ? `<div style="margin-top:8px"><div style="margin-bottom:2px;font-size:11px;font-weight:650;opacity:.62">${exporter.escapeHtml(annotationLabel)}</div><div style="white-space:pre-wrap;overflow-wrap:anywhere">${exporter.escapeHtml(item.annotation)}</div></div>`
        : "";
      return `<div style="display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;padding:10px 2px;border-top:1px solid var(--border)"><div style="padding-top:1px;text-align:right;font-size:11px;opacity:.55">${item.index}.</div><div style="min-width:0"><div style="margin-bottom:2px;font-size:11px;font-weight:650;opacity:.62">${exporter.escapeHtml(selectedLabel)}</div><div style="white-space:pre-wrap;overflow-wrap:anywhere">${exporter.escapeHtml(item.selectedText)}</div>${comment}</div></div>`;
    }).join("");

    return `<aside aria-label="${exporter.escapeHtml(heading)}" style="margin-top:12px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--code);font-size:13px;line-height:1.45"><div style="padding:0 2px 7px;font-size:12px;font-weight:700;opacity:.78">${exporter.escapeHtml(heading)}</div>${rows}</aside>`;
  }

  function annotationMarkdown(items, language) {
    if (!items.length) return "";
    const polish = String(language || "").toLowerCase().startsWith("pl");
    const heading = polish ? "Adnotacje" : "Annotations";
    const selectedLabel = polish ? "Zaznaczony tekst" : "Selected text";
    const annotationLabel = polish ? "Adnotacja" : "Annotation";
    const blocks = items.map((item) => {
      const lines = [`${item.index}. **${selectedLabel}:**`, `   > ${item.selectedText.replace(/\n/g, "\n   > ")}`];
      if (item.annotation) {
        const comment = item.annotation.replace(/\n/g, "\n   ");
        lines.push(`   **${annotationLabel}:** ${comment}`);
      }
      return lines.join("\n");
    });
    return `### ${heading}\n\n${blocks.join("\n\n")}`;
  }

  const baseCapture = exporter.capture.bind(exporter);
  exporter.capture = async function captureWithAnnotations(doc, options = {}) {
    const originalOpen = saveReceiptState(doc);
    try {
      const entries = exporter.findTurns(doc);
      const selected = options.turn
        ? entries.filter((entry) => entry.turn === options.turn || options.turn.contains(entry.roleNode))
        : entries;
      const annotationsByIndex = selected.map((entry) => collectAnnotations(entry.turn));
      const snapshot = await baseCapture(doc, options);

      snapshot.messages = snapshot.messages.map((message, index) => {
        const annotations = annotationsByIndex[index] || [];
        if (!annotations.length) return message;
        return {
          ...message,
          annotations,
          html: `${message.html}${annotationHtml(annotations, snapshot.language)}`,
          markdown: `${message.markdown}\n\n${annotationMarkdown(annotations, snapshot.language)}`
        };
      });
      return snapshot;
    } finally {
      restoreReceiptState(doc, originalOpen);
    }
  };

  exporter.__annotationsCompatibility = {
    collectAnnotations,
    annotationHtml,
    annotationMarkdown
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
