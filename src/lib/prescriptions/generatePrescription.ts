import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { safeClientName } from "@/lib/clientAssets";
import { ensureDir, uniqueFilePath } from "@/lib/fileUtils";

type StepItem = {
  product?: string | null;
  product2?: string | null;
  directions?: string | null;
};

type StepsDict = {
  start_date?: string;
  [key: string]: unknown;
};

type ColumnData = {
  header: string;
  header2: string;
  steps: {
    product: string;
    directions: string;
  }[];
};

type GenerateArgs = {
  clientId: number;
  clientName: string;
  steps: StepsDict;
  outputPath?: string;
};

const DEFAULT_TITLE = "DAILY SKINCARE ROUTINE";
const DEBUG_PAGE_CUTOFF = false;
const FOOTER_HEIGHT = 24;
const PRODUCT_LINE_MAX_CHARS = 70;
const MIN_HYPHEN_PART = 3;
const PRODUCT_DESCRIPTION_GAP = 0.25;
const PRODUCT_LINE_SPACING = 1.1;
const FONT_HEADER = "Helvetica-Bold";
const FONT_LABEL = "Helvetica-Bold";
const FONT_BODY = "Helvetica";
const FONT_BODY_BOLD = "Helvetica-Bold";
const FONT_DISCLAIMER = "Helvetica-Oblique";
const ROW_TINT_COLOR = "#d9d9d9";
const ROW_TINT_OPACITY = 0.35;
const GRID_VERTICAL_COLOR = "#3b3a3c";
const GRID_VERTICAL_WIDTH = 0.5;
const GRID_HORIZONTAL_COLOR = "#c9c4cf";
const GRID_HORIZONTAL_WIDTH = 0.4;
const STEP_BADGE_HEIGHT = 12;
const STEP_BADGE_RADIUS = 7;
const STEP_BADGE_PADDING_X = 5;
const STEP_BADGE_COLOR = "#2e2a22";
const STEP_BADGE_TEXT_SIZE = 6;
const STEP_BADGE_PADDING_Y = 3;
const HEADER_PRIMARY_SIZE = 11;
const HEADER_SECONDARY_SIZE = 9;
const HEADER_SECONDARY_COLOR = "#6f6a75";
const HEADER_LINE_HEIGHT = 12;
const HEADER_BOX_TOP_OFFSET = 5;
const DISCLAIMER_COLOR = "#5b575f";
const HIGHLIGHT_COLOR = "#fff3a8";
const PRODUCT_UNDERLINE_COLOR = "#6d6875";
const PRODUCT_UNDERLINE_WIDTH = 0.5;
const HEADER_GRADIENT_TOP_OPACITY = 0.08;
const HEADER_GRADIENT_FADE = 1;
const DATE_VALUE_GAP = 3;
const HEADER_TABLE_GAP = 2;
const TABLE_TOP_LINE_GAP = 0;
const HEADER_ROW_GAP = 10;
const MIN_CELL_LINES = 4;
const CELL_PADDING = 10;
const CELL_CENTER_OFFSET = 1;

const DISCLAIMER =
  "*CORIUM CORRECTIVE 360° CANNOT BE COMBINED WITH ANY OTHER SKIN CARE PRODUCTS";

const LOGO_PATHS = [
  process.env.SKINPRO_LOGO_PATH,
  path.resolve(process.cwd(), "SkincareByAmelia.png")
].filter(Boolean) as string[];

const WATERMARK_LOGO_PATHS = [
  process.env.SKINPRO_WATERMARK_LOGO_PATH,
  path.resolve(process.cwd(), "SkincareLogo.png")
].filter(Boolean) as string[];

