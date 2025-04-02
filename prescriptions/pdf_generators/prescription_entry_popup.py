import customtkinter as ctk
from tkinter import ttk
from prescriptions.pdf_generators.pdf_2col import Pdf2ColGenerator
from prescriptions.pdf_generators.pdf_3col import Pdf3ColGenerator
from prescriptions.pdf_generators.pdf_4col import Pdf4ColGenerator
import datetime
import pprint


class PrescriptionEntryPopup(ctk.CTkToplevel):
    def __init__(self, parent, on_submit_callback):
        super().__init__(parent)
        self.on_submit_callback = on_submit_callback
        self.title("New Prescription")
        self.geometry("525x215")
        self.configure(fg_color="#1e1e1e")

        # Lock main window1
        self.grab_set()

        # Trackers for dynamic UI
        self.column_data = []  # Track column info
        self.num_rows = 1      # Start with 1 step
        self.num_cols = 2      # Start with 2 columns

        # === Main Container for Content ===
        self.main_frame = ctk.CTkFrame(self, fg_color="#2b2b2b")
        self.main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        self.table_frame = ctk.CTkFrame(self.main_frame, fg_color="#2b2b2b")
        self.table_frame.pack(fill="both", expand=True)

        # === Bottom Buttons ===
        button_frame = ctk.CTkFrame(self, fg_color="transparent")
        button_frame.pack(pady=(0, 10))
        button_width = 80

        ctk.CTkButton(button_frame, text="Create", command=self.on_create, width=button_width).pack(side="right", padx=5)
        ctk.CTkButton(button_frame, text="Delete Column", command=self.delete_column, width=button_width).pack(side="right", padx=5)
        ctk.CTkButton(button_frame, text="Delete Row", command=self.delete_row, width=button_width).pack(side="right", padx=5)
        ctk.CTkButton(button_frame, text="Add Column", command=self.add_column, width=button_width).pack(side="right", padx=5)
        ctk.CTkButton(button_frame, text="Add Row", command=self.add_row, width=button_width).pack(side="right", padx=5)

        self.build_table()  # Initial 2x1 table


    def on_create(self):
        # Collect and format data
        steps_dict = {}
        for i, col in enumerate(self.column_data):
            header = col["header"].get().strip() or f"Column {i+1}"
            steps = []
            for product, directions in col["entries"]:
                product_text = product.get().strip()
                directions_text = directions.get("1.0", "end").strip()
                steps.append({"product": product_text, "directions": directions_text})
            steps_dict[f"Col{i+1}_Header"] = header
            steps_dict[f"Col{i+1}"] = steps

        print("✅ Collected Prescription:")
        pprint.pprint(steps_dict)

        # Set default client name and date for testing (replace with entry field later if desired)
        client_name = "New Client"
        start_date = datetime.datetime.now().strftime("%m/%d/%Y")

        # Determine which generator to use
        if self.num_cols == 2:
            generator = Pdf2ColGenerator()
        elif self.num_cols == 3:
            generator = Pdf3ColGenerator()
        elif self.num_cols == 4:
            generator = Pdf4ColGenerator()
        else:
            print("❌ Unsupported number of columns for PDF generation.")
            return

        # Generate the PDF and get the path
        pdf_path = generator.generate(client_name, start_date, steps_dict)
        print(f"✅ PDF generated at: {pdf_path}")

        if self.on_submit_callback:
            self.on_submit_callback(pdf_path, steps_dict)

        self.destroy()


    def add_row(self):
        if self.num_rows < 10:
            self.num_rows += 1
            self.resize_popup()
            self.build_table()


    def add_column(self):
        if self.num_cols < 4:
            self.num_cols += 1
            self.resize_popup()
            self.build_table()


    def delete_row(self):
        if self.num_rows > 1:
            self.num_rows -= 1
            self.resize_popup()
            self.build_table()
    

    def delete_column(self):
        if self.num_cols > 2:
            self.num_cols -= 1
            self.resize_popup()
            self.build_table()


    def resize_popup(self):
        base_width = 525
        base_height = 215
        col_padding = 225   # Width per column
        row_padding = 105    # Height per row (product + directions)

        new_width = base_width + (self.num_cols - 2) * col_padding
        new_height = base_height + (self.num_rows - 1) * row_padding

        self.geometry(f"{new_width}x{new_height}")


    def build_table(self):
        for widget in self.table_frame.winfo_children():
            widget.destroy()

        self.column_data = []

        total_grid_cols = 2 * self.num_cols + 1  # step labels + cols + separators

        # === Empty cell top-left ===
        ctk.CTkLabel(self.table_frame, text="", fg_color="#2b2b2b").grid(row=0, column=0, padx=5, pady=5)

        # === Step labels ===
        for row in range(self.num_rows):
            label_row = row * 3 + 1  # Product row starts at 1, then +3 per row
            ctk.CTkLabel(
                self.table_frame,
                text=f"STEP {row + 1}",
                text_color="white",
                fg_color="#2b2b2b"
            ).grid(row=label_row, column=0, rowspan=2, sticky="n", padx=(10, 5), pady=(10, 0))

        # === Vertical separator after step labels ===
        ttk.Separator(self.table_frame, orient="vertical").grid(
            row=0, column=1, rowspan=self.num_rows * 3 + 1, sticky="ns", padx=(5, 5), pady=10
        )

        # === Dynamic columns ===
        for col in range(self.num_cols):
            col_info = {"header": None, "entries": []}
            grid_col = 2 + col * 2

            # Header
            header = ctk.CTkEntry(self.table_frame, placeholder_text=f"Header {col + 1}")
            header.grid(row=0, column=grid_col, padx=10, pady=10)
            col_info["header"] = header

            for row in range(self.num_rows):
                base_row = row * 3 + 2
                product = ctk.CTkEntry(self.table_frame, placeholder_text="Product(s)", width=200)
                directions = ctk.CTkTextbox(self.table_frame, height=50, width=200)
                product.grid(row=base_row, column=grid_col, padx=5, pady=5)
                directions.grid(row=base_row + 1, column=grid_col, padx=5, pady=(0, 10))
                col_info["entries"].append((product, directions))

            self.column_data.append(col_info)

            # Vertical separator to the right of each column (except the last)
            if col < self.num_cols - 1:
                separator_col = grid_col + 1
                ttk.Separator(self.table_frame, orient="vertical").grid(
                    row=0, column=separator_col, rowspan=self.num_rows * 3 + 1,
                    sticky="ns", padx=(5, 5), pady=10
                )

        # === Horizontal separators after each row of steps ===
        for row in range(self.num_rows):
            if row == 0:
                ttk.Separator(self.table_frame, orient="horizontal").grid(
                    row=1, column=0, columnspan=total_grid_cols, sticky="ew", padx=10, pady=(0, 5)
                )
            
            sep_row = row * 3 + 1  # Comes right after the direction field of each step
            ttk.Separator(self.table_frame, orient="horizontal").grid(
                row=sep_row, column=0, columnspan=total_grid_cols, sticky="ew", padx=10, pady=(0, 5)
            )
