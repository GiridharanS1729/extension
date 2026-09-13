// Minimal, dependency-free Markdown -> HTML renderer for the notes preview.
// Every text fragment is HTML-escaped before any tag is added, so the only
// markup in the output comes from this file's own substitutions — safe
// against injected <script>/onerror/etc. Structural markers (#, -, >, ...)
// are matched on the raw line first, since escaping would corrupt `>`.
// Supports: # / ## / ### headings, **bold**, *italic*, `code`, ```code
// blocks```, [text](url) links (http/https only), > blockquotes, - / *
// bullet lists, 1. numbered lists, and paragraphs.

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return out;
}

export function renderMarkdown(raw) {
  const lines = (raw || "").split("\n");

  const htmlParts = [];
  let listType = null; // "ul" | "ol" | null
  let paragraphLines = [];
  let inCodeBlock = false;
  let codeLines = [];

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      htmlParts.push(`<p>${paragraphLines.map(renderInline).join("<br>")}</p>`);
      paragraphLines = [];
    }
  }

  function closeList() {
    if (listType) {
      htmlParts.push(`</${listType}>`);
      listType = null;
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        htmlParts.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        closeList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);

    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      htmlParts.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
    } else if (bullet) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        htmlParts.push("<ul>");
        listType = "ul";
      }
      htmlParts.push(`<li>${renderInline(bullet[1])}</li>`);
    } else if (numbered) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        htmlParts.push("<ol>");
        listType = "ol";
      }
      htmlParts.push(`<li>${renderInline(numbered[1])}</li>`);
    } else if (quote) {
      flushParagraph();
      closeList();
      htmlParts.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
    } else if (line.trim() === "") {
      flushParagraph();
      closeList();
    } else {
      closeList();
      paragraphLines.push(line);
    }
  }

  flushParagraph();
  closeList();
  if (inCodeBlock && codeLines.length > 0) {
    htmlParts.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
  }

  return htmlParts.join("");
}

// ---- HTML -> Markdown (the inverse direction, used by the editable preview
// pane: the browser edits the rendered DOM directly via contenteditable, and
// this walks that DOM back into the plain-text Markdown source so the
// underlying note content stays in sync). Handles the same tag subset that
// renderMarkdown produces, plus a plain <div> fallback since contenteditable
// wraps typed lines in <div>s (Chrome) rather than <p>s. Unrecognized tags
// fall through to their text content so no keystroke is ever dropped.

function serializeInline(node) {
  let out = "";
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      if (tag === "br") {
        out += "\n";
      } else if (tag === "strong" || tag === "b") {
        out += `**${serializeInline(child)}**`;
      } else if (tag === "em" || tag === "i") {
        out += `*${serializeInline(child)}*`;
      } else if (tag === "code") {
        out += `\`${child.textContent}\``;
      } else if (tag === "a") {
        out += `[${serializeInline(child)}](${child.getAttribute("href") || ""})`;
      } else {
        out += serializeInline(child);
      }
    }
  }
  return out;
}

function serializeBlock(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === "h1" || tag === "h2" || tag === "h3") {
    return "#".repeat(Number(tag[1])) + " " + serializeInline(el).trim();
  }
  if (tag === "ul") {
    return Array.from(el.children).map((li) => "- " + serializeInline(li)).join("\n");
  }
  if (tag === "ol") {
    return Array.from(el.children).map((li, i) => `${i + 1}. ` + serializeInline(li)).join("\n");
  }
  if (tag === "blockquote") {
    return "> " + serializeInline(el);
  }
  if (tag === "pre") {
    const codeEl = el.querySelector("code");
    return "```\n" + (codeEl ? codeEl.textContent : el.textContent) + "\n```";
  }
  // p, div (contenteditable line wrapper), or anything else — treat as a
  // plain text block.
  return serializeInline(el);
}

export function serializeMarkdown(container) {
  const blocks = [];
  for (const child of container.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text.trim()) blocks.push(text);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const block = serializeBlock(child);
    if (block.trim() !== "") blocks.push(block);
  }
  return blocks.join("\n\n");
}
