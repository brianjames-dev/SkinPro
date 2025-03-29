import customtkinter as ctk
from tkinter import ttk
from tkinter import messagebox
from tkinter import filedialog
from PIL import Image, ImageTk
from customtkinter import CTkImage
from class_elements.treeview_styling import style_treeview
import os
from pdf2image import convert_from_path
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import tempfile
from datetime import datetime
import textwrap


class PrescriptionsPage:
    def __init__(self, parent, conn, main_app):
        self.conn = conn
        self.cursor = conn.cursor() if conn else None
        self.main_app = main_app
        self.client_id = None
        self.appointment_id = None
        self.current_prescription_id = None

        self.prescription_paths = {}  # {iid: filepath}


        # Main container
        main_frame = ctk.CTkFrame(parent)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Configure Grid Layout
        main_frame.columnconfigure(0, weight=1)  # Treeview
        main_frame.columnconfigure(1, weight=4)  # Prescription display
        main_frame.columnconfigure(2, weight=0)  # Buttons
        main_frame.rowconfigure(0, weight=1)

        # Treeview Frame (Past Prescriptions)
        treeview_frame = ctk.CTkFrame(main_frame)
        treeview_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 5))

        # Apply treeview styling
        style_treeview("Prescriptions.Treeview")

        # Grid layout in treeview_frame
        treeview_frame.rowconfigure(0, weight=1)
        treeview_frame.columnconfigure(0, weight=1)

        # Style and Treeview
        self.prescription_list = ttk.Treeview(treeview_frame, selectmode="browse", show="headings", style="Prescriptions.Treeview")
        self.prescription_list["columns"] = ("date", "template")
        self.prescription_list.heading("date", text="Date")
        self.prescription_list.heading("template", text="Template")
        self.prescription_list.column("date", width=90, anchor="center")
        self.prescription_list.column("template", width=90, anchor="center")
        self.prescription_list.grid(row=0, column=0, sticky="nsew")

        # Scrollbar for Treeview
        scrollbar = ttk.Scrollbar(treeview_frame, orient="vertical", command=self.prescription_list.yview, style="Vertical.TScrollbar")
        scrollbar.grid(row=0, column=1, sticky="ns")
        self.prescription_list.configure(yscrollcommand=scrollbar.set)

        # Prescription Display Area (Editable or PDF Preview Placeholder)
        display_frame = ctk.CTkFrame(main_frame)
        display_frame.grid(row=0, column=1, sticky="nsew", padx=(5, 5))

        ctk.CTkLabel(display_frame, text="Current Prescription", font=("Arial", 16)).pack()
        self.prescription_preview_label = ctk.CTkLabel(display_frame, text="<No Preview Available>", fg_color="#1e1e1e")
        self.prescription_preview_label.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        # Button Column on the Right
        button_column = ctk.CTkFrame(main_frame)
        button_column.grid(row=0, column=2, sticky="ns", padx=(5, 0))

        # Buttons stacked vertically
        button_specs = [
            ("New Prescription", self.create_prescription),
            ("Edit Prescription", self.edit_prescription),
            ("Delete Prescription", self.delete_prescription),
            ("Select Template", self.select_template),
            ("Preview PDF", self.preview_prescription),
            ("Print Prescription", self.print_prescription),
            ("Set Alert", self.set_alert)
        ]

        for text, command in button_specs:
            ctk.CTkButton(button_column, text=text, width=160, command=command).pack(fill="x", pady=(0, 10))


    def create_prescription(self):
        client_name = "Brian James"
        start_date = "03/28/2025"
        next_date = "04/28/2025"
        data = {
            "AM": ["Cleanse", "Tone", "Serum", "Moisturizer"],
            "PM": ["Cleanse", "Mask", "Serum", "Night Cream"]
        }

        path = self.generate_2_column_pdf(client_name, start_date, next_date, data)
        self.render_pdf_to_preview(path)
        self.add_prescription_to_list(datetime.today().strftime("%m/%d/%Y"), "2-column", path)



    def add_prescription_to_list(self, date, template, path):
        iid = self.prescription_list.insert("", "end", values=(date, template))
        self.prescription_paths[iid] = path


    def edit_prescription(self):
        print("✏️ Edit current prescription")


    def delete_prescription(self):
        print("🗑️ Delete prescription")


    def select_template(self):
        print("📄 Choose template")


    def preview_prescription(self):
        print("👁️ Preview prescription")

        # Example: Use a fixed or latest saved PDF path
        example_pdf_path = "prescriptions/example_prescription.pdf"

        if os.path.exists(example_pdf_path):
            self.render_pdf_to_preview(example_pdf_path)
        else:
            print("❌ PDF file not found for preview.")


    def print_prescription(self):
        print("🖨️ Print prescription")


    def set_alert(self):
        print("🔔 Set reminder alert")
  

    def render_pdf_to_preview(self, pdf_path):
        try:
            # Convert only the first page to an image
            pages = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=1)

            if pages:
                image = pages[0]
                image = image.resize((500, 650))  # Resize if needed
                tk_image = ImageTk.PhotoImage(image)
                self.prescription_preview_label.configure(image=tk_image, text="")
                self.prescription_preview_label.image = tk_image  # Keep a reference!
                print("✅ PDF rendered in preview label.")
            else:
                print("⚠️ No pages found in PDF.")

        except Exception as e:
            print(f"❌ Failed to render PDF: {e}")


    def draw_wrapped_text(c, x, y, text, max_width, font_name="Helvetica", font_size=10, line_height=12):
        c.setFont(font_name, font_size)
        lines = []

        for raw_line in text.split("\n"):
            # Wrap each line to fit within column width
            wrapped = textwrap.wrap(raw_line, width=999)  # Temporary width, we’ll adjust below
            adjusted = []
            for segment in wrapped:
                current_line = ""
                for word in segment.split():
                    trial_line = f"{current_line} {word}".strip()
                    if c.stringWidth(trial_line, font_name, font_size) > max_width:
                        adjusted.append(current_line)
                        current_line = word
                    else:
                        current_line = trial_line
                if current_line:
                    adjusted.append(current_line)
            lines.extend(adjusted if adjusted else [""])

        for idx, line in enumerate(lines):
            c.drawString(x, y - idx * line_height, line)

        return len(lines)


    def generate_2_column_pdf(self, client_name, start_date, steps_dict):
        """
        Generate a 2-column prescription PDF
        """
        # File output
        output_dir = os.path.join(os.getcwd(), "prescriptions")
        os.makedirs(output_dir, exist_ok=True)
        file_path = os.path.join(output_dir, f"{client_name.replace(' ', '_')}_2col.pdf")

        c = canvas.Canvas(file_path, pagesize=letter)
        width, height = letter

        # === Margins & Layout Constants ===
        left_margin = 20
        right_margin = 20
        top_margin = 730
        col_spacing = 20

        # === Logo ===
        logo_path = "icons/corium_logo.png"
        logo_width, logo_height = 174, 120
        c.drawImage(logo_path, 0, top_margin - logo_height + 60, width=logo_width, height=logo_height, mask='auto')

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
        c.setStrokeColorRGB(0.4, 0.337, 0.31)
        c.setLineWidth(0.2)
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
        c.setFont("Helvetica-Bold", 10)
        c.drawString(left_margin, y3, "*CORIUM CORRECTIVE 360° CANNOT BE COMBINED WITH ANY OTHER SKIN CARE PRODUCTS")

        # === Section Title + Underline ===
        section_text = "SKIN CARE ROUTINE & PRODUCTS"
        y = top_margin - 170
        c.setFont("Helvetica-Bold", 16)
        c.drawString(left_margin, y, section_text)
        text_width = c.stringWidth(section_text, "Helvetica-Bold", 16)
        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(1)
        c.line(left_margin, y - 2, left_margin + text_width, y - 2)

        # === Column Setup ===
        c.setFont("Helvetica-Bold", 10)
        col_spacing = 20
        col_width = (width - 2 * left_margin - col_spacing) / 2
        wrap_width = col_width - 40
        col1_x = left_margin + 60
        col2_x = left_margin + 40 + col_width

        # === Column Headers ===
        header_y = top_margin - 190
        c.drawString(col1_x + 90, header_y, "Column 1")
        c.drawString(col2_x + 90, header_y, "Column 2")

        # === Word Wrapping Helper ===
        def draw_wrapped_text(c, x, y, text, max_width, font_name="Helvetica", font_size=10, line_height=12, dry_run=False):
            c.setFont(font_name, font_size)
            lines = []

            for raw_line in text.split("\n"):
                words = raw_line.split()
                line = ""
                for word in words:
                    trial = f"{line} {word}".strip()
                    if c.stringWidth(trial, font_name, font_size) <= max_width:
                        line = trial
                    else:
                        lines.append(line)
                        line = word
                if line:
                    lines.append(line)

            if not dry_run:
                for idx, line in enumerate(lines):
                    c.drawString(x, y - idx * line_height, line)

            return len(lines)
        
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
            col1_text = col1_data[i] if i < len(col1_data) else ""
            col2_text = col2_data[i] if i < len(col2_data) else ""

            # Measure vertical space needed
            lines_1 = draw_wrapped_text(c, col1_x, current_y, col1_text, max_width=wrap_width, dry_run=True)
            lines_2 = draw_wrapped_text(c, col2_x, current_y, col2_text, max_width=wrap_width, dry_run=True)
            cell_height = max(max(lines_1, lines_2), min_lines) * row_height + 5
            row_heights.append(cell_height)

        total_table_height = sum(row_heights)

        # === Watermark Behind Table ===
        watermark_path = "icons/corium_logo.png"
        aspect_ratio = 174 / 120
        watermark_width = 500
        watermark_height = watermark_width / aspect_ratio

        watermark_x = (width - watermark_width) / 2
        watermark_y = table_top - (total_table_height / 2) - watermark_height / 2

        c.saveState()
        c.setFillAlpha(0.3)
        c.drawImage(watermark_path, watermark_x, watermark_y, width=watermark_width, height=watermark_height, mask='auto')
        c.restoreState()

        for i in range(max_steps):
            col1_text = col1_data[i] if i < len(col1_data) else ""
            col2_text = col2_data[i] if i < len(col2_data) else ""
            cell_height = row_heights[i]

            # 🟪 Checkerboard shading
            if i % 2 == 0:
                c.saveState()
                c.setFillAlpha(0.7)
                c.setFillColorRGB(210 / 255, 200 / 255, 219 / 255)
                c.rect(col2_x - 10, current_y - cell_height + 10, col_width - 20, cell_height, fill=True, stroke=0)
                c.restoreState()
            else:
                c.saveState()
                c.setFillAlpha(0.7)
                c.setFillColorRGB(210 / 255, 200 / 255, 219 / 255)
                c.rect(col1_x - 10, current_y - cell_height + 10, col_width - 20, cell_height, fill=True, stroke=0)
                c.restoreState()

            # 🟨 STEP label
            c.setFont("Helvetica-Bold", 10)
            c.drawString(left_margin, current_y, f"STEP {i + 1}")

            # 📝 Draw wrapped text on top of background
            draw_wrapped_text(c, col1_x, current_y, col1_text, max_width=wrap_width)
            draw_wrapped_text(c, col2_x, current_y, col2_text, max_width=wrap_width)

            current_y -= cell_height

        # 🟥 Vertical grid lines (draw once across full table)
        c.setLineWidth(0.2)
        c.setStrokeColorRGB(0.4, 0.337, 0.31)  # subtle purple

        vertical_lines = [
            col1_x - 10,
            col1_x + wrap_width + 10,
            col2_x - 10,
            col2_x + wrap_width + 10,
        ]

        for x in vertical_lines:
            c.line(x, table_start_y + 10, x, current_y + 10)

        # Footer
        c.setFont("Helvetica", 10)
        c.drawString(left_margin, 30, "www.coriumcorrective360.com")
        c.drawString(left_margin, 15, "©2020 CORIUM CORRECTIVE 360° - ALL RIGHTS RESERVED")

        c.save()
        print(f"✅ 2-column prescription saved to: {file_path}")
        return file_path


    def on_prescription_select(self, event):
        selected = self.prescription_list.selection()
        if selected:
            iid = selected[0]
            path = self.prescription_paths.get(iid)
            if path and os.path.exists(path):
                self.render_pdf_to_preview(path)

