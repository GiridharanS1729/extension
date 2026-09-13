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

  return htmlParts.join("") || '<p class="notes-preview-empty">Nothing to preview yet.</p>';
}