function resolveLogoPath(): string | null {
  for (const candidate of LOGO_PATHS) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveWatermarkLogoPath(): string | null {
  for (const candidate of WATERMARK_LOGO_PATHS) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function extractColumns(steps: StepsDict): ColumnData[] {
  let maxCol = 0;
  for (let i = 1; i <= 4; i += 1) {
    const headerKey = `Col${i}_Header`;
    const colKey = `Col${i}`;
    if (steps[headerKey] || steps[colKey]) {
      maxCol = i;
    }
  }

  if (maxCol === 0) {
    maxCol = 2;
  }

  const columns: ColumnData[] = [];
  for (let i = 1; i <= maxCol; i += 1) {
    const headerKey = `Col${i}_Header`;
    const colKey = `Col${i}`;
    const headerRaw =
      typeof steps[headerKey] === "string" ? (steps[headerKey] as string) : "";
    const header2Raw =
      typeof steps[`Col${i}_Header2`] === "string"
        ? (steps[`Col${i}_Header2`] as string)
        : "";
    const header = headerRaw.trim() || `Column ${i}`;

    const rawSteps = Array.isArray(steps[colKey])
      ? (steps[colKey] as StepItem[])
      : [];

    columns.push({
      header,
      header2: header2Raw.trim(),
      steps: rawSteps.map((step) => {
        const primary = step.product ?? "";
        const secondary = step.product2 ?? "";
        const product = primary || secondary;
        return {
          product,
          directions: step.directions ?? ""
        };
      })
    });
  }

  return columns;
}

function tokenizeHighlight(text: string): { text: string; highlight: boolean }[] {
  const tokens = text.split(/(\[\[highlight\]\]|\[\[\/highlight\]\])/);
  const segments: { text: string; highlight: boolean }[] = [];
  let isHighlight = false;

  for (const token of tokens) {
    if (token === "[[highlight]]") {
      isHighlight = true;
      continue;
    }
    if (token === "[[/highlight]]") {
      isHighlight = false;
      continue;
    }
    if (token) {
      segments.push({ text: token, highlight: isHighlight });
    }
  }

  return segments;
}

function stripLeadingWhitespace(
  line: { text: string; highlight: boolean }[]
): { text: string; highlight: boolean }[] {
  let index = 0;
  while (index < line.length) {
    const trimmed = line[index].text.replace(/^\s+/, "");
    if (trimmed) {
      if (trimmed !== line[index].text) {
        line[index] = { ...line[index], text: trimmed };
      }
      break;
    }
    index += 1;
  }
  return line.slice(index);
}

function findSplitIndex(
  doc: PDFKit.PDFDocument,
  word: string,
  availableWidth: number,
  availableChars: number
) {
  const minSplit = MIN_HYPHEN_PART;
  const maxSplit = word.length - MIN_HYPHEN_PART;
  if (maxSplit < minSplit) {
    return 0;
  }
  const maxLen = Math.min(
    maxSplit,
    Number.isFinite(availableChars) ? Math.max(0, availableChars - 1) : maxSplit
  );
  if (maxLen < minSplit) {
    return 0;
  }
  let best = 0;
  for (let i = minSplit; i <= maxLen; i += 1) {
    const candidate = `${word.slice(0, i)}-`;
    if (doc.widthOfString(candidate) <= availableWidth) {
      best = i;
    } else {
      break;
    }
  }
  return best;
}

function wrapHighlightedText(
  doc: PDFKit.PDFDocument,
  text: string,
  maxWidth: number,
  fontSize: number
) {
  doc.font(FONT_BODY).fontSize(fontSize);
  const segments = tokenizeHighlight(text);
  const lines: { text: string; highlight: boolean }[][] = [];
  let currentLine: { text: string; highlight: boolean }[] = [];
  let currentWidth = 0;

  const pushLine = () => {
    const cleaned = stripLeadingWhitespace(currentLine).filter((segment) =>
      segment.text.length > 0
    );
    if (cleaned.length > 0) {
      lines.push(cleaned);
    }
    currentLine = [];
    currentWidth = 0;
  };

  const addToken = (token: string, highlight: boolean) => {
    if (!token) {
      return;
    }
    const isWhitespace = /^\s+$/.test(token);
    if (isWhitespace) {
      if (currentLine.length === 0) {
        return;
      }
      const width = doc.widthOfString(token);
      if (currentWidth + width > maxWidth) {
        pushLine();
        return;
      }
      currentLine.push({ text: token, highlight });
      currentWidth += width;
      return;
    }

    let remaining = token;
    while (remaining.length > 0) {
      const availableWidth = maxWidth - currentWidth;
      const wordWidth = doc.widthOfString(remaining);
      if (wordWidth <= availableWidth && availableWidth > 0) {
        currentLine.push({ text: remaining, highlight });
        currentWidth += wordWidth;
        break;
      }

      if (remaining.length <= 5) {
        if (currentLine.length > 0) {
          pushLine();
          continue;
        }
        currentLine.push({ text: remaining, highlight });
        currentWidth += doc.widthOfString(remaining);
        break;
      }

      if (currentLine.length > 0 && availableWidth <= 0) {
        pushLine();
        continue;
      }

      const splitIndex = findSplitIndex(
        doc,
        remaining,
        currentLine.length > 0 ? availableWidth : maxWidth,
        Number.POSITIVE_INFINITY
      );
      if (splitIndex === 0) {
        if (currentLine.length > 0) {
          pushLine();
          continue;
        }
        currentLine.push({ text: remaining, highlight });
        currentWidth += doc.widthOfString(remaining);
        remaining = "";
        break;
      }

      const head = remaining.slice(0, splitIndex);
      const tail = remaining.slice(splitIndex);
      const piece = `${head}-`;
      currentLine.push({ text: piece, highlight });
      currentWidth += doc.widthOfString(piece);
      pushLine();
      remaining = tail;
    }
  };

  for (const segment of segments) {
    const parts = segment.text.split("\n");
    parts.forEach((part, index) => {
      const tokens = part.split(/(\s+)/).filter(Boolean);
      tokens.forEach((token) => addToken(token, segment.highlight));
      if (index < parts.length - 1) {
        pushLine();
      }
    });
  }

  pushLine();
  return lines;
}

function wrapPlainText(
  doc: PDFKit.PDFDocument,
  text: string,
  maxWidth: number,
  fontSize: number,
  options?: { maxChars?: number }
) {
  doc.font(FONT_BODY_BOLD).fontSize(fontSize);
  const lines: string[] = [];
  let currentLine = "";
  let currentWidth = 0;
  let currentChars = 0;
  const maxChars = options?.maxChars ?? Number.POSITIVE_INFINITY;

  const pushLine = () => {
    const cleaned = currentLine.replace(/^\s+/, "").trimEnd();
    if (cleaned) {
      lines.push(cleaned);
    }
    currentLine = "";
    currentWidth = 0;
    currentChars = 0;
  };

  const addToken = (token: string) => {
    if (!token) {
      return;
    }
    const isWhitespace = /^\s+$/.test(token);
    if (isWhitespace) {
      if (!currentLine) {
        return;
      }
      if (currentWidth + doc.widthOfString(token) > maxWidth ||
          currentChars + token.length > maxChars) {
        pushLine();
        return;
      }
      currentLine += token;
      currentWidth += doc.widthOfString(token);
      currentChars += token.length;
      return;
    }

    let remaining = token;
    while (remaining.length > 0) {
      const availableWidth = maxWidth - currentWidth;
      const availableChars = maxChars - currentChars;
      const wordWidth = doc.widthOfString(remaining);
      if (wordWidth <= availableWidth && remaining.length <= availableChars) {
        currentLine += remaining;
        currentWidth += wordWidth;
        currentChars += remaining.length;
        break;
      }

      if (remaining.length <= 5) {
        if (currentLine) {
          pushLine();
          continue;
        }
        currentLine += remaining;
        currentWidth += doc.widthOfString(remaining);
        currentChars += remaining.length;
        break;
      }

      if (currentLine && (availableWidth <= 0 || availableChars <= 1)) {
        pushLine();
        continue;
      }

      const splitIndex = findSplitIndex(
        doc,
        remaining,
        currentLine ? availableWidth : maxWidth,
        Number.isFinite(availableChars) ? availableChars : Number.POSITIVE_INFINITY
      );
      if (splitIndex === 0) {
        if (currentLine) {
          pushLine();
          continue;
        }
        currentLine += remaining;
        currentWidth += doc.widthOfString(remaining);
        currentChars += remaining.length;
        remaining = "";
        break;
      }
      const head = remaining.slice(0, splitIndex);
      const tail = remaining.slice(splitIndex);
      const piece = `${head}-`;
      currentLine += piece;
      currentWidth += doc.widthOfString(piece);
      currentChars += piece.length;
      pushLine();
      remaining = tail;
    }
  };

  const parts = text.split("\n");
  parts.forEach((part, index) => {
    const tokens = part.split(/(\s+)/).filter(Boolean);
    tokens.forEach(addToken);
    if (index < parts.length - 1) {
      pushLine();
    }
  });

  pushLine();
  return lines;
}

function drawProductBlock(args: {
  doc: PDFKit.PDFDocument;
  x: number;
  y: number;
  product: string;
  directions: string;
  maxWidth: number;
  fontSize: number;
  lineHeight: number;
  dryRun?: boolean;
}) {
  const {
    doc,
    x,
    y,
    product,
    directions,
    maxWidth,
    fontSize,
    lineHeight,
    dryRun
  } = args;

  let lineOffset = 0;

  const productText = product.trim();
  if (productText) {
    const productLines = wrapPlainText(doc, productText, maxWidth, fontSize, {
      maxChars: PRODUCT_LINE_MAX_CHARS
    }).slice(0, 2);
    productLines.forEach((line, index) => {
      const lineY = y + lineOffset * lineHeight;
      const isLastLine = index === productLines.length - 1;
      if (!dryRun) {
        doc.font(FONT_BODY_BOLD).fontSize(fontSize);
        const labelText = line.trim();
        const renderedText = isLastLine ? `${labelText}:` : labelText;
        doc.text(renderedText, x, lineY, { lineBreak: false });
        const labelWidth = doc.widthOfString(renderedText);
        doc.save();
        doc.strokeColor(PRODUCT_UNDERLINE_COLOR).lineWidth(PRODUCT_UNDERLINE_WIDTH);
        doc
          .moveTo(x, lineY + fontSize - 1)
          .lineTo(x + labelWidth, lineY + fontSize - 1)
          .stroke();
        doc.restore();
      }
      lineOffset += PRODUCT_LINE_SPACING;
    });
    lineOffset += PRODUCT_DESCRIPTION_GAP;
  }

  const lines = wrapHighlightedText(doc, directions, maxWidth, fontSize);

  if (!dryRun) {
    doc.font(FONT_BODY).fontSize(fontSize);
    lines.forEach((line, index) => {
      const lineY = y + (lineOffset + index) * lineHeight;
      let cursorX = x;

      line.forEach((segment) => {
        const width = doc.widthOfString(segment.text);
        if (segment.highlight) {
          doc.save();
          doc.fillColor(HIGHLIGHT_COLOR);
          doc.rect(cursorX, lineY - 1, width, lineHeight).fill();
          doc.restore();
        }
        doc.fillColor("#1b1b1b");
        doc.text(segment.text, cursorX, lineY, { lineBreak: false });
        cursorX += width;
      });
    });
  }

  return lineOffset + lines.length;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  args: { clientName: string; startDate: string }
) {
  const { clientName, startDate } = args;
  const pageWidth = doc.page.width;

  const leftMargin = 24;
  const headerTop = 24;
  const logoOffsetY = -5;
  const logoWidth = 96;
  const logoHeight = 75;
  const logoX = leftMargin;
  const logoY = headerTop + logoOffsetY;

  const logoPath = resolveLogoPath();
  if (logoPath) {
    doc.image(logoPath, logoX, logoY, { width: logoWidth, height: logoHeight });
  }

  const textLeftX = leftMargin + logoWidth + 20;
  const titleY = headerTop + 7;
  const infoY = titleY + 28;
  const disclaimerY = infoY + 22;
  const dividerY = headerTop + logoHeight + 8;

  doc.font(FONT_HEADER).fontSize(20);
  doc.text(DEFAULT_TITLE, textLeftX, titleY, { lineBreak: false });

  doc.font(FONT_LABEL).fontSize(12);
  doc.text("NAME:", textLeftX, infoY, { lineBreak: false });

  const nameX = textLeftX + doc.widthOfString("NAME: ");
  doc.font(FONT_BODY).fontSize(12);
  doc.text(clientName, nameX, infoY, { lineBreak: false });

  const dateLabel = "START DATE: ";
  const dateX = nameX + doc.widthOfString(clientName) + 80;
  doc.font(FONT_LABEL).fontSize(12);
  doc.text(dateLabel, dateX, infoY, { lineBreak: false });

  doc.font(FONT_BODY).fontSize(12);
  doc.text(startDate, dateX + doc.widthOfString(dateLabel) + DATE_VALUE_GAP, infoY, {
    lineBreak: false
  });

  doc.font(FONT_DISCLAIMER).fontSize(8.5);
  doc.fillColor(DISCLAIMER_COLOR);
  doc.text(DISCLAIMER, textLeftX, disclaimerY, { lineBreak: false });
  doc.fillColor("#000000");

  doc.lineWidth(0.4);

  return { dividerY };
}

function drawWatermark(doc: PDFKit.PDFDocument) {
  const logoPath = resolveWatermarkLogoPath();
  if (!logoPath) {
    return;
  }

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  const watermarkWidth = 500;
  const watermarkHeight = watermarkWidth / (1200 / 930);
  const watermarkX = (pageWidth - watermarkWidth) / 2;
  const watermarkY = pageHeight - watermarkHeight - 110;

  doc.save();
  doc.opacity(0.05);
  doc.image(logoPath, watermarkX, watermarkY, {
    width: watermarkWidth,
    height: watermarkHeight
  });
  doc.restore();
}

type TableLayout = {
  headerY: number;
  rowTop: number;
  headerLineHeight: number;
  maxHeaderLines: number;
  fontSize: number;
  lineHeight: number;
  textOffsetX: number;
  textOffsetY: number;
  wrapWidth: number;
  leftMargin: number;
  stepLabelWidth: number;
  columnCount: number;
  columnXs: number[];
  columnWidth: number;
  columnGap: number;
  tableLeft: number;
  tableRight: number;
};

function getTableLayout(
  doc: PDFKit.PDFDocument,
  columns: ColumnData[],
  tableTop: number
): TableLayout {
  const pageWidth = doc.page.width;
  const leftMargin = 4;
  const rightMargin = 24;
  const stepLabelWidth = 42;
  const tableLeft = leftMargin + stepLabelWidth;
  const columnCount = columns.length;
  const columnGap = 0;
  const tableWidth = pageWidth - tableLeft - rightMargin;
  const columnWidth = (tableWidth - columnGap * (columnCount - 1)) / columnCount;

  const columnXs = Array.from({ length: columnCount }, (_, index) => {
    return tableLeft + index * (columnWidth + columnGap);
  });

  const headerY = tableTop;
  const headerLineHeight = HEADER_LINE_HEIGHT;
  const headerLinesPerColumn = columns.map((column) =>
    [column.header, column.header2].filter((line) => line.trim()).length || 1
  );
  const maxHeaderLines = Math.max(...headerLinesPerColumn, 1);

  const rowTop = headerY + maxHeaderLines * headerLineHeight + HEADER_ROW_GAP;
  const fontSize = 10;
  const lineHeight = 10;
  const textOffsetX = 6;
  const textOffsetY = -4;
  const wrapWidth = columnWidth - 14;
  const tableRight = tableLeft + columnCount * (columnWidth + columnGap) - columnGap;

  return {
    headerY,
    rowTop,
    headerLineHeight,
    maxHeaderLines,
    fontSize,
    lineHeight,
    textOffsetX,
    textOffsetY,
    wrapWidth,
    leftMargin,
    stepLabelWidth,
    columnCount,
    columnXs,
    columnWidth,
    columnGap,
    tableLeft,
    tableRight
  };
}

function measureRowHeights(
  doc: PDFKit.PDFDocument,
  columns: ColumnData[],
  layout: TableLayout
) {
  const maxSteps = Math.max(...columns.map((column) => column.steps.length), 0);
  const rowHeights: number[] = [];

  for (let i = 0; i < maxSteps; i += 1) {
    const heights = columns.map((column, index) => {
      const step = column.steps[i] ?? { product: "", directions: "" };
      return drawProductBlock({
        doc,
        x: layout.columnXs[index] + layout.textOffsetX,
        y: 0,
        product: step.product ?? "",
        directions: step.directions ?? "",
        maxWidth: layout.wrapWidth,
        fontSize: layout.fontSize,
        lineHeight: layout.lineHeight,
        dryRun: true
      });
    });

    const height =
      Math.max(Math.max(...heights, MIN_CELL_LINES), MIN_CELL_LINES) *
        layout.lineHeight +
      CELL_PADDING;
    rowHeights.push(height);
  }

  return rowHeights;
}

function getPageBreaks(
  rowHeights: number[],
  layout: TableLayout,
  pageHeight: number,
  footerHeight: number
) {
  const breaks: { startRow: number; endRow: number }[] = [];
  const pageBottom = pageHeight - footerHeight;
  let startRow = 0;

  while (startRow < rowHeights.length) {
    let currentY = layout.rowTop;
    let endRow = startRow;

    while (
      endRow < rowHeights.length &&
      currentY + rowHeights[endRow] <= pageBottom
    ) {
      currentY += rowHeights[endRow];
      endRow += 1;
    }

    if (endRow === startRow) {
      endRow = Math.min(startRow + 1, rowHeights.length);
    }

    breaks.push({ startRow, endRow });
    startRow = endRow;
  }

  return breaks;
}

function drawTablePage(
  doc: PDFKit.PDFDocument,
  columns: ColumnData[],
  layout: TableLayout,
  rowHeights: number[],
  startRow: number,
  endRow: number,
  footerHeight: number
) {
  if (DEBUG_PAGE_CUTOFF) {
    doc.save();
    doc.strokeColor("#ff4d4f").lineWidth(0.6);
    doc.rect(0, doc.page.height - footerHeight, doc.page.width, footerHeight).stroke();
    doc.restore();
  }

  const headerBoxTop = layout.headerY - HEADER_BOX_TOP_OFFSET;
  const headerBoxHeight =
    layout.maxHeaderLines * layout.headerLineHeight + HEADER_BOX_TOP_OFFSET;
  const topLineY =
    layout.headerY + layout.maxHeaderLines * layout.headerLineHeight + TABLE_TOP_LINE_GAP;
  const rowContentOffset = layout.rowTop - topLineY;

  // Header background intentionally left transparent.

  doc.save();
  doc.strokeColor(GRID_VERTICAL_COLOR).lineWidth(GRID_VERTICAL_WIDTH);
  doc
    .moveTo(layout.tableLeft, headerBoxTop)
    .lineTo(layout.tableRight, headerBoxTop)
    .stroke();
  doc.restore();

  columns.forEach((column, index) => {
    const headerLines = [column.header, column.header2]
      .map((line) => line.trim())
      .filter(Boolean);
    if (headerLines.length === 0) {
      headerLines.push("");
    }
    headerLines.forEach((line, lineIndex) => {
      const headerText = line.toUpperCase();
      doc.font(FONT_BODY).fontSize(lineIndex === 0 ? HEADER_PRIMARY_SIZE : HEADER_SECONDARY_SIZE);
      const headerWidth = doc.widthOfString(headerText);
      const headerX =
        layout.columnXs[index] + (layout.columnWidth - headerWidth) / 2;
      const lineY = layout.headerY + lineIndex * layout.headerLineHeight;
      if (lineIndex === 1) {
        doc.fillColor(HEADER_SECONDARY_COLOR);
      } else {
        doc.fillColor("#000000");
      }
      doc.text(headerText, headerX, lineY, { lineBreak: false });
    });
  });
  doc.fillColor("#000000");

  drawWatermark(doc);

  let rowY = layout.rowTop;
  for (let i = startRow; i < endRow; i += 1) {
    const cellHeight = rowHeights[i];

    const shadeCell = (colIndex: number, rowIndex: number) => {
      if (layout.columnCount === 2) {
        return rowIndex % 2 === 0 ? colIndex === 1 : colIndex === 0;
      }
      return (colIndex % 2 === 0 && rowIndex % 2 === 1) ||
        (colIndex % 2 === 1 && rowIndex % 2 === 0);
    };

    doc.save();
    doc.fillColor(ROW_TINT_COLOR);
    doc.opacity(ROW_TINT_OPACITY);
    columns.forEach((_, colIndex) => {
      if (shadeCell(colIndex, i)) {
        doc
          .rect(
            layout.columnXs[colIndex],
            rowY - rowContentOffset,
            layout.columnWidth,
            cellHeight
          )
          .fill();
      }
    });
    doc.restore();

    const badgeLines = ["S", "T", "E", "P", "", `${i + 1}`];
    const badgeLineHeight = STEP_BADGE_TEXT_SIZE + 1;
    const badgeHeight =
      badgeLines.length * badgeLineHeight + STEP_BADGE_PADDING_Y * 2;
    const badgeRight = layout.tableLeft - 4;
    const badgeLeft = badgeRight - STEP_BADGE_HEIGHT;
    const badgeTop = rowY + (cellHeight - badgeHeight) / 2 - 10;
    doc.save();
    doc.fillColor(STEP_BADGE_COLOR);
    doc
      .roundedRect(badgeLeft, badgeTop, STEP_BADGE_HEIGHT, badgeHeight, STEP_BADGE_RADIUS)
      .fill();
    doc.fillColor("#ffffff");
    doc.font(FONT_BODY_BOLD).fontSize(STEP_BADGE_TEXT_SIZE);
    let textY = badgeTop + STEP_BADGE_PADDING_Y + 1;
    badgeLines.forEach((line) => {
      if (line) {
        const textWidth = doc.widthOfString(line);
        const textX = badgeLeft + (STEP_BADGE_HEIGHT - textWidth) / 2;
        doc.text(line, textX, textY, { lineBreak: false });
      }
      textY += badgeLineHeight;
    });
    doc.restore();

    columns.forEach((column, colIndex) => {
      const step = column.steps[i] ?? { product: "", directions: "" };
      const contentLines = drawProductBlock({
        doc,
        x: layout.columnXs[colIndex] + layout.textOffsetX,
        y: 0,
        product: step.product ?? "",
        directions: step.directions ?? "",
        maxWidth: layout.wrapWidth,
        fontSize: layout.fontSize,
        lineHeight: layout.lineHeight,
        dryRun: true
      });
      const contentHeight = contentLines * layout.lineHeight;
      const rowTopLineY = topLineY + (rowY - layout.rowTop);
      const contentStart =
        rowTopLineY + (cellHeight - contentHeight) / 2 + CELL_CENTER_OFFSET;
      drawProductBlock({
        doc,
        x: layout.columnXs[colIndex] + layout.textOffsetX,
        y: contentStart,
        product: step.product ?? "",
        directions: step.directions ?? "",
        maxWidth: layout.wrapWidth,
        fontSize: layout.fontSize,
        lineHeight: layout.lineHeight,
        dryRun: false
      });
    });

    rowY += cellHeight;
  }

  const tableBottom =
    topLineY +
    rowHeights
      .slice(startRow, endRow)
      .reduce((sum, height) => sum + height, 0);

  // Vertical lines
  doc.save();
  doc.strokeColor(GRID_VERTICAL_COLOR).lineWidth(GRID_VERTICAL_WIDTH);
  for (let i = 0; i <= layout.columnCount; i += 1) {
    const lineX =
      i === 0
        ? layout.tableLeft
        : i === layout.columnCount
        ? layout.tableRight
        : layout.columnXs[i];
    doc.moveTo(lineX, headerBoxTop).lineTo(lineX, tableBottom).stroke();
  }
  doc.restore();

  // Horizontal lines
  let lineY = topLineY;
  doc.save();
  doc.strokeColor(GRID_VERTICAL_COLOR).lineWidth(GRID_VERTICAL_WIDTH);
  doc
    .moveTo(layout.tableLeft, lineY)
    .lineTo(layout.tableRight, lineY)
    .stroke();
  doc.restore();

  doc.save();
  doc.strokeColor(GRID_HORIZONTAL_COLOR).lineWidth(GRID_HORIZONTAL_WIDTH);
  rowHeights.slice(startRow, endRow).forEach((height) => {
    lineY += height;
    doc
      .moveTo(layout.tableLeft, lineY)
      .lineTo(layout.tableRight, lineY)
      .stroke();
  });
  doc.restore();

  return;
}

export async function generatePrescriptionPdf(args: GenerateArgs) {
  const { clientId, clientName, steps, outputPath } = args;
  const columns = extractColumns(steps);
  const columnCount = columns.length;

  if (columnCount < 2 || columnCount > 4) {
    throw new Error("Unsupported column count");
  }

  const startDate = steps.start_date || "";
  const safeDate = startDate.replace(/\//g, "-");
  const formTypeLabel = `${columnCount}-column`;
  const formTypeSlug = `${columnCount}-col`;

  const paths = loadSkinproPaths();
  const safeName = safeClientName(clientName);
  const clientDir = path.join(paths.prescriptionsDir, `${safeName}_${clientId}`);
  const defaultDir = outputPath ? path.dirname(outputPath) : clientDir;
  ensureDir(defaultDir);

  const baseName = `${safeDate}_${formTypeSlug}`;
  const filePath = outputPath ?? uniqueFilePath(clientDir, baseName, ".pdf");

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 0 });
    const stream = fs.createWriteStream(filePath);

    stream.on("finish", () => resolve());
    stream.on("error", (err) => reject(err));

    doc.pipe(stream);

    let header = drawHeader(doc, { clientName, startDate });
  const firstLayout = getTableLayout(doc, columns, header.dividerY + HEADER_TABLE_GAP);
  const rowHeights = measureRowHeights(doc, columns, firstLayout);
  const pageBreaks = getPageBreaks(
    rowHeights,
    firstLayout,
    doc.page.height,
    FOOTER_HEIGHT
  );

  pageBreaks.forEach((page, index) => {
    if (index > 0) {
      doc.addPage({ size: "LETTER", margin: 0 });
      header = drawHeader(doc, { clientName, startDate });
    }
    const layout = getTableLayout(doc, columns, header.dividerY + HEADER_TABLE_GAP);
    drawTablePage(
      doc,
      columns,
      layout,
      rowHeights,
      page.startRow,
      page.endRow,
      FOOTER_HEIGHT
    );
  });

    doc.end();
  });

  return {
    filePath,
    formType: formTypeLabel,
    startDate
  };
}
