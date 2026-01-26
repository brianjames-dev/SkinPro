const HIGHLIGHT_OPEN = "[[highlight]]";
const HIGHLIGHT_CLOSE = "[[/highlight]]";

export const stripHighlightTokens = (text: string) =>
  text.replace(/\[\[highlight\]\]|\[\[\/highlight\]\]/g, "");

export const normalizeHighlightTokens = (text: string) => {
  const tokens = text.split(/(\[\[highlight\]\]|\[\[\/highlight\]\])/);
  let open = false;
  const normalized = tokens
    .map((token) => {
      if (token === HIGHLIGHT_OPEN) {
        if (open) {
          return "";
        }
        open = true;
        return token;
      }
      if (token === HIGHLIGHT_CLOSE) {
        if (!open) {
          return "";
        }
        open = false;
        return token;
      }
      return token;
    })
    .join("");
  return normalized.replace(/\[\[highlight\]\]\[\[\/highlight\]\]/g, "");
};

export const mapDisplayIndexToRaw = (raw: string, displayIndex: number) => {
  let rawIndex = 0;
  let displayCount = 0;
  while (rawIndex < raw.length && displayCount < displayIndex) {
    if (raw.startsWith(HIGHLIGHT_OPEN, rawIndex)) {
      rawIndex += HIGHLIGHT_OPEN.length;
      continue;
    }
    if (raw.startsWith(HIGHLIGHT_CLOSE, rawIndex)) {
      rawIndex += HIGHLIGHT_CLOSE.length;
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
    HIGHLIGHT_OPEN +
    raw.slice(rawStart, rawEnd) +
    HIGHLIGHT_CLOSE +
    raw.slice(rawEnd);
  return normalizeHighlightTokens(nextRaw);
};

type HighlightSegment = {
  text: string;
  highlight: boolean;
};

const tokenizeHighlight = (text: string): HighlightSegment[] => {
  const tokens = text.split(/(\[\[highlight\]\]|\[\[\/highlight\]\])/);
  const segments: HighlightSegment[] = [];
  let isHighlight = false;
  for (const token of tokens) {
    if (token === HIGHLIGHT_OPEN) {
      isHighlight = true;
      continue;
    }
    if (token === HIGHLIGHT_CLOSE) {
      isHighlight = false;
      continue;
    }
    if (token) {
      segments.push({ text: token, highlight: isHighlight });
    }
  }
  return segments;
};

const mergeSegments = (segments: HighlightSegment[]) => {
  const merged: HighlightSegment[] = [];
  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }
    const last = merged[merged.length - 1];
    if (last && last.highlight === segment.highlight) {
      last.text += segment.text;
      continue;
    }
    merged.push({ ...segment });
  }
  return merged;
};

export const removeHighlightFromRaw = (
  raw: string,
  displayStart: number,
  displayEnd: number
) => {
  if (displayStart === displayEnd) {
    return raw;
  }

  const display = stripHighlightTokens(raw);
  const maxIndex = display.length;
  let start = Math.min(displayStart, displayEnd);
  let end = Math.max(displayStart, displayEnd);
  start = Math.max(0, Math.min(start, maxIndex));
  end = Math.max(0, Math.min(end, maxIndex));
  if (start === end) {
    return raw;
  }

  const segments = tokenizeHighlight(raw);
  const nextSegments: HighlightSegment[] = [];
  let cursor = 0;

  for (const segment of segments) {
    const segStart = cursor;
    const segEnd = cursor + segment.text.length;
    cursor = segEnd;

    if (!segment.highlight || end <= segStart || start >= segEnd) {
      nextSegments.push(segment);
      continue;
    }

    const overlapStart = Math.max(segStart, start);
    const overlapEnd = Math.min(segEnd, end);
    const before = segment.text.slice(0, overlapStart - segStart);
    const middle = segment.text.slice(overlapStart - segStart, overlapEnd - segStart);
    const after = segment.text.slice(overlapEnd - segStart);

    if (before) {
      nextSegments.push({ text: before, highlight: true });
    }
    if (middle) {
      nextSegments.push({ text: middle, highlight: false });
    }
    if (after) {
      nextSegments.push({ text: after, highlight: true });
    }
  }

  const merged = mergeSegments(nextSegments);
  const rebuilt = merged
    .map((segment) =>
      segment.highlight
        ? `${HIGHLIGHT_OPEN}${segment.text}${HIGHLIGHT_CLOSE}`
        : segment.text
    )
    .join("");

  return normalizeHighlightTokens(rebuilt);
};

export const hasHighlightInDisplayRange = (
  raw: string,
  displayStart: number,
  displayEnd: number
) => {
  const display = stripHighlightTokens(raw);
  const maxIndex = display.length;
  let start = Math.min(displayStart, displayEnd);
  let end = Math.max(displayStart, displayEnd);
  start = Math.max(0, Math.min(start, maxIndex));
  end = Math.max(0, Math.min(end, maxIndex));
  if (start === end) {
    return false;
  }

  const segments = tokenizeHighlight(raw);
  let cursor = 0;
  for (const segment of segments) {
    const segStart = cursor;
    const segEnd = cursor + segment.text.length;
    cursor = segEnd;
    if (!segment.highlight) {
      continue;
    }
    if (end <= segStart || start >= segEnd) {
      continue;
    }
    return true;
  }
  return false;
};

export const toggleHighlightInRaw = (
  raw: string,
  displayStart: number,
  displayEnd: number
) => {
  if (displayStart === displayEnd) {
    return raw;
  }
  if (hasHighlightInDisplayRange(raw, displayStart, displayEnd)) {
    return removeHighlightFromRaw(raw, displayStart, displayEnd);
  }
  return applyHighlightToRaw(raw, displayStart, displayEnd);
};
