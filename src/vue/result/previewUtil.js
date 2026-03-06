export function normalizeCellValue(origin) {
  if (origin === undefined || origin === null) {
    return null;
  }
  if (origin && origin.hasOwnProperty && origin.hasOwnProperty("type")) {
    return String.fromCharCode.apply(null, new Uint16Array(origin.data));
  }
  return origin;
}

export function formatPreviewValue(value, formatter) {
  if (value === null || value === undefined) {
    return { text: "(NULL)", isPre: false };
  }
  const normalized = normalizeCellValue(value);
  if (formatter === "raw") {
    return { text: String(normalized), isPre: false };
  }
  if (formatter === "text") {
    return { text: String(normalized), isPre: false };
  }
  if (formatter === "array") {
    if (Array.isArray(normalized)) {
      return { text: normalized.join("\n"), isPre: true };
    }
    if (typeof normalized === "string") {
      const split = normalized.split(",").map((s) => s.trim());
      return { text: split.join("\n"), isPre: true };
    }
    return { text: String(normalized), isPre: false };
  }
  if (formatter === "json") {
    if (typeof normalized === "object") {
      return { text: JSON.stringify(normalized, null, 2), isPre: true };
    }
    if (typeof normalized === "string") {
      try {
        const parsed = JSON.parse(normalized);
        return { text: JSON.stringify(parsed, null, 2), isPre: true };
      } catch (e) {
        return { text: normalized, isPre: false };
      }
    }
    return { text: String(normalized), isPre: false };
  }
  // auto
  if (typeof normalized === "object") {
    return { text: JSON.stringify(normalized, null, 2), isPre: true };
  }
  if (typeof normalized === "string") {
    const trimmed = normalized.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(normalized);
        return { text: JSON.stringify(parsed, null, 2), isPre: true };
      } catch (e) {
        // ignore
      }
    }
  }
  return { text: String(normalized), isPre: false };
}
