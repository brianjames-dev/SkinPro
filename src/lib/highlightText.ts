export const stripHighlightTokens = (text: string) =>
  text.replace(/\[h\]|\[\/h\]/g, "");

export const normalizeHighlightTokens = (text: string) => {
  const tokens = text.split(/(\[h\]|\[\/h\])/);
  let open = false;
  const normalized = tokens
    .map((token) => {
      if (token === "[h]") {
        if (open) {
          return "";
        }
        open = true;
        return token;
      }
      if (token === "[/h]") {
        if (!open) {
          return "";
        }
        open = false;
        return token;
      }
      return token;
    })
    .join("");
  return normalized.replace(/\[h\]\[\/h\]/g, "");
};

export const mapDisplayIndexToRaw = (raw: string, displayIndex: number) => {
  let rawIndex = 0;
  let displayCount = 0;
  while (rawIndex < raw.length && displayCount < displayIndex) {
    if (raw.startsWith("[h]", rawIndex)) {
      rawIndex += 3;
      continue;
    }
    if (raw.startsWith("[/h]", rawIndex)) {
      rawIndex += 4;
      continue;
    }
    rawIndex += 1;
    displayCount += 1;
  }
  return rawIndex;
};

export const applyDisplayChangeToRaw = (raw: string, nextDisplay: string) => {
  const prevDisplay = stripHighlightTokens(raw);
  let start = 0;
  while (
    start < prevDisplay.length &&
    start < nextDisplay.length &&
    prevDisplay[start] === nextDisplay[start]
  ) {
    start += 1;
  }

  let prevEnd = prevDisplay.length;
  let nextEnd = nextDisplay.length;
  while (
    prevEnd > start &&
    nextEnd > start &&
    prevDisplay[prevEnd - 1] === nextDisplay[nextEnd - 1]
  ) {
    prevEnd -= 1;
    nextEnd -= 1;
  }

  const rawStart = mapDisplayIndexToRaw(raw, start);
  const rawEnd = mapDisplayIndexToRaw(raw, prevEnd);
  const nextRaw =
    raw.slice(0, rawStart) +
    nextDisplay.slice(start, nextEnd) +
    raw.slice(rawEnd);
  return normalizeHighlightTokens(nextRaw);
};

export const applyHighlightToRaw = (
  raw: string,
  displayStart: number,
  displayEnd: number
) => {
  if (displayStart === displayEnd) {
    return raw;
  }
  const rawStart = mapDisplayIndexToRaw(raw, displayStart);
  const rawEnd = mapDisplayIndexToRaw(raw, displayEnd);
  const nextRaw =
    raw.slice(0, rawStart) +
    "[h]" +
    raw.slice(rawStart, rawEnd) +
    "[/h]" +
    raw.slice(rawEnd);
  return normalizeHighlightTokens(nextRaw);
};
