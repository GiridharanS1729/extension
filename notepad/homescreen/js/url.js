// URL normalization and validation for user-entered shortcuts.
// Only http/https are ever allowed; javascript:, data:, file:, etc. are rejected.

const SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

/**
 * Normalizes user input into a safe absolute http(s) URL string.
 * Throws an Error with a user-facing message when the input is invalid.
 */
export function normalizeAndValidateUrl(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    throw new Error("Enter a URL.");
  }

  const candidate = SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Enter a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links are allowed.");
  }

  if (!url.hostname || !url.hostname.includes(".")) {
    throw new Error("Enter a valid website address.");
  }

  return url.toString();
}

export function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
