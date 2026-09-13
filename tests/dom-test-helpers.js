const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"
]);

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, "\u00a0")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function splitSelectorGroups(selector) {
  const groups = [];
  let start = 0;
  let quote = "";
  let brackets = 0;
  let parentheses = 0;

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (quote) {
      if (character === quote && selector[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "[") brackets += 1;
    else if (character === "]") brackets -= 1;
    else if (character === "(") parentheses += 1;
    else if (character === ")") parentheses -= 1;
    else if (character === "," && brackets === 0 && parentheses === 0) {
      groups.push(selector.slice(start, index).trim());
      start = index + 1;
    }
  }

  const last = selector.slice(start).trim();
  if (last) groups.push(last);
  return groups;
}

function parseSelectorGroup(selector) {
  const tokens = [];
  let buffer = "";
  let quote = "";
  let brackets = 0;
  let parentheses = 0;
  let pendingCombinator = null;

  const pushBuffer = () => {
    const compound = buffer.trim();
    if (!compound) return;
    tokens.push({ compound, combinator: tokens.length ? (pendingCombinator || " ") : null });
    buffer = "";
    pendingCombinator = null;
  };

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (quote) {
      buffer += character;
      if (character === quote && selector[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      buffer += character;
      continue;
    }
    if (character === "[") brackets += 1;
    else if (character === "]") brackets -= 1;
    else if (character === "(") parentheses += 1;
    else if (character === ")") parentheses -= 1;

    if (brackets === 0 && parentheses === 0 && character === ">") {
      pushBuffer();
      pendingCombinator = ">";
      continue;
    }
    if (brackets === 0 && parentheses === 0 && /\s/.test(character)) {
      pushBuffer();
      if (tokens.length && !pendingCombinator) pendingCombinator = " ";
      continue;
    }
    buffer += character;
  }
  pushBuffer();
  return tokens;
}

function attributeMatches(element, name, operator, expected) {
  const actual = element.getAttribute(name);
  if (operator == null) return actual !== null;
  if (actual === null) return false;
  if (operator === "=") return actual === expected;
  if (operator === "*=") return actual.includes(expected);
  if (operator === "^=") return actual.startsWith(expected);
  if (operator === "$=") return actual.endsWith(expected);
  if (operator === "~=") return actual.split(/\s+/).includes(expected);
  if (operator === "|=") return actual === expected || actual.startsWith(`${expected}-`);
  return false;
}

function matchesCompound(element, compound, scope) {
  if (compound.includes(":scope") && element !== scope) return false;
  if (compound.includes(":not(:disabled)") && element.hasAttribute("disabled")) return false;
  if (compound.includes(":disabled") && !compound.includes(":not(:disabled)") && !element.hasAttribute("disabled")) return false;

  const withoutPseudo = compound
    .replace(/:scope/g, "")
    .replace(/:not\(:disabled\)/g, "")
    .replace(/:disabled/g, "");
  const tag = withoutPseudo.match(/^([a-z][a-z0-9-]*|\*)/i)?.[1];
  if (tag && tag !== "*" && element.tagName.toLowerCase() !== tag.toLowerCase()) return false;

  for (const match of withoutPseudo.matchAll(/#([a-z0-9_-]+)/gi)) {
    if (element.getAttribute("id") !== match[1]) return false;
  }
  for (const match of withoutPseudo.matchAll(/\.([a-z0-9_-]+)/gi)) {
    if (!element.classList.contains(match[1])) return false;
  }
  for (const match of withoutPseudo.matchAll(/\[([^\]=~*^$|\s]+)\s*(?:(\*=|\^=|\$=|~=|\|=|=)\s*(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g)) {
    const expected = (match[3] ?? match[4] ?? match[5] ?? "").trim();
    if (!attributeMatches(element, match[1], match[2], expected)) return false;
  }
  return true;
}

function matchesSelectorGroup(element, selector, scope) {
  const tokens = parseSelectorGroup(selector);
  if (!tokens.length) return false;

  const matchAt = (candidate, index) => {
    if (!candidate || candidate.nodeType !== 1 || !matchesCompound(candidate, tokens[index].compound, scope)) return false;
    if (index === 0) return true;
    const combinator = tokens[index].combinator || " ";
    if (combinator === ">") return matchAt(candidate.parentElement, index - 1);
    let parent = candidate.parentElement;
    while (parent) {
      if (matchAt(parent, index - 1)) return true;
      if (parent === scope) break;
      parent = parent.parentElement;
    }
    return false;
  };

  return matchAt(element, tokens.length - 1);
}

function matchesSelector(element, selector, scope = element) {
  return splitSelectorGroups(selector).some((group) => matchesSelectorGroup(element, group, scope));
}

function appendNode(parent, value) {
  const node = typeof value === "string" ? new TestText(value, parent.ownerDocument) : value;
  if (!node) return null;
  if (node.parentNode) node.parentNode.removeChild(node);
  node.parentNode = parent;
  parent.childNodes.push(node);
  return node;
}

class TestText {
  constructor(value, ownerDocument) {
    this.nodeType = 3;
    this.nodeValue = String(value || "");
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
  }

  get parentElement() {
    return this.parentNode?.nodeType === 1 ? this.parentNode : null;
  }

  get textContent() {
    return this.nodeValue;
  }

  set textContent(value) {
    this.nodeValue = String(value || "");
  }

  cloneNode() {
    return new TestText(this.nodeValue, this.ownerDocument);
  }
}

class TestElement {
  constructor(tagName, ownerDocument) {
    this.nodeType = 1;
    this.tagName = String(tagName || "div").toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
    this._attributes = new Map();
    this.onClick = null;
  }

  get parentElement() {
    return this.parentNode?.nodeType === 1 ? this.parentNode : null;
  }

  get isConnected() {
    return Boolean(this.ownerDocument?.contains(this));
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  get attributes() {
    return [...this._attributes].map(([name, value]) => ({ name, value }));
  }

  get classList() {
    const element = this;
    const api = {
      contains(name) {
        return String(element.getAttribute("class") || "").split(/\s+/).filter(Boolean).includes(name);
      },
      add(...names) {
        const values = new Set(String(element.getAttribute("class") || "").split(/\s+/).filter(Boolean));
        names.forEach((name) => values.add(name));
        element.setAttribute("class", [...values].join(" "));
      },
      remove(...names) {
        const blocked = new Set(names);
        const values = String(element.getAttribute("class") || "").split(/\s+/).filter((name) => name && !blocked.has(name));
        if (values.length) element.setAttribute("class", values.join(" "));
        else element.removeAttribute("class");
      }
    };
    api[Symbol.iterator] = function* iterator() {
      yield* String(element.getAttribute("class") || "").split(/\s+/).filter(Boolean);
    };
    return api;
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join("");
  }

  set textContent(value) {
    this.replaceChildren(new TestText(value, this.ownerDocument));
  }

  get innerText() {
    return this.textContent;
  }

  get innerHTML() {
    return this.childNodes.map((node) => serializeNode(node)).join("");
  }

  set innerHTML(value) {
    this.replaceChildren(new TestText(value, this.ownerDocument));
  }

  get outerHTML() {
    return serializeNode(this);
  }

  append(...values) {
    values.forEach((value) => appendNode(this, value));
  }

  appendChild(value) {
    return appendNode(this, value);
  }

  insertBefore(value, reference) {
    const node = typeof value === "string" ? new TestText(value, this.ownerDocument) : value;
    if (!node) return null;
    if (node.parentNode) node.parentNode.removeChild(node);
    const index = this.childNodes.indexOf(reference);
    node.parentNode = this;
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, node);
    return node;
  }

  replaceChildren(...values) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    this.append(...values);
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
    }
    return node;
  }

  remove() {
    this.parentNode?.removeChild(this);
  }

  replaceWith(...values) {
    const parent = this.parentNode;
    if (!parent) return;
    const index = parent.childNodes.indexOf(this);
    this.parentNode = null;
    parent.childNodes.splice(index, 1);
    let insertAt = index;
    for (const value of values) {
      const node = typeof value === "string" ? new TestText(value, this.ownerDocument) : value;
      if (!node) continue;
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = parent;
      parent.childNodes.splice(insertAt, 0, node);
      insertAt += 1;
    }
  }

  contains(node) {
    if (node === this) return true;
    return this.childNodes.some((child) => child === node || (child.nodeType === 1 && child.contains(node)));
  }

  querySelectorAll(selector) {
    const result = [];
    const visit = (node) => {
      for (const child of node.childNodes || []) {
        if (child.nodeType !== 1) continue;
        if (matchesSelector(child, selector, this)) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  matches(selector) {
    return matchesSelector(this, selector, this.ownerDocument || this);
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.nodeType === 1 && matchesSelector(current, selector, this.ownerDocument || this)) return current;
      current = current.parentElement;
    }
    return null;
  }

  getAttribute(name) {
    return this._attributes.has(name) ? this._attributes.get(name) : null;
  }

  setAttribute(name, value) {
    this._attributes.set(String(name), String(value));
  }

  hasAttribute(name) {
    return this._attributes.has(name);
  }

  removeAttribute(name) {
    this._attributes.delete(name);
  }

  cloneNode(deep = false) {
    const clone = new TestElement(this.tagName, this.ownerDocument);
    for (const [name, value] of this._attributes) clone.setAttribute(name, value);
    if (deep) for (const child of this.childNodes) clone.appendChild(child.cloneNode(true));
    return clone;
  }

  click() {
    this.onClick?.({ target: this });
  }
}

class TestDocument extends TestElement {
  constructor() {
    super("#document", null);
    this.nodeType = 9;
    this.ownerDocument = this;
    this.documentElement = null;
    this.body = null;
    this.title = "";
    this.defaultView = {
      navigator: { language: "en" },
      getComputedStyle: () => ({ backgroundColor: "rgb(255, 255, 255)", color: "rgb(13, 13, 13)", colorScheme: "light" })
    };
  }

  createElement(tagName) {
    return new TestElement(tagName, this);
  }

  get isConnected() {
    return true;
  }
}

function serializeNode(node) {
  if (node.nodeType === 3) return escapeHtml(node.nodeValue);
  if (node.nodeType !== 1) return node.childNodes.map((child) => serializeNode(child)).join("");
  const attributes = node.attributes.map(({ name, value }) => ` ${name}="${escapeHtml(value)}"`).join("");
  const content = node.childNodes.map((child) => serializeNode(child)).join("");
  return VOID_ELEMENTS.has(node.tagName.toLowerCase()) ? `<${node.tagName.toLowerCase()}${attributes}>` : `<${node.tagName.toLowerCase()}${attributes}>${content}</${node.tagName.toLowerCase()}>`;
}

function parseAttributes(source) {
  const attributes = [];
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([\s\S]*?)"|'([\s\S]*?)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    attributes.push({ name: match[1], value: decodeEntities(match[2] ?? match[3] ?? match[4] ?? "") });
  }
  return attributes;
}

function parseHtml(source) {
  const document = new TestDocument();
  const stack = [document];
  const tokenPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>/gi;
  let cursor = 0;

  const appendText = (value) => {
    if (value) stack[stack.length - 1].appendChild(new TestText(decodeEntities(value), document));
  };

  for (const token of source.matchAll(tokenPattern)) {
    appendText(source.slice(cursor, token.index));
    const raw = token[0];
    cursor = token.index + raw.length;
    if (raw.startsWith("<!--") || /^<!/i.test(raw)) continue;

    const closing = /^<\//.test(raw);
    const match = raw.match(/^<\/?([a-z][a-z0-9-]*)\s*([\s\S]*?)\/?>(?:\s*)$/i);
    if (!match) continue;
    const tagName = match[1].toLowerCase();
    if (closing) {
      const index = stack.findLastIndex((node) => node.nodeType === 1 && node.tagName.toLowerCase() === tagName);
      if (index >= 0) stack.length = index;
      continue;
    }

    const element = new TestElement(tagName, document);
    for (const attribute of parseAttributes(match[2])) element.setAttribute(attribute.name, attribute.value);
    stack[stack.length - 1].appendChild(element);
    if (!document.documentElement && tagName === "html") document.documentElement = element;
    if (!document.body && tagName === "body") document.body = element;
    if (!VOID_ELEMENTS.has(tagName)) stack.push(element);
  }
  appendText(source.slice(cursor));
  document.documentElement ||= document.querySelector("html");
  document.body ||= document.querySelector("body");
  document.title = document.querySelector("title")?.textContent || "ChatGPT";
  return document;
}

function installReceiptRenderer(document) {
  const receiptSelector = ".cga-sent-receipt";
  const itemSelector = ".cga-sent-receipt__item";
  const quoteSelector = ".cga-sent-receipt__quote";
  const commentSelector = ".cga-sent-receipt__comment";
  const panelSelector = ".cga-sent-receipt__panel";
  const toggleSelector = ".cga-sent-receipt__toggle";
  const dataByKey = new Map();
  let renderCount = 0;

  const keyFor = (receipt) => receipt.getAttribute("data-cga-key") || receipt.closest("[data-message-id]")?.getAttribute("data-message-id") || "";
  const readItems = (receipt) => {
    const items = [...receipt.querySelectorAll(itemSelector)].map((item) => ({
      selectedText: item.querySelector(quoteSelector)?.textContent || "",
      annotation: item.querySelector(commentSelector)?.textContent || ""
    }));
    if (items.length) return items;
    const selected = receipt.getAttribute("data-cga-selected");
    const annotations = receipt.getAttribute("data-cga-annotation");
    if (selected == null && annotations == null) return [];
    return String(selected || "").split("||").map((selectedText, index) => ({
      selectedText,
      annotation: String(annotations || "").split("||")[index] || ""
    }));
  };

  for (const receipt of document.querySelectorAll(receiptSelector)) dataByKey.set(keyFor(receipt), readItems(receipt));

  const renderReceipt = (source, expanded) => {
    const receipt = document.createElement("div");
    for (const attribute of source.attributes) receipt.setAttribute(attribute.name, attribute.value);
    const toggle = document.createElement("button");
    toggle.setAttribute("class", "cga-sent-receipt__toggle");
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.textContent = "Annotations";
    receipt.append(toggle);
    if (expanded) {
      const panel = document.createElement("div");
      panel.setAttribute("class", "cga-sent-receipt__panel");
      for (const itemData of dataByKey.get(keyFor(source)) || []) {
        const item = document.createElement("div");
        item.setAttribute("class", "cga-sent-receipt__item");
        const quote = document.createElement("blockquote");
        quote.setAttribute("class", "cga-sent-receipt__quote");
        quote.textContent = itemData.selectedText;
        const comment = document.createElement("div");
        comment.setAttribute("class", "cga-sent-receipt__comment");
        comment.textContent = itemData.annotation;
        item.append(quote, comment);
        panel.append(item);
      }
      receipt.append(panel);
    }
    toggle.onClick = () => {
      renderAll(expanded ? null : keyFor(source));
    };
    return receipt;
  };

  const renderAll = (openKey) => {
    renderCount += 1;
    for (const source of [...document.querySelectorAll(receiptSelector)]) {
      source.replaceWith(renderReceipt(source, keyFor(source) === openKey));
    }
  };

  for (const receipt of document.querySelectorAll(receiptSelector)) {
    const toggle = receipt.querySelector(toggleSelector);
    if (!toggle) continue;
    const expanded = Boolean(receipt.querySelector(panelSelector));
    toggle.onClick = () => renderAll(expanded ? null : keyFor(receipt));
  }

  Object.defineProperty(document, "receiptRenderCount", {
    configurable: true,
    get: () => renderCount
  });
  return document;
}

module.exports = {
  installReceiptRenderer,
  parseHtml
};
