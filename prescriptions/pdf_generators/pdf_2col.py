from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

class Pdf2ColGenerator:
    def __init__(self, output_dir="prescriptions"):
        self.output_dir = os.path.join(os.getcwd(), output_dir)
        os.makedirs(self.output_dir, exist_ok=True)

    def generate(self, client_name, start_date, steps_dict):
        file_path = os.path.join(self.output_dir, f"{client_name.replace(' ', '_')}_2col.pdf")
        c = canvas.Canvas(file_path, pagesize=letter)
        width, height = letter

        # === Margins & Layout Constants ===
        left_margin = 20
        right_margin = 20
        top_margin = 730
        col_spacing = 20

        # === Logo ===
        logo_path = "icons/corium_logo.webp"
        logo_width, logo_height = 142, 110
        c.drawImage(logo_path, 20, top_margin - logo_height + 50, width=logo_width, height=logo_height, mask='auto')

        # === Title Block (Top Right-Aligned) ===
        c.setFont("Helvetica-Bold", 26)
        title_1 = "CORIUM CORRECTIVE 360°"
        title_2 = "SKIN CARE SCRIPT"
        max_title_width = max(
            c.stringWidth(title_1, "Helvetica-Bold", 26),
            c.stringWidth(title_2, "Helvetica-Bold", 26)
        )
        title_x = width - right_margin - max_title_width
        c.drawString(title_x - 50, top_margin, title_1)
        c.drawString(title_x, top_margin - 35, title_2)

        # === Header Box Lines ===
        header_top_y = top_margin - 65
        header_bottom_y = top_margin - 145
        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(0.5)
        c.line(0, header_top_y, width, header_top_y)
        c.line(0, header_bottom_y, width, header_bottom_y)

        # === Header Text Start Y ===
        line_spacing = 23
        header_text_y = header_top_y - 25  # First line padding from top line

        # === Transforming Line (Mixed Weight) ===
        x = left_margin
        c.setFont("Helvetica", 10)
        text1 = "TRANSFORMING "
        c.drawString(x, header_text_y, text1)
        x += c.stringWidth(text1, "Helvetica", 10)

        c.setFont("Helvetica-Bold", 10)
        client_text = client_name.upper()
        c.drawString(x, header_text_y, client_text)
        x += c.stringWidth(client_text, "Helvetica-Bold", 10)

        c.setFont("Helvetica", 10)
        text2 = " SKIN TO A BETTER DEGREE OF HEALTH."
        c.drawString(x, header_text_y, text2)

        # === Start Date Line ===
        x = left_margin
        y2 = header_text_y - line_spacing
        label = "START TREATMENT DATE: "
        c.setFont("Helvetica", 10)
        c.drawString(x, y2, label)
        x += c.stringWidth(label, "Helvetica", 10)

        c.setFont("Helvetica-Bold", 10)
        c.drawString(x, y2, start_date)

        # === Disclaimer Line (same spacing)
        y3 = y2 - line_spacing
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(left_margin, y3, "*CORIUM CORRECTIVE 360° CANNOT BE COMBINED WITH ANY OTHER SKIN CARE PRODUCTS")

        # === Section Title + Underline ===
        section_text = "SKIN CARE ROUTINE & PRODUCTS"
        y = top_margin - 170
        c.setFont("Helvetica-Bold", 16)
        text_width = c.stringWidth(section_text, "Helvetica-Bold", 16)

        center_x = (width - text_width) / 2

        c.drawString(center_x, y, section_text)

        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(1)
        c.line(center_x, y - 2, center_x + text_width, y - 2)

        # === Column Setup ===
        c.setFont("Helvetica", 10)
        col_spacing = 20
        col_width = (width - 2 * left_margin - col_spacing) / 2
        wrap_width = col_width - 40
        col1_x = left_margin + 60
        col2_x = left_margin + 40 + col_width

        # === Column Headers ===
        header_y = top_margin - 190
        col1_header = steps_dict.get("Col1_Header", "Column 1")
        col2_header = steps_dict.get("Col2_Header", "Column 2")
        c.drawString(col1_x + 90, header_y, col1_header.upper())
        c.drawString(col2_x + 90, header_y, col2_header.upper())

        # === Word Wrapping Helper ===
        def draw_product_block(c, x, y, product, directions, max_width, font_size=10, line_height=12, dry_run=False):
            # Measure product name
            c.setFont("Helvetica", font_size)
            product_text = f"{product}:"
            product_width = c.stringWidth(product_text, "Helvetica", font_size)

            # Split directions into wrapped lines
            c.setFont("Helvetica", font_size)
            lines = []
            for raw_line in directions.split("\n"):
                words = raw_line.split()
                line = ""
                for word in words:
                    trial = f"{line} {word}".strip()
                    if c.stringWidth(trial, "Helvetica", font_size) <= max_width:
                        line = trial
                    else:
                        lines.append(line)
                        line = word
                if line:
                    lines.append(line)

            if not dry_run:
                # Draw product name (bold + underlined)
                c.setFont("Helvetica", font_size)
                c.drawString(x, y, product_text)
                c.setLineWidth(0.6)
                c.line(x, y - 2, x + product_width, y - 2)

                # Draw wrapped directions
                c.setFont("Helvetica", font_size)
                for idx, line in enumerate(lines):
                    c.drawString(x, y - ((idx + 1) * line_height), line)

            return 1 + len(lines)  # 1 line for product + direction lines
        
        # === Table Rows with Wrapped Content ===
        c.setFont("Helvetica", 10)
        row_spacing = 22
        table_top = header_y - 15
        col1_data = steps_dict.get("Col1", [])
        col2_data = steps_dict.get("Col2", [])
        max_steps = max(len(col1_data), len(col2_data))

        # Store where table starts and ends for vertical lines
        row_height = 12
        min_lines = 4  # minimum lines per cell
        table_start_y = table_top
        current_y = table_top

        # Store row heights to determine where table ends
        row_heights = []

        for i in range(max_steps):
            col1 = col1_data[i] if i < len(col1_data) else {"product": "", "directions": ""}
            col2 = col2_data[i] if i < len(col2_data) else {"product": "", "directions": ""}

            # Measure vertical space needed
            lines_1 = draw_product_block(c, col1_x, current_y, col1["product"], col1["directions"], max_width=wrap_width, dry_run=True)
            lines_2 = draw_product_block(c, col2_x, current_y, col2["product"], col2["directions"], max_width=wrap_width, dry_run=True)
            cell_height = max(max(lines_1, lines_2), min_lines) * row_height + 5
            row_heights.append(cell_height)

        total_table_height = sum(row_heights)

        # === Watermark Behind Table ===
        watermark_path = "icons/corium_logo.webp"
        aspect_ratio = 1200 / 930
        watermark_width = 500
        watermark_height = watermark_width / aspect_ratio

        watermark_x = (width - watermark_width) / 2
        watermark_y = table_top - (total_table_height / 2) - watermark_height / 2

        c.saveState()
        c.setFillAlpha(0.15)
        c.drawImage(watermark_path, watermark_x, watermark_y, width=watermark_width, height=watermark_height, mask='auto')
        c.restoreState()

        for i in range(max_steps):
            col1 = col1_data[i] if i < len(col1_data) else {"product": "", "directions": ""}
            col2 = col2_data[i] if i < len(col2_data) else {"product": "", "directions": ""}
            cell_height = row_heights[i]

            # Purple color == #8555ba
            # 🟪 Checkerboard shading
            if i % 2 == 0:
                c.saveState()
                c.setFillAlpha(0.6)
                c.setFillColorRGB(133 / 255, 85 / 255, 186 / 255)
                c.rect(col2_x - 10, current_y - cell_height + 10, col_width - 20, cell_height, fill=True, stroke=0)
                c.restoreState()
            else:
                c.saveState()
                c.setFillAlpha(0.6)
                c.setFillColorRGB(133 / 255, 85 / 255, 186 / 255)
                c.rect(col1_x - 10, current_y - cell_height + 10, col_width - 20, cell_height, fill=True, stroke=0)
                c.restoreState()

            # 🟨 STEP label
            c.setFont("Helvetica", 10)
            c.drawString(left_margin, current_y, f"STEP {i + 1}")

            # 📝 Draw wrapped text on top of background
            draw_product_block(c, col1_x, current_y, col1["product"], col1["directions"], max_width=wrap_width)
            draw_product_block(c, col2_x, current_y, col2["product"], col2["directions"], max_width=wrap_width)


            current_y -= cell_height

        # 🟥 Grid lines (draw once across full table)
        c.setLineWidth(0.2)
        c.setStrokeColorRGB(0, 0, 0)  # subtle purple

        # Vertical lines
        center_line_x = col1_x + wrap_width + 10  # right edge of Column 1
        c.line(left_margin + 50, table_start_y + 25, left_margin + 50, current_y + 10)
        c.line(center_line_x, table_start_y + 25, center_line_x, current_y + 10)

        # Horizontal lines
        line_y = table_start_y
        for height in row_heights[:-1]:  # skip last to avoid bottom edge
            line_y -= height
            c.line(col1_x - 65, line_y + 10, col2_x + wrap_width + 10, line_y + 10)
        c.line(col1_x - 65, table_start_y + 10, col2_x + wrap_width + 10, table_start_y + 10)

        # Footer
        c.setFont("Helvetica", 10)

        footer_text = "©2020 CORIUM CORRECTIVE 360° - ALL RIGHTS RESERVED"
        text_width = c.stringWidth(footer_text, "Helvetica", 10)
        center_x = (width - text_width) / 2
        c.drawString(center_x, 15, footer_text)

        c.save()
        print(f"✅ 2-column prescription saved to: {file_path}")

        return file_path
