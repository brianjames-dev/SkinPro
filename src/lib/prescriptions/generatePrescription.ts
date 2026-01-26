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
const FOOTER_HEIGHT = 40;

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

function wrapHighlightedText(
  doc: PDFKit.PDFDocument,
  text: string,
  maxWidth: number,
  fontSize: number
) {
  doc.font("Helvetica").fontSize(fontSize);
  const segments = tokenizeHighlight(text);
  const lines: { text: string; highlight: boolean }[][] = [];
  let currentLine: { text: string; highlight: boolean }[] = [];
  let currentWidth = 0;

  const pushLine = () => {
    if (currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
    }
  };

  for (const segment of segments) {
    const parts = segment.text.split("\n");

    parts.forEach((part, index) => {
      if (part) {
        const words = part.split(/(\s+)/).filter(Boolean);
        for (const word of words) {
          const width = doc.widthOfString(word);
          if (currentWidth + width > maxWidth && currentLine.length > 0) {
            pushLine();
          }
          currentLine.push({ text: word, highlight: segment.highlight });
          currentWidth += width;
        }
      }

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
  fontSize: number
) {
  doc.font("Helvetica-Bold").fontSize(fontSize);
  const lines: string[] = [];
  let currentLine = "";
  let currentWidth = 0;

  const pushLine = () => {
    if (currentLine.trim()) {
      lines.push(currentLine.trimEnd());
    }
    currentLine = "";
    currentWidth = 0;
  };

  const parts = text.split("\n");
  parts.forEach((part, index) => {
    const words = part.split(/(\s+)/).filter(Boolean);
    for (const word of words) {
      const width = doc.widthOfString(word);
      if (currentWidth + width > maxWidth && currentLine) {
        pushLine();
      }
      currentLine += word;
      currentWidth += width;
    }
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
    const productLines = wrapPlainText(doc, productText, maxWidth, fontSize).slice(
      0,
      2
    );
    productLines.forEach((line, index) => {
      const lineY = y + lineOffset * lineHeight;
      const isLastLine = index === productLines.length - 1;
      if (!dryRun) {
        doc.font("Helvetica-Bold").fontSize(fontSize);
        const labelText = line.trim();
        const renderedText = isLastLine ? `${labelText}:` : labelText;
        doc.text(renderedText, x, lineY, { lineBreak: false });
        const labelWidth = doc.widthOfString(renderedText);
        doc
          .moveTo(x, lineY + fontSize)
          .lineTo(x + labelWidth, lineY + fontSize)
          .stroke();
      }
      lineOffset += 1;
    });
  }

  const lines = wrapHighlightedText(doc, directions, maxWidth, fontSize);

  if (!dryRun) {
    doc.font("Helvetica").fontSize(fontSize);
    lines.forEach((line, index) => {
      const lineY = y + (lineOffset + index) * lineHeight;
      let cursorX = x;

      line.forEach((segment) => {
        const width = doc.widthOfString(segment.text);
        if (segment.highlight) {
          doc.save();
          doc.fillColor("#fff3a8");
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
  const logoWidth = 85;
  const logoHeight = 66;
  const logoX = pageWidth - leftMargin - logoWidth;
  const logoY = headerTop + logoOffsetY;

  const logoPath = resolveLogoPath();
  if (logoPath) {
    doc.image(logoPath, logoX, logoY, { width: logoWidth, height: logoHeight });
  }

  const textLeftX = leftMargin + 20;
  const titleY = headerTop + 8;
  const infoY = titleY + 24;
  const disclaimerY = infoY + 18;
  const dividerY = headerTop + logoHeight + 10;

  doc.font("Helvetica-Bold").fontSize(20);
  doc.text(DEFAULT_TITLE, textLeftX, titleY, { lineBreak: false });

  doc.font("Helvetica").fontSize(10);
  doc.text("NAME:", textLeftX, infoY, { lineBreak: false });

  const nameX = textLeftX + doc.widthOfString("NAME: ");
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text(clientName, nameX, infoY, { lineBreak: false });

  const dateLabel = "START DATE: ";
  const dateX = nameX + doc.widthOfString(clientName) + 80;
  doc.font("Helvetica").fontSize(10);
  doc.text(dateLabel, dateX, infoY, { lineBreak: false });

  doc.font("Helvetica-Bold").fontSize(10);
  doc.text(startDate, dateX + doc.widthOfString(dateLabel), infoY, {
    lineBreak: false
  });

  doc.font("Helvetica-Oblique").fontSize(9);
  doc.text(DISCLAIMER, textLeftX, disclaimerY, { lineBreak: false });

  doc.lineWidth(0.4);
  doc.moveTo(0, dividerY).lineTo(pageWidth, dividerY).stroke();

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
  const leftMargin = 24;
  const rightMargin = 24;
  const stepLabelWidth = 56;
  const tableLeft = leftMargin + stepLabelWidth;
  const columnCount = columns.length;
  const columnGap = 0;
  const tableWidth = pageWidth - tableLeft - rightMargin;
  const columnWidth = (tableWidth - columnGap * (columnCount - 1)) / columnCount;

  const columnXs = Array.from({ length: columnCount }, (_, index) => {
    return tableLeft + index * (columnWidth + columnGap);
  });

  const headerY = tableTop;
  const headerLineHeight = 12;
  const headerLinesPerColumn = columns.map((column) =>
    [column.header, column.header2].filter((line) => line.trim()).length || 1
  );
  const maxHeaderLines = Math.max(...headerLinesPerColumn, 1);

  const rowTop = headerY + maxHeaderLines * headerLineHeight + 10;
  const fontSize = 10;
  const lineHeight = 14;
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
      Math.max(Math.max(...heights, 3), 3) * layout.lineHeight + 10;
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

function drawPageNumber(
  doc: PDFKit.PDFDocument,
  pageIndex: number,
  totalPages: number,
  footerHeight: number
) {
  const label = `Page ${pageIndex} / ${totalPages}`;
  const fontSize = 9;
  const padding = 10;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const textWidth = doc.widthOfString(label);
  const rightMargin = 24;
  const x = pageWidth - rightMargin - textWidth;
  const y = pageHeight - footerHeight + (footerHeight - fontSize) / 2;

  doc.font("Helvetica").fontSize(fontSize).fillColor("#2e2a22");
  doc.text(label, x, y, { lineBreak: false });
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
    doc.fillColor("#ff4d4f");
    doc.opacity(0.08);
    doc.rect(0, doc.page.height - footerHeight, doc.page.width, footerHeight).fill();
    doc.restore();
  }

  doc.font("Helvetica").fontSize(10);
  columns.forEach((column, index) => {
    const headerLines = [column.header, column.header2]
      .map((line) => line.trim())
      .filter(Boolean);
    if (headerLines.length === 0) {
      headerLines.push("");
    }
    headerLines.forEach((line, lineIndex) => {
      const headerText = line.toUpperCase();
      const headerWidth = doc.widthOfString(headerText);
      const headerX =
        layout.columnXs[index] + (layout.columnWidth - headerWidth) / 2;
      const lineY = layout.headerY + lineIndex * layout.headerLineHeight;
      doc.text(headerText, headerX, lineY, { lineBreak: false });
    });
  });

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
    doc.fillColor("#e6d8f3");
    doc.opacity(0.4);
    columns.forEach((_, colIndex) => {
      if (shadeCell(colIndex, i)) {
        doc
          .rect(layout.columnXs[colIndex], rowY - 10, layout.columnWidth, cellHeight)
          .fill();
      }
    });
    doc.restore();

    doc.font("Helvetica").fontSize(9).fillColor("#1b1b1b");
    doc.text(`STEP ${i + 1}`, layout.leftMargin, rowY - 4, {
      width: layout.stepLabelWidth - 8,
      align: "right",
      lineBreak: false
    });

    columns.forEach((column, colIndex) => {
      const step = column.steps[i] ?? { product: "", directions: "" };
      drawProductBlock({
        doc,
        x: layout.columnXs[colIndex] + layout.textOffsetX,
        y: rowY + layout.textOffsetY,
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

  doc.save();
  doc.strokeColor("#2e2a22").lineWidth(0.4);

  const tableBottom =
    layout.rowTop -
    10 +
    rowHeights
      .slice(startRow, endRow)
      .reduce((sum, height) => sum + height, 0);

  // Vertical lines
  for (let i = 0; i <= layout.columnCount; i += 1) {
    const lineX =
      i === 0
        ? layout.tableLeft
        : i === layout.columnCount
        ? layout.tableRight
        : layout.columnXs[i];
    doc.moveTo(lineX, layout.rowTop - 10).lineTo(lineX, tableBottom).stroke();
  }

  // Horizontal lines
  let lineY = layout.rowTop - 10;
  doc
    .moveTo(layout.leftMargin, lineY)
    .lineTo(layout.tableRight, lineY)
    .stroke();

  rowHeights.slice(startRow, endRow).forEach((height) => {
    lineY += height;
    doc
      .moveTo(layout.leftMargin, lineY)
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
  const firstLayout = getTableLayout(doc, columns, header.dividerY + 20);
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
    const layout = getTableLayout(doc, columns, header.dividerY + 20);
    drawTablePage(
      doc,
      columns,
      layout,
      rowHeights,
      page.startRow,
      page.endRow,
      FOOTER_HEIGHT
    );
    drawPageNumber(doc, index + 1, pageBreaks.length, FOOTER_HEIGHT);
  });

    doc.end();
  });

  return {
    filePath,
    formType: formTypeLabel,
    startDate
  };
}
