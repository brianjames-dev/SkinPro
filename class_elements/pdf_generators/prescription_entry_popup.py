import customtkinter as ctk
from tkinter import ttk
from tkinter import messagebox
from class_elements.pdf_generators.pdf_2col import Pdf2ColGenerator
from class_elements.pdf_generators.pdf_3col import Pdf3ColGenerator
from class_elements.pdf_generators.pdf_4col import Pdf4ColGenerator
from datetime import datetime
from PIL import Image, ImageTk
import pprint
import re


class PrescriptionEntryPopup(ctk.CTkToplevel):
    MAX_COLS = 4
    MAX_ROWS = 10

    def __init__(self, parent, on_submit_callback, client_id, cursor, initial_data=None, original_path=None):
        super().__init__(parent)
        self.on_submit_callback = on_submit_callback
        self.client_id = client_id
        self.cursor = cursor
        self.initial_data = initial_data
        self.original_path = original_path
        self.already_prefilled = False
        button_width = 85
        self.title("New Prescription")
        self.grab_set()

        add_row_img = ctk.CTkImage(Image.open("icons/add_row.png"), size=(24, 24))
        add_column_img = ctk.CTkImage(Image.open("icons/add_column.png"), size=(24, 24))
        delete_row_img = ctk.CTkImage(Image.open("icons/delete_row.png"), size=(24, 24))
        delete_column_img = ctk.CTkImage(Image.open("icons/delete_column.png"), size=(24, 24))
        save_img = ctk.CTkImage(Image.open("icons/save.png"), size=(24, 24))

        # Fetch the client's name
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

        if self.initial_data:
            self.num_cols = sum(1 for key in self.initial_data if key.startswith("Col") and "_Header" in key)
            col_key = "Col1"
            self.num_rows = len(self.initial_data.get(col_key, []))
        else:
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
        self.client_date_wrapper.columnconfigure((0, 1, 2), weight=0)  # Prevent stretch

        # === Client Bubble ===
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

        # === Date Bubble ===
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
        self.date_entry.bind("<FocusOut>", lambda e: self.format_date())
        self.date_entry.bind("<Return>", lambda e: self.format_date())
        self.date_entry.bind("<Tab>", lambda e: self.format_date())
        self.save_button = ctk.CTkButton(
            self.client_date_wrapper,
            text="Save",
            command=self.on_create,
            image=save_img,
            width=button_width
        )
        self.save_button.grid(row=0, column=2, padx=(10, 0), pady=0, sticky="e")

        if not self.initial_data:
            today = datetime.today().strftime("%m/%d/%Y")
            self.date_entry.insert(0, today)

        # Separator
        separator = ttk.Separator(self.main_frame, orient="horizontal")
        separator.grid(row=1, column=0, columnspan=1, sticky="ew", padx=5)

        # --- Button frame (above table) ---
        self.button_frame = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.button_frame.grid(row=2, column=0, sticky="w", padx=5, pady=5)  # Align to left, spacing below

        ctk.CTkButton(self.button_frame, text="Add Row", command=self.add_row, image=add_row_img, width=button_width, hover_color="darkgreen").pack(side="left", padx=5)
        ctk.CTkButton(self.button_frame, text="Add Col", command=self.add_column, image=add_column_img, width=button_width, hover_color="darkgreen").pack(side="left", padx=5)
        ctk.CTkButton(self.button_frame, text="Delete Row", command=self.delete_row, image=delete_row_img, width=button_width, hover_color="#FF4444").pack(side="left", padx=5)
        ctk.CTkButton(self.button_frame, text="Delete Col", command=self.delete_column, image=delete_column_img, width=button_width, hover_color="#FF4444").pack(side="left", padx=5)

        # --- Scrollable container frame ---
        scroll_container = ctk.CTkFrame(self.main_frame)
        scroll_container.grid(row=3, column=0, sticky="nsew", padx=5, pady=5)

        # Create canvas + vertical scrollbar
        canvas = ctk.CTkCanvas(scroll_container, bg="#b3b3b3", highlightthickness=0)
        canvas.pack(side="left", fill="both", expand=True)

        scrollbar = ttk.Scrollbar(scroll_container, orient="vertical", command=canvas.yview)
        scrollbar.pack(side="right", fill="y")

        canvas.configure(yscrollcommand=scrollbar.set)

        # Create internal frame inside canvas to hold the actual table content
        self.table_frame = ctk.CTkFrame(canvas, fg_color="#b3b3b3")
        table_window = canvas.create_window((0, 0), window=self.table_frame, anchor="nw")

        # Define scroll behavior functions *inside* __init__
        def on_frame_configure(event):
            canvas.configure(scrollregion=canvas.bbox("all"))

        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")


        # Bind scrolling behavior
        self.table_frame.bind("<Configure>", on_frame_configure)
        canvas.bind_all("<MouseWheel>", _on_mousewheel)

        self.pre_generate_widgets()
        self.build_table()
        self.resize_popup()
        self.minsize(550, 280)
        self.maxsize(1000, 700)


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
        
        if self.initial_data and not self.already_prefilled:
            self.prefill_from_data(self.initial_data)
            self.already_prefilled = True


    def resize_popup(self):
        base_width = 550
        base_height = 280
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
        steps_dict["start_date"] = start_date

        if not self.validate_date_format(start_date):
            messagebox.showerror("Invalid Date", "Please enter the date in MM/DD/YYYY format.")
            return

        if self.num_cols == 2:
            generator = Pdf2ColGenerator()
        elif self.num_cols == 3:
            generator = Pdf3ColGenerator()
        elif self.num_cols == 4:
            generator = Pdf4ColGenerator()
        else:
            print("❌ Unsupported column count.")
            return

        pdf_path = generator.generate(self.client_id, self.client_name, start_date, steps_dict)
        print(f"✅ PDF generated at: {pdf_path}")

        if self.on_submit_callback:
            self.on_submit_callback(pdf_path, steps_dict)

        self.destroy()


    def prefill_from_data(self, data):
        if "start_date" in data:
            self.date_entry.insert(0, data["start_date"])

        # Set headers
        for col_index in range(self.num_cols):
            header_key = f"Col{col_index + 1}_Header"
            if header_key in data:
                self.column_data[col_index]["header"].insert(0, data[header_key])

        # Set rows
        for row_index in range(self.num_rows):
            for col_index in range(self.num_cols):
                col_key = f"Col{col_index + 1}"
                if col_key in data and row_index < len(data[col_key]):
                    product = data[col_key][row_index].get("product", "")
                    directions = data[col_key][row_index].get("directions", "")

                    product_entry, direction_box = self.column_data[col_index]["entries"][row_index]
                    product_entry.insert(0, product)
                    direction_box.insert("1.0", directions)


    def validate_date_format(self, date_str):
        """
        Validates that the date is in MM/DD/YYYY format and is a real date.
        """
        try:
            # Check format via datetime for real calendar validation
            datetime.strptime(date_str, "%m/%d/%Y")
            return True
        except ValueError:
            return False
    
    def format_date(self):
        """Format the date entry to MM/DD/YYYY upon hitting Enter or leaving the field."""
        raw_date = self.date_entry.get().strip()

        if not raw_date:
            self.date_entry.delete(0, "end")
            return

        cleaned_date = re.sub(r"[^0-9/.-]", "", raw_date)

        if re.fullmatch(r"\d{2}/\d{2}/\d{4}", cleaned_date):
            return  # Already valid

        formatted_date = None

        try:
            if len(re.sub(r"\D", "", cleaned_date)) == 8:
                formatted_date = f"{cleaned_date[:2]}/{cleaned_date[2:4]}/{cleaned_date[4:]}"
            else:
                for fmt in ["%m-%d-%Y", "%m.%d.%Y", "%m/%d/%Y"]:
                    try:
                        parsed_date = datetime.strptime(cleaned_date, fmt)
                        formatted_date = parsed_date.strftime("%m/%d/%Y")
                        break
                    except ValueError:
                        formatted_date = None

            if not formatted_date:
                raise ValueError("Invalid date format")

        except ValueError:
            print("⚠ Invalid date entered. Resetting to placeholder.")
            self.date_entry.delete(0, "end")
            self.date_entry.insert(0, raw_date)
            return

        self.date_entry.delete(0, "end")
        self.date_entry.insert(0, formatted_date)
        print(f"✅ Formatted Date: {formatted_date}")
