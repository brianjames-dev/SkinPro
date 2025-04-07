import customtkinter as ctk
from tkinter import ttk
from prescriptions.pdf_generators.pdf_2col import Pdf2ColGenerator
from prescriptions.pdf_generators.pdf_3col import Pdf3ColGenerator
from prescriptions.pdf_generators.pdf_4col import Pdf4ColGenerator
import datetime
import pprint


class PrescriptionEntryPopup(ctk.CTkToplevel):
    MAX_COLS = 4
    MAX_ROWS = 10

    def __init__(self, parent, on_submit_callback, client_id, cursor):
        super().__init__(parent)
        self.on_submit_callback = on_submit_callback
        self.client_id = client_id
        self.cursor = cursor
        self.title("New Prescription")
        self.geometry("535x275")
        self.grab_set()

        # 🌟 Fetch the client's name
        self.client_name = "Unknown Client"
        try:
            self.cursor.execute("SELECT full_name FROM clients WHERE id = ?", (self.client_id,))
            result = self.cursor.fetchone()
            if result:
                self.client_name = result[0]
        except Exception as e:
            print(f"❌ Error fetching client name: {e}")

        # (Optional) Show the client name in the UI
        print(f"📋 Creating prescription for: {self.client_name}")

        self.num_rows = 1
        self.num_cols = 2
        self.column_data = []

        self.main_frame = ctk.CTkFrame(self)
        self.main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Grid configuration for layout stretching
        self.main_frame.columnconfigure(0, weight=1)    # Allow full width
        self.main_frame.rowconfigure(0, weight=0)       # Date row
        self.main_frame.rowconfigure(1, weight=0)       # Separator row
        self.main_frame.rowconfigure(2, weight=0)       # Button row
        self.main_frame.rowconfigure(3, weight=1)       # Table row (can stretch vertically)

        # === Combined Container Frame for Client + Date ===
        self.client_date_wrapper = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.client_date_wrapper.grid(row=0, column=0, sticky="w", padx=10, pady=10)
        self.client_date_wrapper.columnconfigure((0, 1), weight=0)  # Prevent stretch

        # === 🟣 Client Bubble ===
        self.client_bubble = ctk.CTkFrame(self.client_date_wrapper, fg_color="#563A9C")
        self.client_bubble.grid(row=0, column=0, padx=(0, 10), pady=0, sticky="w")

        self.client_label = ctk.CTkLabel(
            self.client_bubble,
            text=f"Client: {self.client_name}",
            font=("Helvetica", 12, "bold"),
            text_color="#ebebeb",
            fg_color="transparent"
        )
        self.client_label.pack(padx=10, pady=2)  # Internal bubble padding

        # === 🌿 Date Bubble ===
        self.date_bubble = ctk.CTkFrame(self.client_date_wrapper, fg_color="#563A9C")
        self.date_bubble.grid(row=0, column=1, padx=(0, 0), pady=0, sticky="w")

        date_label = ctk.CTkLabel(
            self.date_bubble,
            text="Start Date:",
            font=("Helvetica", 12, "bold"),
            text_color="#ebebeb",
            fg_color="transparent"
        )
        date_label.pack(side="left", padx=(10, 5), pady=0)

        self.date_entry = ctk.CTkEntry(
            self.date_bubble,
            width=120,
            placeholder_text="MM/DD/YYYY",
            corner_radius=10
        )
        self.date_entry.pack(side="left", padx=(0, 10), pady=2)

        # Separator
        separator = ttk.Separator(self.main_frame, orient="horizontal")
        separator.grid(row=1, column=0, columnspan=1, sticky="ew", padx=5)

        # --- Button frame (above table) ---
        self.button_frame = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.button_frame.grid(row=2, column=0, sticky="w", padx=5, pady=5)  # Align to left, spacing below

        button_width = 85
        ctk.CTkButton(self.button_frame, text="Add Row", command=self.add_row, width=button_width).pack(side="left", padx=5)
        ctk.CTkButton(self.button_frame, text="Add Column", command=self.add_column, width=button_width).pack(side="left", padx=5)
        ctk.CTkButton(self.button_frame, text="Delete Row", command=self.delete_row, width=button_width).pack(side="left", padx=5)
        ctk.CTkButton(self.button_frame, text="Delete Column", command=self.delete_column, width=button_width).pack(side="left", padx=5)
        ctk.CTkButton(self.button_frame, text="Create", command=self.on_create, width=button_width).pack(side="left", padx=5)

        # --- Table frame (below buttons) ---
        self.table_frame = ctk.CTkFrame(self.main_frame, fg_color="#b3b3b3")
        self.table_frame.grid(row=3, column=0, sticky="nsew", padx=5, pady=5)

        self.pre_generate_widgets()
        self.build_table()

    def pre_generate_widgets(self):
        self.column_data.clear()
        for col in range(self.MAX_COLS):
            col_info = {"header": None, "entries": []}
            header = ctk.CTkEntry(self.table_frame, placeholder_text=f"Header {col + 1}")
            col_info["header"] = header
            for row in range(self.MAX_ROWS):
                product = ctk.CTkEntry(self.table_frame, placeholder_text="Product(s)", width=200)
                directions = ctk.CTkTextbox(self.table_frame, height=50, width=200, corner_radius=0)
                col_info["entries"].append((product, directions))
            self.column_data.append(col_info)

    def build_table(self):
        for widget in self.table_frame.winfo_children():
            widget.grid_forget()

        total_grid_cols = 2 * self.num_cols + 1
        ctk.CTkLabel(self.table_frame, text="", fg_color="transparent").grid(row=0, column=0, padx=5, pady=5)

        for row in range(self.num_rows):
            label_row = row * 3 + 1
            ctk.CTkLabel(
                self.table_frame,
                text=f"STEP {row + 1}",
                text_color="#000000",
                fg_color="transparent",
                font=("Helvetica", 12, "bold"),
            ).grid(row=label_row, column=0, rowspan=2, sticky="n", padx=(10, 5), pady=(10, 0))

        ttk.Separator(self.table_frame, orient="vertical").grid(
            row=0, column=1, rowspan=self.num_rows * 3 + 1, sticky="ns", padx=(5, 5), pady=10
        )

        for col in range(self.num_cols):
            grid_col = 2 + col * 2
            col_info = self.column_data[col]
            col_info["header"].grid(row=0, column=grid_col, padx=10, pady=10)

            for row in range(self.num_rows):
                base_row = row * 3 + 2
                product, directions = col_info["entries"][row]
                product.grid(row=base_row, column=grid_col, padx=5, pady=5)
                directions.grid(row=base_row + 1, column=grid_col, padx=5, pady=(0, 10))

            if col < self.num_cols - 1:
                ttk.Separator(self.table_frame, orient="vertical").grid(
                    row=0, column=grid_col + 1, rowspan=self.num_rows * 3 + 1,
                    sticky="ns", padx=(5, 5), pady=10
                )

        for row in range(self.num_rows):
            if row == 0:
                ttk.Separator(self.table_frame, orient="horizontal").grid(
                    row=1, column=0, columnspan=total_grid_cols, sticky="ew", padx=10, pady=(0, 5)
                )
            sep_row = row * 3 + 1
            ttk.Separator(self.table_frame, orient="horizontal").grid(
                row=sep_row, column=0, columnspan=total_grid_cols, sticky="ew", padx=10, pady=(0, 5)
            )

    def resize_popup(self):
        base_width = 535
        base_height = 275
        col_padding = 223
        row_padding = 105
        new_width = base_width + (self.num_cols - 2) * col_padding
        new_height = base_height + (self.num_rows - 1) * row_padding
        self.geometry(f"{new_width}x{new_height}")

    def add_row(self):
        if self.num_rows < self.MAX_ROWS:
            self.num_rows += 1
            self.resize_popup()
            self.build_table()

    def add_column(self):
        if self.num_cols < self.MAX_COLS:
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

    def on_create(self):
        steps_dict = {}
        for i in range(self.num_cols):
            header = self.column_data[i]["header"].get().strip() or f"Column {i+1}"
            steps = []
            for row in range(self.num_rows):
                product, directions = self.column_data[i]["entries"][row]
                product_text = product.get().strip()
                directions_text = directions.get("1.0", "end").strip()
                steps.append({"product": product_text, "directions": directions_text})
            steps_dict[f"Col{i+1}_Header"] = header
            steps_dict[f"Col{i+1}"] = steps

        print("✅ Collected Prescription:")
        pprint.pprint(steps_dict)

        start_date = self.date_entry.get().strip()

        if self.num_cols == 2:
            generator = Pdf2ColGenerator()
        elif self.num_cols == 3:
            generator = Pdf3ColGenerator()
        elif self.num_cols == 4:
            generator = Pdf4ColGenerator()
        else:
            print("❌ Unsupported column count.")
            return

        pdf_path = generator.generate(self.client_name, start_date, steps_dict)
        print(f"✅ PDF generated at: {pdf_path}")

        if self.on_submit_callback:
            self.on_submit_callback(pdf_path, steps_dict)

        self.destroy()
