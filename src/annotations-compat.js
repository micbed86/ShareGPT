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
    return String(value || "").replace(/\u200b/g, "").trim();
  }

  function readItems(receipt) {
    if (!receipt) return [];
    return [...receipt.querySelectorAll(ITEM_SELECTOR)].map((item, index) => ({
      index: index + 1,
      selectedText: cleanText(item.querySelector(QUOTE_SELECTOR)?.textContent),
      annotation: cleanText(item.querySelector(COMMENT_SELECTOR)?.textContent)
    })).filter((item) => item.selectedText || item.annotation);
  }

  function collectAnnotations(turn) {
    let receipt = turn?.querySelector?.(RECEIPT_SELECTOR);
    if (!receipt) return [];

    const initiallyExpanded = Boolean(receipt.querySelector(PANEL_SELECTOR));
    let openedForRead = false;

    if (!initiallyExpanded) {
      const toggle = receipt.querySelector(TOGGLE_SELECTOR);
      if (toggle) {
        toggle.click();
        openedForRead = true;
        receipt = turn.querySelector(RECEIPT_SELECTOR) || receipt;
      }
    }

    const items = readItems(receipt);

    if (openedForRead) {
      const currentReceipt = turn.querySelector(RECEIPT_SELECTOR);
      const toggle = currentReceipt?.querySelector(TOGGLE_SELECTOR);
      if (currentReceipt?.querySelector(PANEL_SELECTOR) && toggle) toggle.click();
    }

    return items;
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
      if (item.annotation) lines.push(`   **${annotationLabel}:** ${item.annotation}`);
      return lines.join("\n");
    });
    return `### ${heading}\n\n${blocks.join("\n\n")}`;
  }

  const baseCapture = exporter.capture.bind(exporter);
  exporter.capture = async function captureWithAnnotations(doc, options = {}) {
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
  };

  exporter.__annotationsCompatibility = {
    collectAnnotations,
    annotationHtml,
    annotationMarkdown
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
