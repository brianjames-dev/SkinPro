from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from utils.path_utils import resource_path
import os
import re

class Pdf4ColGenerator:
    def __init__(self, data_manager):
        self.data_manager = data_manager

        self.output_dir = self.data_manager.get_path("prescriptions")
        os.makedirs(self.output_dir, exist_ok=True)


    def generate(self, client_id, client_name, start_date, steps_dict):
        # === Build subfolder path based on client and form type ===
        form_type = "4-col"
        safe_client_name = client_name.replace(" ", "_")
        folder_name = f"{safe_client_name}_{client_id}"
        client_dir = os.path.join(self.output_dir, folder_name)
        os.makedirs(client_dir, exist_ok=True)

        # === Generate PDF file path ===
        safe_date = start_date.replace("/", "-")  # or "_" if you prefer
        filename = f"{safe_date}_{form_type}.pdf"
        file_path = os.path.join(client_dir, filename)
        
        # === Create PDF canvas ===
        c = canvas.Canvas(file_path, pagesize=letter)
        width, height = letter

        # === Layout ===
        left_margin = 20
        top_margin = 730

        # === Logo ===
        logo_path = resource_path("icons/corium_logo.webp")
        c.drawImage(logo_path, 20, top_margin - 60, width=142, height=110, mask='auto')

        # === Title ===
        c.setFont("Helvetica-Bold", 26)
        title_1 = "CORIUM CORRECTIVE 360°"
        title_2 = "SKIN CARE SCRIPT"
        max_title_width = max(c.stringWidth(title_1, "Helvetica-Bold", 26), c.stringWidth(title_2, "Helvetica-Bold", 26))
        title_x = width - 20 - max_title_width
        c.drawString(title_x - 50, top_margin, title_1)
        c.drawString(title_x, top_margin - 35, title_2)

        # === Header Box Lines ===
        header_top_y = top_margin - 65
        header_bottom_y = top_margin - 145
        c.setLineWidth(0.5)
        c.line(0, header_top_y, width, header_top_y)
        c.line(0, header_bottom_y, width, header_bottom_y)

        # === Header Text ===
        line_spacing = 23
        header_text_y = header_top_y - 25
        c.setFont("Helvetica", 10)
        x = left_margin
        c.drawString(x, header_text_y, "TRANSFORMING ")
        x += c.stringWidth("TRANSFORMING ", "Helvetica", 10)
        c.setFont("Helvetica-Bold", 10)
        client_text = client_name.upper()
        c.drawString(x, header_text_y, client_text)
        x += c.stringWidth(client_text, "Helvetica-Bold", 10)
        c.setFont("Helvetica", 10)
        c.drawString(x, header_text_y, " SKIN TO A BETTER DEGREE OF HEALTH.")

        # === Start Date ===
        y2 = header_text_y - line_spacing
        c.drawString(left_margin, y2, "START TREATMENT DATE: ")
        c.setFont("Helvetica-Bold", 10)
        c.drawString(left_margin + c.stringWidth("START TREATMENT DATE: ", "Helvetica", 10), y2, start_date)

        # === Disclaimer ===
        y3 = y2 - line_spacing
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(left_margin, y3, "*CORIUM CORRECTIVE 360° CANNOT BE COMBINED WITH ANY OTHER SKIN CARE PRODUCTS")

        # === Section Title ===
        section_text = "SKIN CARE ROUTINE & PRODUCTS"
        y = top_margin - 170
        c.setFont("Helvetica-Bold", 16)
        text_width = c.stringWidth(section_text, "Helvetica-Bold", 16)
        center_x = (width - text_width) / 2
        c.drawString(center_x, y, section_text)
        c.setLineWidth(1)
        c.line(center_x, y - 2, center_x + text_width, y - 2)

        # === Columns ===
        c.setFont("Helvetica", 10)
        col_width = (width - 2 * left_margin + 30) / 4
        wrap_width = col_width - 40
        col1_x = left_margin + 60
        col2_x = col1_x + col_width - 20
        col3_x = col2_x + col_width - 20
        col4_x = col3_x + col_width - 20

        header_y = top_margin - 190

        # Get headers
        col1_header = steps_dict.get("Col1_Header", "Column 1").upper()
        col2_header = steps_dict.get("Col2_Header", "Column 2").upper()
        col3_header = steps_dict.get("Col3_Header", "Column 3").upper()
        col4_header = steps_dict.get("Col4_Header", "Column 4").upper()

        # Measure text widths
        col1_header_width = c.stringWidth(col1_header, "Helvetica", 10)
        col2_header_width = c.stringWidth(col2_header, "Helvetica", 10)
        col3_header_width = c.stringWidth(col3_header, "Helvetica", 10)
        col4_header_width = c.stringWidth(col4_header, "Helvetica", 10)

        # Draw centered headers
        c.drawString(col1_x + (col_width - col1_header_width) / 2 - 20, header_y, col1_header)
        c.drawString(col2_x + (col_width - col2_header_width) / 2 - 20, header_y, col2_header)
        c.drawString(col3_x + (col_width - col3_header_width) / 2 - 20, header_y, col3_header)
        c.drawString(col4_x + (col_width - col4_header_width) / 2 - 20, header_y, col4_header)

        def draw_product_block(c, x, y, product, directions, max_width, font_size=10, line_height=12, dry_run=False):
            c.setFont("Helvetica", font_size)
            lines_above = 0
            chunks_per_line = []  # Each line will contain a list of (text, is_highlight)

            # === Step 1: Extract highlight chunks across whole string ===
            tokens = re.split(r"(\[\[highlight\]\]|\[\[/highlight\]\])", directions)
            is_highlight = False
            chunks = []

            for token in tokens:
                if token == "[[highlight]]":
                    is_highlight = True
                elif token == "[[/highlight]]":
                    is_highlight = False
                elif token:
                    chunks.append((token, is_highlight))

            # === Step 2: Wrap chunks into lines (respecting max width) ===
            current_line = ""
            current_chunks = []

            for text, hl in chunks:
                # Split each chunk by newline and re-add newlines as their own chunks
                parts = re.split(r"(\n)", text)
                for part in parts:
                    if part == "\n":
                        # Force a new line
                        if current_chunks:
                            chunks_per_line.append(current_chunks)
                            current_chunks = []
                            current_line = ""
                    elif part:
                        sub_parts = re.split(r"(\s+)", part)
                        for sub in sub_parts:
                            trial = current_line + sub
                            if c.stringWidth(trial.strip(), "Helvetica", font_size) <= max_width:
                                current_line += sub
                                current_chunks.append((sub, hl))
                            else:
                                if current_chunks:
                                    chunks_per_line.append(current_chunks)
                                current_line = sub
                                current_chunks = [(sub, hl)]

            if current_chunks:
                chunks_per_line.append(current_chunks)

            # === Step 3: Draw product title ===
            if not dry_run:
                if product.strip():
                    product_text = f"{product.strip()}:"
                    product_width = c.stringWidth(product_text, "Helvetica", font_size)
                    c.drawString(x, y, product_text)
                    c.setLineWidth(0.6)
                    c.line(x, y - 2, x + product_width, y - 2)
                    lines_above = 1

                for idx, chunk_line in enumerate(chunks_per_line):
                    line_y = y - ((idx + lines_above) * line_height)
                    draw_x = x

                    for text, hl in chunk_line:
                        if hl:
                            c.saveState()
                            c.setFillAlpha(0.6)
                            c.setFillColorRGB(1, 1, 0)
                            text_width = c.stringWidth(text, "Helvetica", font_size)
                            c.rect(draw_x - 1, line_y - 3, text_width + 1, line_height, fill=True, stroke=0)
                            c.restoreState()
                        c.drawString(draw_x, line_y, text)
                        draw_x += c.stringWidth(text, "Helvetica", font_size)

            return lines_above + len(chunks_per_line)

        # === Table Rows ===
        row_height = 12
        min_lines = 3
        table_top = header_y - 15
        current_y = table_top
        col1_data = steps_dict.get("Col1", [])
        col2_data = steps_dict.get("Col2", [])
        col3_data = steps_dict.get("Col3", [])
        col4_data = steps_dict.get("Col4", [])
        max_steps = max(len(col1_data), len(col2_data), len(col3_data), len(col4_data))
        row_heights = []

        for i in range(max_steps):
            col1 = col1_data[i] if i < len(col1_data) else {"product": "", "directions": ""}
            col2 = col2_data[i] if i < len(col2_data) else {"product": "", "directions": ""}
            col3 = col3_data[i] if i < len(col3_data) else {"product": "", "directions": ""}
            col4 = col4_data[i] if i < len(col4_data) else {"product": "", "directions": ""}
            h1 = draw_product_block(c, col1_x, current_y, col1["product"], col1["directions"], wrap_width, dry_run=True)
            h2 = draw_product_block(c, col2_x, current_y, col2["product"], col2["directions"], wrap_width, dry_run=True)
            h3 = draw_product_block(c, col3_x, current_y, col3["product"], col3["directions"], wrap_width, dry_run=True)
            h4 = draw_product_block(c, col4_x, current_y, col4["product"], col4["directions"], wrap_width, dry_run=True)
            cell_height = (max(max(h1, h2, h3, h4), min_lines) + 1) * row_height + 5
            row_heights.append(cell_height)

        # === Watermark at Fixed Position ===
        watermark_path = resource_path("icons/corium_logo.webp")
        aspect_ratio = 1200 / 930
        watermark_width = 500
        watermark_height = watermark_width / aspect_ratio

        # Option 1: Centered on full page
        watermark_x = (width - watermark_width) / 2
        watermark_y = 125

        c.saveState()
        c.setFillAlpha(0.10)
        c.drawImage(watermark_path, watermark_x, watermark_y, width=watermark_width, height=watermark_height, mask='auto')
        c.restoreState()

        # === Draw table content ===
        current_y = table_top
        for i in range(max_steps):
            col1 = col1_data[i] if i < len(col1_data) else {"product": "", "directions": ""}
            col2 = col2_data[i] if i < len(col2_data) else {"product": "", "directions": ""}
            col3 = col3_data[i] if i < len(col3_data) else {"product": "", "directions": ""}
            col4 = col4_data[i] if i < len(col4_data) else {"product": "", "directions": ""}
            cell_height = row_heights[i]

            def shade(col_index, row_index):
                return (col_index % 2 == 0 and row_index % 2 == 1) or (col_index % 2 == 1 and row_index % 2 == 0)

            # 🟪 Checkerboard shading by column and row
            c.saveState()
            c.setFillAlpha(0.3)
            c.setFillColorRGB(163 / 255, 115 / 255, 216 / 255)

            if shade(0, i):
                c.rect(col1_x - 10, current_y - cell_height + 10, col_width - 20, cell_height, fill=True, stroke=0)
            if shade(1, i):
                c.rect(col2_x - 10, current_y - cell_height + 10, col_width - 20, cell_height, fill=True, stroke=0)
            if shade(2, i):
                c.rect(col3_x - 10, current_y - cell_height + 10, col_width - 20, cell_height, fill=True, stroke=0)
            if shade(3, i):
                c.rect(col4_x - 10, current_y - cell_height + 10, col_width - 20, cell_height, fill=True, stroke=0)

            c.restoreState()

            # STEP label
            c.setFont("Helvetica", 10)
            c.drawString(left_margin, current_y, f"STEP {i + 1}")

            # Text content
            draw_product_block(c, col1_x, current_y, col1["product"], col1["directions"], wrap_width)
            draw_product_block(c, col2_x, current_y, col2["product"], col2["directions"], wrap_width)
            draw_product_block(c, col3_x, current_y, col3["product"], col3["directions"], wrap_width)
            draw_product_block(c, col4_x, current_y, col4["product"], col4["directions"], wrap_width)

            current_y -= cell_height

        # === Grid Lines ===
        c.setLineWidth(0.2)
        c.setStrokeColorRGB(0, 0, 0)
        for x in [col1_x - 10, col1_x + wrap_width + 10, col2_x + wrap_width + 10, col3_x + wrap_width + 10]:
            c.line(x, table_top + 25, x, current_y + 10)
        line_y = table_top
        for height in row_heights[:-1]:
            line_y -= height
            c.line(col1_x - 65, line_y + 10, col4_x + wrap_width + 10, line_y + 10)
        c.line(col1_x - 65, table_top + 10, col4_x + wrap_width + 10, table_top + 10)

        # Bottom border line
        final_row_height = row_heights[-1]
        line_y -= final_row_height
        c.line(col1_x - 65, line_y + 10, col4_x + wrap_width + 10, line_y + 10)

        # === Footer ===
        c.setFont("Helvetica", 10)
        footer_text = "©2020 CORIUM CORRECTIVE 360° - ALL RIGHTS RESERVED"
        center_x = (width - c.stringWidth(footer_text, "Helvetica", 10)) / 2
        c.drawString(center_x, 15, footer_text)
        c.save()

        return file_path
