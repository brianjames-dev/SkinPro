import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const outputDir = path.join(__dirname, "out");
fs.mkdirSync(outputDir, { recursive: true });

const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(outputDir, "prescription_2col.pdf");

const sampleData = {
  clientName: "Jamie Skinner",
  startDate: "06/01/2024",
  col1Header: "AM",
  col2Header: "PM",
  col1: [
    {
      product: "Cleanser",
      directions:
        "Use [[highlight]]1 pump[[/highlight]] and rinse with lukewarm water."
    },
    {
      product: "Toner",
      directions:
        "Apply with cotton pad.\nAvoid the eye area."
    },
    {
      product: "Serum",
      directions:
        "Apply [[highlight]]2-3 drops[[/highlight]] to face and neck."
    }
  ],
  col2: [
    {
      product: "Cleanser",
      directions:
        "Massage for [[highlight]]60 seconds[[/highlight]] and rinse well."
    },
    {
      product: "Moisturizer",
      directions:
        "Apply a thin layer before bed."
    }
  ]
};

function tokenizeHighlight(text) {
  const tokens = text.split(/(\[\[highlight\]\]|\[\[\/highlight\]\])/);
  const segments = [];
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

function wrapHighlightedText(doc, text, maxWidth, fontSize) {
  doc.font("Helvetica").fontSize(fontSize);
  const segments = tokenizeHighlight(text);
  const lines = [];
  let currentLine = [];
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

function drawProductBlock({
  doc,
  x,
  y,
  product,
  directions,
  maxWidth,
  fontSize,
  lineHeight,
  dryRun
}) {
  let lineOffset = 0;

  if (product.trim()) {
    if (!dryRun) {
      doc.font("Helvetica-Bold").fontSize(fontSize);
      doc.text(`${product}:`, x, y, { lineBreak: false });
      const labelWidth = doc.widthOfString(`${product}:`);
      doc
        .moveTo(x, y + fontSize + 2)
        .lineTo(x + labelWidth, y + fontSize + 2)
        .stroke();
    }
    lineOffset += 1;
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

const doc = new PDFDocument({ size: "LETTER", margin: 0 });
const stream = fs.createWriteStream(outputPath);

doc.pipe(stream);

const pageWidth = doc.page.width;
const leftMargin = 24;
const rightMargin = 24;
const columnGap = 28;
const headerTop = 24;
const columnWidth = (pageWidth - leftMargin - rightMargin - columnGap) / 2;
const col1X = leftMargin;
const col2X = leftMargin + columnWidth + columnGap;

const logoPath = path.join(repoRoot, "icons", "corium_logo.png");
if (fs.existsSync(logoPath)) {
  doc.image(logoPath, leftMargin, headerTop, { width: 72 });
}

const titleX = leftMargin + 90;
const titleY = headerTop + 6;

// Title and header info

doc.font("Helvetica-Bold").fontSize(18);
doc.text("DAILY SKINCARE ROUTINE", titleX, titleY);

doc.font("Helvetica").fontSize(10);
doc.text("NAME:", titleX, titleY + 26, { lineBreak: false });

doc.font("Helvetica-Bold").fontSize(10);
doc.text(sampleData.clientName, titleX + 40, titleY + 26, {
  lineBreak: false
});

doc.font("Helvetica").fontSize(10);
doc.text("START DATE:", titleX + 240, titleY + 26, { lineBreak: false });

doc.font("Helvetica-Bold").fontSize(10);
doc.text(sampleData.startDate, titleX + 320, titleY + 26);

doc.font("Helvetica-Oblique").fontSize(9);
doc.text(
  "*CORIUM CORRECTIVE 360 CANNOT BE COMBINED WITH ANY OTHER SKIN CARE PRODUCTS",
  titleX,
  titleY + 44
);

doc
  .moveTo(0, headerTop + 80)
  .lineTo(pageWidth, headerTop + 80)
  .stroke();

// Column headers

const tableTop = headerTop + 100;

doc.font("Helvetica-Bold").fontSize(11);
doc.text(sampleData.col1Header, col1X + columnWidth / 2 - 10, tableTop);
doc.text(sampleData.col2Header, col2X + columnWidth / 2 - 10, tableTop);

const rowTop = tableTop + 22;
const fontSize = 10;
const lineHeight = 14;

const maxSteps = Math.max(sampleData.col1.length, sampleData.col2.length);
const rowHeights = [];
let currentY = rowTop;

for (let i = 0; i < maxSteps; i += 1) {
  const col1 = sampleData.col1[i] ?? { product: "", directions: "" };
  const col2 = sampleData.col2[i] ?? { product: "", directions: "" };

  const lines1 = drawProductBlock({
    doc,
    x: col1X,
    y: currentY,
    product: col1.product,
    directions: col1.directions,
    maxWidth: columnWidth - 16,
    fontSize,
    lineHeight,
    dryRun: true
  });

  const lines2 = drawProductBlock({
    doc,
    x: col2X,
    y: currentY,
    product: col2.product,
    directions: col2.directions,
    maxWidth: columnWidth - 16,
    fontSize,
    lineHeight,
    dryRun: true
  });

  const height = Math.max(lines1, lines2, 3) * lineHeight + 10;
  rowHeights.push(height);
  currentY += height;
}

currentY = rowTop;

for (let i = 0; i < maxSteps; i += 1) {
  const col1 = sampleData.col1[i] ?? { product: "", directions: "" };
  const col2 = sampleData.col2[i] ?? { product: "", directions: "" };
  const height = rowHeights[i];

  doc.save();
  doc.fillColor(i % 2 === 0 ? "#e6d8f3" : "#f4e9fb");
  doc.rect(col1X, currentY, columnWidth, height).fill();
  doc.rect(col2X, currentY, columnWidth, height).fill();
  doc.restore();

  doc.font("Helvetica").fontSize(9);
  doc.fillColor("#1b1b1b");
  doc.text(`STEP ${i + 1}`, leftMargin - 2, currentY + 6);

  drawProductBlock({
    doc,
    x: col1X + 8,
    y: currentY + 6,
    product: col1.product,
    directions: col1.directions,
    maxWidth: columnWidth - 16,
    fontSize,
    lineHeight,
    dryRun: false
  });

  drawProductBlock({
    doc,
    x: col2X + 8,
    y: currentY + 6,
    product: col2.product,
    directions: col2.directions,
    maxWidth: columnWidth - 16,
    fontSize,
    lineHeight,
    dryRun: false
  });

  currentY += height;
}

doc.font("Helvetica").fontSize(9);
doc.fillColor("#1b1b1b");
doc.text(
  "2020 CORIUM CORRECTIVE 360 - ALL RIGHTS RESERVED",
  leftMargin,
  doc.page.height - 30
);

doc.end();

stream.on("finish", () => {
  console.log(`PDF written to ${outputPath}`);
});
