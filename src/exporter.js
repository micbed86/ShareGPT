(function shareGptExporterModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ShareGPTExporter = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function createShareGptExporter() {
  "use strict";

  const ROLE_SELECTOR = "[data-message-author-role='user'], [data-message-author-role='assistant']";
  const BLOCKED_SELECTOR = [
    "script",
    "style",
    "link",
    "meta",
    "iframe",
    "frame",
    "object",
    "embed",
    "form",
    "input",
    "textarea",
    "select",
    "option",
    "button",
    "template",
    "svg",
    "canvas",
    "video",
    "audio",
    ".cga-sent-receipt",
    "[data-sharegpt-ui]"
  ].join(",");

  const translations = {
    pl: {
      assistant: "Asystent",
      user: "Użytkownik",
      shared: "Statyczny eksport rozmowy z ChatGPT",
      oneMessage: "Wybrana wypowiedź",
      conversation: "Rozmowa"
    },
    en: {
      assistant: "Assistant",
      user: "User",
      shared: "Static ChatGPT conversation export",
      oneMessage: "Selected message",
      conversation: "Conversation"
    }
  };

  function localeFor(language) {
    return String(language || "").toLowerCase().startsWith("pl") ? "pl" : "en";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function slugify(value) {
    const slug = String(value || "chatgpt")
      .replace(/ł/g, "l")
      .replace(/Ł/g, "L")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
    return slug || "chatgpt";
  }

  function isSafeUrl(value, kind) {
    const raw = String(value || "").trim();
    if (!raw) return false;
    if (kind === "image" && /^data:image\/(?:png|jpeg|jpg|gif|webp|avif);base64,/i.test(raw)) return true;
    if (kind === "image" && raw.startsWith("blob:")) return true;
    try {
      const url = new URL(raw, "https://chatgpt.com/");
      if (kind === "link" && (url.protocol === "mailto:" || url.protocol === "tel:")) return true;
      return url.protocol === "https:" || url.protocol === "http:";
    } catch (_error) {
      return raw.startsWith("#");
    }
  }

  function normalizeTitle(value) {
    const title = String(value || "")
      .replace(/\s*[|·-]\s*ChatGPT\s*$/i, "")
      .replace(/^ChatGPT\s*[|·-]\s*/i, "")
      .trim();
    return title && title.toLowerCase() !== "chatgpt" ? title : "ChatGPT";
  }

  function turnForRole(roleNode) {
    return roleNode.closest("article[data-testid^='conversation-turn-']")
      || roleNode.closest("[data-testid^='conversation-turn-']")
      || roleNode.closest("article")
      || roleNode;
  }

  function findTurns(doc) {
    const seen = new Set();
    const turns = [];
    for (const roleNode of doc.querySelectorAll(ROLE_SELECTOR)) {
      const nestedRole = roleNode.parentElement && roleNode.parentElement.closest(ROLE_SELECTOR);
      if (nestedRole) continue;
      const turn = turnForRole(roleNode);
      if (seen.has(turn)) continue;
      seen.add(turn);
      turns.push({ turn, roleNode });
    }
    return turns;
  }

  function contentForRole(roleNode) {
    const role = roleNode.getAttribute("data-message-author-role");
    if (role === "assistant") {
      const markdown = roleNode.querySelector(".markdown, [class*='markdown']");
      const extraMedia = roleNode.querySelector("img, [data-testid*='file'], [data-testid*='attachment']");
      return markdown && extraMedia && !markdown.contains(extraMedia) ? roleNode : (markdown || roleNode);
    }
    const text = roleNode.querySelector("[class*='whitespace-pre-wrap'], .markdown, [class*='markdown']");
    const extraMedia = roleNode.querySelector("img, [data-testid*='file'], [data-testid*='attachment']");
    return text && extraMedia && !text.contains(extraMedia) ? roleNode : (text || roleNode);
  }

  function safeClassNames(element) {
    const tokens = String(element.getAttribute("class") || "").split(/\s+/);
    return tokens.filter((token) => /^(?:katex(?:-[a-z]+)?|hljs|language-[a-z0-9_-]+)$/i.test(token)).join(" ");
  }

  function sanitizeClone(source) {
    const clone = source.cloneNode(true);

    const preformattedBlocks = clone.tagName === "PRE" ? [clone] : [...clone.querySelectorAll("pre")];
    for (const pre of preformattedBlocks) {
      const existingCode = pre.querySelector("code");
      if (existingCode) {
        pre.replaceChildren(existingCode.cloneNode(true));
        continue;
      }

      const visualLines = [...pre.querySelectorAll(".cm-line")];
      if (visualLines.length) {
        const code = pre.ownerDocument.createElement("code");
        code.textContent = visualLines.map((line) => line.textContent).join("\n");
        pre.replaceChildren(code);
      }
    }

    for (const button of clone.querySelectorAll("button")) {
      const meaningfulImages = [...button.querySelectorAll("img")].map((image) => image.cloneNode(true));
      if (meaningfulImages.length) button.replaceWith(...meaningfulImages);
    }

    for (const blocked of clone.querySelectorAll(BLOCKED_SELECTOR)) {
      blocked.remove();
    }

    const elements = [clone, ...clone.querySelectorAll("*")];
    for (const element of elements) {
      const safeClasses = safeClassNames(element);
      for (const attribute of [...element.attributes]) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on")
          || name === "style"
          || name === "srcdoc"
          || name === "id"
          || name === "contenteditable"
          || name === "tabindex"
          || name.startsWith("data-")) {
          element.removeAttribute(attribute.name);
        }
      }

      if (safeClasses) element.setAttribute("class", safeClasses);
      else element.removeAttribute("class");

      if (element.tagName === "A") {
        const href = element.href || element.getAttribute("href");
        if (!isSafeUrl(href, "link")) element.removeAttribute("href");
        else {
          element.setAttribute("href", href);
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer nofollow");
        }
      }

      if (element.tagName === "IMG") {
        const src = element.src || element.getAttribute("src");
        if (!isSafeUrl(src, "image")) element.removeAttribute("src");
        else element.setAttribute("src", src);
        element.removeAttribute("srcset");
        element.removeAttribute("sizes");
        element.setAttribute("loading", "lazy");
        element.setAttribute("decoding", "async");
        element.setAttribute("referrerpolicy", "no-referrer");
        if (!element.hasAttribute("alt")) element.setAttribute("alt", "");
      }
    }
    return clone;
  }

  function sanitizeSerializedFragment(html) {
    return String(html || "")
      .replace(/<(script|style|iframe|frame|object|embed|form|button|template|svg|canvas|video|audio)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<(script|style|iframe|frame|object|embed|form|input|textarea|select|button|template|svg|canvas|video|audio)\b[^>]*\/?\s*>/gi, "")
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  }

  function normalizeMarkdown(value) {
    return String(value || "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function textChildren(element, context) {
    return [...element.childNodes].map((child) => nodeToMarkdown(child, context)).join("");
  }

  function listToMarkdown(element, ordered, context) {
    const items = [...element.children].filter((child) => child.tagName === "LI");
    return items.map((item, index) => {
      const marker = ordered ? `${index + 1}. ` : "- ";
      const content = normalizeMarkdown(textChildren(item, { ...context, listDepth: (context.listDepth || 0) + 1 }));
      const indented = content.replace(/\n/g, `\n${"  ".repeat((context.listDepth || 0) + 1)}`);
      return `${"  ".repeat(context.listDepth || 0)}${marker}${indented}`;
    }).join("\n") + "\n\n";
  }

  function tableToMarkdown(table) {
    const rows = [...table.querySelectorAll("tr")].map((row) => [...row.querySelectorAll(":scope > th, :scope > td")]
      .map((cell) => normalizeMarkdown(textChildren(cell, {})).replace(/\|/g, "\\|").replace(/\n/g, " ")));
    if (!rows.length || !rows[0].length) return "";
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
    const header = normalized[0];
    const divider = Array(width).fill("---");
    return [header, divider, ...normalized.slice(1)].map((row) => `| ${row.join(" | ")} |`).join("\n") + "\n\n";
  }

  function nodeToMarkdown(node, context = {}) {
    if (!node) return "";
    if (node.nodeType === 3) return String(node.nodeValue || "").replace(/\u00a0/g, " ");
    if (node.nodeType !== 1) return "";

    const element = node;
    const tag = element.tagName.toUpperCase();
    if (element.hasAttribute && element.hasAttribute("data-sharegpt-ui")) return "";
    if (element.classList && element.classList.contains("cga-sent-receipt")) return "";
    if (["SCRIPT", "STYLE", "BUTTON", "SVG", "CANVAS", "VIDEO", "AUDIO"].includes(tag)) return "";

    if (element.classList && element.classList.contains("katex")) {
      const annotation = element.querySelector("annotation[encoding='application/x-tex']");
      if (annotation) {
        const tex = annotation.textContent.trim();
        return element.closest(".katex-display") ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`;
      }
    }

    if (tag === "PRE") {
      const code = element.querySelector("code");
      const raw = (code || element).textContent.replace(/\n$/, "");
      const languageClass = code && [...code.classList].find((name) => name.startsWith("language-"));
      const language = languageClass ? languageClass.slice(9) : "";
      const longestFence = Math.max(3, ...[...raw.matchAll(/`+/g)].map((match) => match[0].length + 1));
      const fence = "`".repeat(longestFence);
      return `\n\n${fence}${language}\n${raw}\n${fence}\n\n`;
    }

    const inner = () => textChildren(element, context);
    switch (tag) {
      case "H1": return `\n\n# ${normalizeMarkdown(inner())}\n\n`;
      case "H2": return `\n\n## ${normalizeMarkdown(inner())}\n\n`;
      case "H3": return `\n\n### ${normalizeMarkdown(inner())}\n\n`;
      case "H4": return `\n\n#### ${normalizeMarkdown(inner())}\n\n`;
      case "H5": return `\n\n##### ${normalizeMarkdown(inner())}\n\n`;
      case "H6": return `\n\n###### ${normalizeMarkdown(inner())}\n\n`;
      case "P": return `${inner()}\n\n`;
      case "BR": return "  \n";
      case "STRONG":
      case "B": return `**${inner()}**`;
      case "EM":
      case "I": return `_${inner()}_`;
      case "DEL":
      case "S": return `~~${inner()}~~`;
      case "CODE": return `\`${String(element.textContent || "").replace(/`/g, "\\`")}\``;
      case "BLOCKQUOTE": return `${normalizeMarkdown(inner()).split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
      case "UL": return listToMarkdown(element, false, context);
      case "OL": return listToMarkdown(element, true, context);
      case "TABLE": return tableToMarkdown(element);
      case "A": {
        const label = normalizeMarkdown(inner()) || String(element.getAttribute("href") || "");
        const href = element.getAttribute("href");
        return isSafeUrl(href, "link") ? `[${label}](${href})` : label;
      }
      case "IMG": {
        const src = element.getAttribute("src");
        const alt = String(element.getAttribute("alt") || "obraz").replace(/]/g, "\\]");
        return isSafeUrl(src, "image") ? `![${alt}](${src})` : alt;
      }
      case "HR": return "\n\n---\n\n";
      case "SUMMARY": return `**${normalizeMarkdown(inner())}**\n\n`;
      case "DIV":
      case "SECTION":
      case "ARTICLE":
      case "DETAILS": return `${inner()}\n`;
      default: return inner();
    }
  }

  function cssColor(value, fallback) {
    const color = String(value || "").trim();
    return /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,/%-]+\)|hsla?\([\d\s.,/%-]+\)|transparent)$/i.test(color) ? color : fallback;
  }

  function parsedRgb(value) {
    const match = String(value || "").match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    return match ? match.slice(1, 4).map(Number) : null;
  }

  function isDarkColor(value) {
    const rgb = parsedRgb(value);
    if (!rgb) return false;
    const [r, g, b] = rgb.map((component) => component / 255);
    const linear = [r, g, b].map((component) => component <= 0.03928 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4);
    return (0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]) < 0.35;
  }

  function visibleBackground(element, stopAt) {
    let current = element;
    while (current && current !== stopAt.parentElement) {
      const value = current.ownerDocument.defaultView.getComputedStyle(current).backgroundColor;
      if (value && value !== "transparent" && !/rgba\([^)]*,\s*0\s*\)/.test(value)) return value;
      if (current === stopAt) break;
      current = current.parentElement;
    }
    return "";
  }

  async function inlineImages(clone, inlineAsset) {
    if (typeof inlineAsset !== "function") return;
    const images = [...clone.querySelectorAll("img")];
    for (const image of images) {
      const src = image.getAttribute("src");
      if (!src || src.startsWith("data:")) continue;
      try {
        const inlined = await inlineAsset(src);
        if (/^data:image\//i.test(inlined || "")) image.setAttribute("src", inlined);
        else if (src.startsWith("blob:")) image.removeAttribute("src");
      } catch (_error) {
        if (src.startsWith("blob:")) image.removeAttribute("src");
      }
    }
  }

  async function captureMessage(roleNode, turn, options) {
    const role = roleNode.getAttribute("data-message-author-role") === "user" ? "user" : "assistant";
    const content = contentForRole(roleNode);
    const clone = sanitizeClone(content);
    await inlineImages(clone, options.inlineAsset);
    const html = sanitizeSerializedFragment(clone.innerHTML || clone.outerHTML || "");
    const markdown = normalizeMarkdown(nodeToMarkdown(clone));

    return {
      id: roleNode.getAttribute("data-message-id") || turn.getAttribute("data-testid") || "",
      role,
      html,
      markdown: markdown || String(content.innerText || content.textContent || "").trim()
    };
  }

  async function capture(doc, options = {}) {
    const entries = findTurns(doc);
    const selected = options.turn
      ? entries.filter((entry) => entry.turn === options.turn || options.turn.contains(entry.roleNode))
      : entries;
    if (!selected.length) throw new Error("Nie znaleziono wypowiedzi w bieżącej rozmowie.");

    const messages = [];
    for (const entry of selected) {
      messages.push(await captureMessage(entry.roleNode, entry.turn, options));
    }

    const view = doc.defaultView;
    const bodyStyle = view.getComputedStyle(doc.body);
    const pageBackground = visibleBackground(doc.body, doc.documentElement) || bodyStyle.backgroundColor;
    const firstRole = selected[0].roleNode;
    const textColor = view.getComputedStyle(contentForRole(firstRole)).color;
    const userEntry = selected.find((entry) => entry.roleNode.getAttribute("data-message-author-role") === "user");
    const userVisualContent = userEntry
      ? (userEntry.roleNode.querySelector("[class*='whitespace-pre-wrap']") || contentForRole(userEntry.roleNode))
      : null;
    const userBackground = userEntry ? visibleBackground(userVisualContent, userEntry.turn) : "";
    const dark = doc.documentElement.classList.contains("dark")
      || String(bodyStyle.colorScheme).includes("dark")
      || isDarkColor(pageBackground);

    return {
      title: normalizeTitle(doc.title),
      language: localeFor(doc.documentElement.lang || view.navigator.language),
      generatedAt: new Date().toISOString(),
      scope: options.turn ? "message" : "conversation",
      theme: {
        mode: dark ? "dark" : "light",
        background: cssColor(pageBackground, dark ? "#212121" : "#ffffff"),
        text: cssColor(textColor, dark ? "#ececec" : "#0d0d0d"),
        userBackground: cssColor(userBackground, dark ? "#303030" : "#f4f4f4")
      },
      messages
    };
  }

  function messageHtml(message, labels) {
    const isUser = message.role === "user";
    const roleLabel = isUser ? labels.user : labels.assistant;
    return `<article class="message message-${message.role}" aria-label="${escapeHtml(roleLabel)}">
      <div class="message-column">
        <div class="message-role">${escapeHtml(roleLabel)}</div>
        <div class="message-content">${sanitizeSerializedFragment(message.html)}</div>
      </div>
    </article>`;
  }

  function buildHtml(snapshot) {
    const language = localeFor(snapshot.language);
    const labels = translations[language];
    const theme = snapshot.theme || {};
    const background = cssColor(theme.background, theme.mode === "dark" ? "#212121" : "#ffffff");
    const text = cssColor(theme.text, theme.mode === "dark" ? "#ececec" : "#0d0d0d");
    const userBackground = cssColor(theme.userBackground, theme.mode === "dark" ? "#303030" : "#f4f4f4");
    const isMessage = snapshot.scope === "message";
    const eyebrow = isMessage ? labels.oneMessage : labels.conversation;
    const messages = snapshot.messages.map((message) => messageHtml(message, labels)).join("\n");
    const title = normalizeTitle(snapshot.title);

    return `<!doctype html>
<html lang="${language}" data-theme="${theme.mode === "dark" ? "dark" : "light"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="${theme.mode === "dark" ? "dark" : "light"}">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: ${theme.mode === "dark" ? "dark" : "light"};
      --page: ${background};
      --text: ${text};
      --user: ${userBackground};
      --muted: ${theme.mode === "dark" ? "#a6a6a6" : "#676767"};
      --border: ${theme.mode === "dark" ? "#444444" : "#dedede"};
      --code: ${theme.mode === "dark" ? "#171717" : "#f7f7f8"};
      --link: ${theme.mode === "dark" ? "#7ab7ff" : "#005bd1"};
    }
    * { box-sizing: border-box; }
    html { background: var(--page); color: var(--text); font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100dvh; background: var(--page); color: var(--text); }
    .page-header { position: sticky; top: 0; z-index: 2; border-bottom: 1px solid var(--border); background: var(--page); }
    .header-inner { width: min(100% - 40px, 860px); margin: 0 auto; padding: 18px 0 16px; }
    .eyebrow { margin: 0 0 6px; color: var(--muted); font-size: 12px; font-weight: 600; letter-spacing: .02em; }
    h1 { margin: 0; font-size: clamp(18px, 3vw, 24px); font-weight: 650; line-height: 1.25; letter-spacing: -.02em; }
    main { width: min(100% - 40px, 820px); margin: 0 auto; padding: 38px 0 64px; }
    .conversation { display: grid; gap: 34px; }
    .message { display: block; }
    .message-user { display: flex; justify-content: flex-end; }
    .message-column { min-width: 0; width: 100%; }
    .message-user .message-column { width: fit-content; max-width: min(70%, 620px); padding: 10px 16px; border-radius: 22px; background: var(--user); }
    .message-role { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
    .message-content { overflow-wrap: anywhere; font-size: 16px; line-height: 1.72; }
    .message-content > :first-child { margin-top: 0; }
    .message-content > :last-child { margin-bottom: 0; }
    .message-content p { margin: 0 0 1em; }
    .message-content h1, .message-content h2, .message-content h3, .message-content h4 { margin: 1.45em 0 .55em; line-height: 1.25; letter-spacing: -.015em; }
    .message-content h1 { font-size: 1.5em; }
    .message-content h2 { font-size: 1.32em; }
    .message-content h3 { font-size: 1.16em; }
    .message-content ul, .message-content ol { margin: .8em 0 1em; padding-left: 1.5em; }
    .message-content li { margin: .32em 0; }
    .message-content blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid var(--border); color: var(--muted); }
    .message-content a { color: var(--link); text-decoration: underline; text-underline-offset: 2px; }
    .message-content code { border-radius: 5px; background: var(--code); padding: .14em .34em; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .9em; }
    .message-content pre { max-width: 100%; margin: 1em 0; overflow: auto; border: 1px solid var(--border); border-radius: 10px; background: var(--code); padding: 16px; line-height: 1.55; }
    .message-content pre code { display: block; min-width: max-content; padding: 0; background: transparent; white-space: pre; }
    .message-content table { display: block; width: max-content; max-width: 100%; margin: 1em 0; overflow-x: auto; border-collapse: collapse; }
    .message-content th, .message-content td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; vertical-align: top; }
    .message-content th { background: var(--code); font-weight: 650; }
    .message-content img { display: block; max-width: 100%; height: auto; margin: 1em 0; border-radius: 12px; }
    .message-content details { margin: 1em 0; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
    .message-content summary { cursor: pointer; font-weight: 650; }
    .message-content .katex-display { max-width: 100%; overflow-x: auto; overflow-y: hidden; }
    footer { width: min(100% - 40px, 820px); margin: 0 auto; padding: 0 0 32px; color: var(--muted); font-size: 12px; }
    @media (max-width: 640px) {
      .header-inner, main, footer { width: min(100% - 28px, 820px); }
      .header-inner { padding: 14px 0 12px; }
      main { padding-top: 26px; }
      .conversation { gap: 28px; }
      .message-user .message-column { max-width: 88%; padding: 9px 14px; border-radius: 18px; }
      .message-content { font-size: 15px; line-height: 1.65; }
      .message-content pre { margin-inline: -2px; padding: 13px; border-radius: 9px; }
    }
    @media print {
      .page-header { position: static; }
      main { width: 100%; }
      .message-content pre, .message-content table { break-inside: avoid; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; }
    }
  </style>
</head>
<body>
  <header class="page-header">
    <div class="header-inner">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(title)}</h1>
    </div>
  </header>
  <main>
    <div class="conversation">${messages}</div>
  </main>
  <footer>${escapeHtml(labels.shared)}</footer>
</body>
</html>`;
  }

  function buildMarkdown(snapshot) {
    const language = localeFor(snapshot.language);
    const labels = translations[language];
    const title = normalizeTitle(snapshot.title);
    const sections = snapshot.messages.map((message) => {
      const label = message.role === "user" ? labels.user : labels.assistant;
      return `## ${label}\n\n${normalizeMarkdown(message.markdown)}`;
    });
    return `# ${title}\n\n${sections.join("\n\n")}\n`;
  }

  function filename(snapshot, extension) {
    const suffix = snapshot.scope === "message" ? "wypowiedz" : "rozmowa";
    return `${slugify(snapshot.title)}-${suffix}.${extension}`;
  }

  return {
    ROLE_SELECTOR,
    buildHtml,
    buildMarkdown,
    capture,
    escapeHtml,
    filename,
    findTurns,
    isSafeUrl,
    nodeToMarkdown,
    normalizeMarkdown,
    normalizeTitle,
    sanitizeSerializedFragment,
    slugify,
    turnForRole
  };
});
