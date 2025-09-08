import customtkinter as ctk
from tkinter import ttk, messagebox, Text
from utils.path_utils import resource_path
from class_elements.pdf_generators.pdf_2col import Pdf2ColGenerator
from class_elements.pdf_generators.pdf_3col import Pdf3ColGenerator
from class_elements.pdf_generators.pdf_4col import Pdf4ColGenerator
from datetime import datetime
from PIL import Image, ImageTk
import pprint
import re
import sqlite3


class PrescriptionEntryPopup(ctk.CTkToplevel):
    MAX_COLS = 4
    MAX_ROWS = 10

    def __init__(self, parent, on_submit_callback, client_id, data_manager, initial_data=None, original_path=None):
        super().__init__(parent)
        self.on_submit_callback = on_submit_callback
        self.client_id = client_id
        self.data_manager = data_manager
        self.initial_data = initial_data
        self.original_path = original_path
        self.already_prefilled = False
        button_width = 85
        self.title("New Prescription")
        self.text_widgets = []
        self.grab_set()

        add_row_img = ctk.CTkImage(Image.open(resource_path("icons/add_row.png")), size=(24, 24))
        add_column_img = ctk.CTkImage(Image.open(resource_path("icons/add_column.png")), size=(24, 24))
        delete_row_img = ctk.CTkImage(Image.open(resource_path("icons/delete_row.png")), size=(24, 24))
        delete_column_img = ctk.CTkImage(Image.open(resource_path("icons/delete_column.png")), size=(24, 24))
        highlighter_img = ctk.CTkImage(Image.open(resource_path("icons/highlighter.png")), size=(22, 22))
        save_img = ctk.CTkImage(Image.open(resource_path("icons/save.png")), size=(24, 24))


        # Fetch the client's name
        try:
            with sqlite3.connect(self.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT full_name FROM clients WHERE id = ?", (self.client_id,))
                result = cursor.fetchone()
            if result:
                self.client_name = result[0]
        except Exception as e:
            print(f"Error fetching client name: {e}")

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
        self.main_frame.rowconfigure(3, weight=0)       # Separator
        self.main_frame.rowconfigure(4, weight=0)       # Insert/Delete Rows 
        self.main_frame.rowconfigure(5, weight=1)       # Table row (can stretch vertically)

        # === Combined Container Frame for Client + Date ===
        self.client_date_wrapper = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.client_date_wrapper.grid(row=0, column=0, sticky="w", padx=5, pady=5)
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

        self.button_frame.columnconfigure((0, 1, 2, 3, 4, 5, 6, 7), weight=0)

        ctk.CTkButton(
            self.button_frame,
            text="Add Row",
            command=self.add_row,
            image=add_row_img,
            width=button_width,
            anchor="center",
            hover_color="darkgreen"
        ).grid(row=0, column=0, padx=4, pady=2)

        ctk.CTkButton(
            self.button_frame,
            text="Add Col",
            command=self.add_column,
            image=add_column_img,
            width=button_width,
            anchor="center",
            hover_color="darkgreen"
        ).grid(row=0, column=1, padx=4, pady=2)

        ctk.CTkButton(
            self.button_frame,
            text="Delete Row",
            command=self.delete_row,
            image=delete_row_img,
            width=button_width,
            anchor="center",
            hover_color="#FF4444"
        ).grid(row=0, column=2, padx=4, pady=2)

        ctk.CTkButton(
            self.button_frame,
            text="Delete Col",
            command=self.delete_column,
            image=delete_column_img,
            width=button_width,
            anchor="center",
            hover_color="#FF4444"
        ).grid(row=0, column=3, padx=4, pady=2)

        ctk.CTkButton(
            self.button_frame,
            text="",
            image=highlighter_img,
            command=self.highlight_current_selection,
            width=24,
            height=24,
            anchor="center",
            hover_color="#b3ab20"
        ).grid(row=0, column=4, padx=4, ipady=1)


        # Separator
        separator2 = ttk.Separator(self.main_frame, orient="horizontal")
        separator2.grid(row=3, column=0, columnspan=1, sticky="ew", padx=5)

        # --- Insert blank row controls (second control row) ---
        self.insert_frame = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.insert_frame.grid(row=4, column=0, sticky="w", padx=5, pady=5)

        # 6 slots: RowLbl, RowCombo, ColLbl, ColCombo, InsertBtn, DeleteBtn
        self.insert_frame.columnconfigure((0, 1, 2, 3, 4, 5), weight=0)

        row_lbl = ctk.CTkLabel(self.insert_frame, text="Row:")
        row_lbl.grid(row=0, column=0, padx=(0, 6), pady=2)

        # (re-use your existing row combo)
        self.insert_before_combo = ctk.CTkComboBox(
            self.insert_frame,
            values=[str(i) for i in range(1, self.num_rows + 1)],
            width=70,
            state="readonly"
        )
        self.insert_before_combo.grid(row=0, column=1, padx=(0, 12), pady=2)
        self.insert_before_combo.set("1")

        col_lbl = ctk.CTkLabel(self.insert_frame, text="Column:")
        col_lbl.grid(row=0, column=2, padx=(0, 6), pady=2)

        # NEW: Column combo — "All columns" OR a specific column number
        self.column_scope_combo = ctk.CTkComboBox(
            self.insert_frame,
            values=["All columns"] + [str(i) for i in range(1, self.num_cols + 1)],
            width=110,
            state="readonly"
        )
        self.column_scope_combo.grid(row=0, column=3, padx=(0, 12), pady=2)
        self.column_scope_combo.set("All columns")

        self.insert_blank_btn = ctk.CTkButton(
            self.insert_frame,
            text="Insert",
            width=85,
            command=self.on_insert_blank_row
        )
        self.insert_blank_btn.grid(row=0, column=4, padx=4, pady=2)

        self.delete_selected_btn = ctk.CTkButton(
            self.insert_frame,
            text="Delete",
            width=85,
            hover_color="#FF4444",
            command=self.on_delete_selected_row
        )
        self.delete_selected_btn.grid(row=0, column=5, padx=4, pady=2)

        # --- Scrollable container frame ---
        scroll_container = ctk.CTkFrame(self.main_frame)
        scroll_container.grid(row=5, column=0, sticky="nsew", padx=5, pady=0)

        # Create canvas + vertical scrollbar
        canvas = ctk.CTkCanvas(scroll_container, bg="#b3b3b3", highlightthickness=0)
        canvas.pack(side="left", fill="both", expand=True)

        scrollbar = ttk.Scrollbar(scroll_container, orient="vertical", command=canvas.yview)
        scrollbar.pack(side="right", fill="y")

        canvas.configure(yscrollcommand=scrollbar.set)

        # Create internal frame inside canvas to hold the actual table content
        self.table_frame = ctk.CTkFrame(canvas, fg_color="#b3b3b3")
        table_window = canvas.create_window((0, 0), window=self.table_frame, anchor="nw")

        self.scroll_canvas = canvas  # Store canvas reference
        self.scroll_canvas.bind("<Configure>", self._update_scroll_region)
        scrollbar.configure(command=self.scroll_canvas.yview)  # Make sure scrollbar scrolls canvas
        self.scroll_canvas.configure(yscrollcommand=scrollbar.set)  # Keep canvas in sync with scrollbar

        self.outer_scroll_active = False
        self.bind_table_scroll_behavior()
        self.pre_generate_widgets()
        self.build_table()
        self.resize_popup()
        self._update_scroll_region()
        self.minsize(555, 283)
        self.maxsize(1000, 710)

        if self.initial_data and not self.already_prefilled:
            self.prefill_from_data(self.initial_data)
            self.already_prefilled = True
        
        self._initial_snapshot = self._snapshot_state()

        self.protocol("WM_DELETE_WINDOW", self.confirm_close)


    def confirm_close(self):
        # If nothing changed, close immediately
        if not self._is_dirty():
            self.destroy()
            return

        # Otherwise, show your existing confirm dialog
        confirm_win = ctk.CTkToplevel(self)
        confirm_win.title("Confirm Exit")
        confirm_win.geometry("300x150")
        confirm_win.resizable(False, False)
        confirm_win.transient(self)
        confirm_win.grab_set()
        confirm_win.focus_force()

        frame = ctk.CTkFrame(confirm_win)
        frame.pack(expand=True, fill="both", padx=10, pady=10)

        label = ctk.CTkLabel(
            frame,
            text="Are you sure you want to exit?\n\nAll changes will be lost.",
            font=("Helvetica", 14),
            justify="center"
        )
        label.pack(pady=(10, 20))

        btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
        btn_frame.pack()

        ctk.CTkButton(btn_frame, text="Cancel", width=90, command=confirm_win.destroy).pack(side="left", padx=10)
        ctk.CTkButton(
            btn_frame,
            text="Confirm",
            width=90,
            fg_color="#FF4444",
            hover_color="#CC0000",
            command=lambda: (confirm_win.destroy(), self.destroy())
        ).pack(side="right", padx=10)


    def _update_scroll_region(self, event=None):
        self.scroll_canvas.configure(scrollregion=self.scroll_canvas.bbox("all"))


    def bind_table_scroll_behavior(self):
        def _on_mousewheel(event):
            self.scroll_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

        def _bind_canvas_scroll(_=None):
            if not self.outer_scroll_active:
                self.scroll_canvas.bind_all("<MouseWheel>", _on_mousewheel)
                self.outer_scroll_active = True

        def _unbind_canvas_scroll(_=None):
            if self.outer_scroll_active:
                self.scroll_canvas.unbind_all("<MouseWheel>")
                self.outer_scroll_active = False

        self._bind_canvas_scroll = _bind_canvas_scroll
        self._unbind_canvas_scroll = _unbind_canvas_scroll

        # Attach scroll logic to the whole canvas area, not just table_frame
        self.scroll_canvas.bind("<Enter>", _bind_canvas_scroll)
        self.scroll_canvas.bind("<Leave>", _unbind_canvas_scroll)


    def bind_scroll_behavior(self, widget):
        def _on_inner_scroll(e):
            widget.yview_scroll(int(-1 * (e.delta / 120)), "units")
            return "break"

        widget.bind("<Enter>", lambda e: (
            widget.bind_all("<MouseWheel>", _on_inner_scroll),
            self._unbind_canvas_scroll()
        ))
        widget.bind("<Leave>", lambda e: (
            widget.unbind_all("<MouseWheel>"),
            self._bind_canvas_scroll()
        ))


    def pre_generate_widgets(self):
        self.column_data.clear()
        self.text_widgets = []

        for col in range(self.MAX_COLS):
            col_info = {"header": None, "entries": []}
            header = ctk.CTkEntry(self.table_frame, placeholder_text=f"Header {col + 1}")
            col_info["header"] = header

            for row in range(self.MAX_ROWS):
                product = ctk.CTkEntry(self.table_frame, placeholder_text="Product(s)", width=200)
                directions = Text(
                    self.table_frame,
                    height=4,
                    width=30,
                    wrap="word",
                    font=("Helvetica", 18),
                    selectbackground="#3399FF",
                    selectforeground="#FFFFFF",
                )

                # Highlight tags
                directions.tag_config("highlight", background="yellow", foreground="black")
                directions.tag_config("highlight_selected", background="#3399FF", foreground="white")

                # Selection detection
                directions.bind("<<Selection>>", lambda e, w=directions: self.update_selection_tag(w))
                directions.bind("<FocusOut>", lambda e, w=directions: w.tag_remove("highlight_selected", "1.0", "end"))
                directions.bind("<FocusIn>", lambda e, widget=directions: self.after_idle(lambda: self.set_focused_text_widget(widget)))

                self.bind_scroll_behavior(directions)

                # Track this widget
                self.text_widgets.append(directions)

                col_info["entries"].append((product, directions))

            self.column_data.append(col_info)


    def update_selection_tag(self, widget):
        # Clear selection from all other text widgets
        for w in self.text_widgets:
            if w != widget:
                w.tag_remove("sel", "1.0", "end")  # Clear prior invisible selection
                w.tag_remove("highlight_selected", "1.0", "end")

        widget.tag_remove("highlight_selected", "1.0", "end")
        try:
            start = widget.index("sel.first")
            end = widget.index("sel.last")
            widget.tag_add("highlight_selected", start, end)
        except:
            pass  # No selection


    def set_focused_text_widget(self, widget):
        self.last_focused_widget = widget


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
        base_width = 555
        base_height = 283
        col_padding = 223
        row_padding = 107
        new_width = base_width + (self.num_cols - 2) * col_padding
        new_height = base_height + (self.num_rows - 1) * row_padding
        self.geometry(f"{new_width}x{new_height}")


    def add_row(self):
        if self.num_rows < self.MAX_ROWS:
            self.num_rows += 1
            self.resize_popup()
            self.build_table()
            self.after_idle(self._update_scroll_region)
            self._refresh_insert_menu_choices()


    def add_column(self):
        if self.num_cols < self.MAX_COLS:
            self.num_cols += 1
            self.resize_popup()
            self.build_table()
            self.after_idle(self._update_scroll_region)
            self._refresh_insert_menu_choices()


    def delete_row(self):
        if self.num_rows > 1:
            self.num_rows -= 1
            self.resize_popup()
            self.build_table()
            self.after_idle(self._update_scroll_region)
            self._refresh_insert_menu_choices()


    def delete_column(self):
        if self.num_cols > 2:
            self.num_cols -= 1
            self.resize_popup()
            self.build_table()
            self.after_idle(self._update_scroll_region)
            self._refresh_insert_menu_choices()


    def extract_text_with_highlight(self, text_widget):
        output = ""
        current_tags = None
        index = "1.0"

        while True:
            if index == text_widget.index("end"):
                break

            next_index = text_widget.index(f"{index} +1c")
            char = text_widget.get(index, next_index)
            tags = text_widget.tag_names(index)

            if "highlight" in tags and "highlight" not in (current_tags or []):
                output += "[[highlight]]"
            elif "highlight" not in tags and "highlight" in (current_tags or []):
                output += "[[/highlight]]"

            output += char
            current_tags = tags
            index = next_index

        # Close tag if text ends while still in highlight
        if "highlight" in (current_tags or []):
            output += "[[/highlight]]"

        print(f"Extracted with highlight: {repr(output.strip())}")
        return output.strip()


    def on_create(self):
        # Auto-remove empty rows before collecting data / generating PDF
        self._compact_empty_rows()

        steps_dict = {}
        for i in range(self.num_cols):
            header = self.column_data[i]["header"].get().strip() or f"Column {i+1}"
            steps = []
            for row in range(self.num_rows):
                product, directions = self.column_data[i]["entries"][row]
                product_text = product.get().strip()
                directions_text = self.extract_text_with_highlight(directions)
                steps.append({"product": product_text, "directions": directions_text})
            steps_dict[f"Col{i+1}_Header"] = header
            steps_dict[f"Col{i+1}"] = steps

        print("Collected Prescription:")
        pprint.pprint(steps_dict)

        start_date = self.date_entry.get().strip()
        steps_dict["start_date"] = start_date

        if not self.validate_date_format(start_date):
            messagebox.showerror("Invalid Date", "Please enter the date in MM/DD/YYYY format.")
            return

        if self.num_cols == 2:
            generator = Pdf2ColGenerator(self.data_manager)
        elif self.num_cols == 3:
            generator = Pdf3ColGenerator(self.data_manager)
        elif self.num_cols == 4:
            generator = Pdf4ColGenerator(self.data_manager)
        else:
            print("❌ Unsupported column count.")
            return

        pdf_path = generator.generate(self.client_id, self.client_name, start_date, steps_dict)
        print(f"PDF generated at: {pdf_path}")
        
        if not pdf_path:
            messagebox.showerror("PDF Error", "Failed to generate PDF.")
            return

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
                    product_entry.delete(0, "end")
                    direction_box.delete("1.0", "end")
                    product_entry.insert(0, product)
                    self.insert_highlighted_text(direction_box, directions)


    def insert_highlighted_text(self, text_widget, content):
        text_widget.tag_remove("highlight", "1.0", "end")

        print(f"\n🔍 [insert_highlighted_text] Raw content: {repr(content)}")
        text_widget.delete("1.0", "end")  # Clear previous content

        pattern = r"\[\[highlight\]\](.*?)\[\[/highlight\]\]"
        last_end = 0
        has_any_highlight = False

        for match in re.finditer(pattern, content, re.DOTALL):
            start, end = match.span()
            normal_text = content[last_end:start]
            highlighted_text = match.group(1)

            # Insert normal text before the highlight
            if normal_text:
                print(f"Inserting normal text: {repr(normal_text)}")
                text_widget.insert("end", normal_text)

            # Insert highlighted text and apply tag
            start_idx = text_widget.index("insert")
            text_widget.insert("insert", highlighted_text)
            end_idx = text_widget.index("insert")
            text_widget.tag_add("highlight", start_idx, end_idx)
            text_widget.tag_config("highlight", background="yellow", foreground="black")
            print(f"Highlighted: {repr(highlighted_text)} from {start_idx} to {end_idx}")

            has_any_highlight = True
            last_end = end

        # Insert any remaining plain text after the last highlight
        if last_end < len(content):
            tail = content[last_end:]
            print(f"Inserting trailing text: {repr(tail)}")
            text_widget.insert("end", tail)

        if not has_any_highlight:
            print("No highlight tags found in this content.")


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
        print(f"Formatted Date: {formatted_date}")


    def highlight_current_selection(self):
        self.update_idletasks()
        widget = getattr(self, 'last_focused_widget', None)

        if not widget:
            print("No focused text widget found.")
            return

        try:
            start = widget.index("sel.first")
            end = widget.index("sel.last")

            if start == end:
                print("Empty selection. Nothing to highlight or dehighlight.")
                return

            # Check if every character in the selection has the highlight tag
            current = start
            fully_highlighted = True

            while current != end:
                if "highlight" not in widget.tag_names(current):
                    fully_highlighted = False
                    break
                current = widget.index(f"{current} +1c")

            if fully_highlighted:
                widget.tag_remove("highlight", start, end)
                print(f"De-highlighted: {widget.get(start, end)} from {start} to {end}")
            else:
                widget.tag_add("highlight", start, end)
                widget.tag_config("highlight", background="yellow", foreground="black")
                print(f"Highlighted: {widget.get(start, end)} from {start} to {end}")

            # Remove selection coloring immediately after toggling
            widget.tag_remove("sel", "1.0", "end")
            widget.tag_remove("highlight_selected", "1.0", "end")

        except Exception as e:
            print(f"Failed to toggle highlight: {e}")


    def _refresh_insert_menu_choices(self):
        """Keep the Row combo in sync with current row count (selection-preserving)."""
        values = [str(i) for i in range(1, self.num_rows + 1)]
        if not hasattr(self, "insert_before_combo"):
            return
        try:
            current = self.insert_before_combo.get().strip()
            self.insert_before_combo.configure(values=values)
            if current in values:
                self.insert_before_combo.set(current)
            else:
                self.insert_before_combo.set(values[-1] if values else "1")
        except Exception:
            pass


    def _refresh_column_combo_choices(self):
        """Keep the Column combo in sync with current column count (selection-preserving)."""
        values = ["All columns"] + [str(i) for i in range(1, self.num_cols + 1)]
        if not hasattr(self, "column_scope_combo"):
            return
        try:
            current = self.column_scope_combo.get().strip()
            self.column_scope_combo.configure(values=values)
            if current in values:
                self.column_scope_combo.set(current)
            else:
                self.column_scope_combo.set("All columns")
        except Exception:
            pass


    def _clear_row_widgets(self, row_index: int):
        """Clear product/directions + tags for a given row across all active columns."""
        for col in range(self.num_cols):
            product_entry, direction_box = self.column_data[col]["entries"][row_index]
            product_entry.delete(0, "end")
            direction_box.delete("1.0", "end")
            direction_box.tag_remove("highlight", "1.0", "end")
            direction_box.tag_remove("highlight_selected", "1.0", "end")

    def _copy_row_values(self, src_row: int, dst_row: int):
        """Copy product + directions (with highlight) from src_row to dst_row for all active columns."""
        for col in range(self.num_cols):
            src_product, src_text = self.column_data[col]["entries"][src_row]
            dst_product, dst_text = self.column_data[col]["entries"][dst_row]

            # Copy product text
            dst_product.delete(0, "end")
            dst_product.insert(0, src_product.get())

            # Copy directions with highlight fidelity using your existing helpers
            content = self.extract_text_with_highlight(src_text)
            self.insert_highlighted_text(dst_text, content)

    def _copy_cell_values(self, col: int, src_row: int, dst_row: int):
        """Copy one cell (product + directions with highlight) within a single column."""
        src_product, src_text = self.column_data[col]["entries"][src_row]
        dst_product, dst_text = self.column_data[col]["entries"][dst_row]

        dst_product.delete(0, "end")
        dst_product.insert(0, src_product.get())

        content = self.extract_text_with_highlight(src_text)
        self.insert_highlighted_text(dst_text, content)


    def _clear_cell_widgets(self, col: int, row: int):
        """Clear one cell (product + directions tags) within a single column."""
        product_entry, direction_box = self.column_data[col]["entries"][row]
        product_entry.delete(0, "end")
        direction_box.delete("1.0", "end")
        direction_box.tag_remove("highlight", "1.0", "end")
        direction_box.tag_remove("highlight_selected", "1.0", "end")


    def _cell_is_empty(self, col: int, row: int) -> bool:
        """A cell is empty if product and directions (sans [[highlight]] tags) are blank."""
        product_entry, direction_box = self.column_data[col]["entries"][row]
        product_empty = product_entry.get().strip() == ""
        # strip [[highlight]] tags from extracted content
        raw = self.extract_text_with_highlight(direction_box)
        plain = re.sub(r"\[\[/?highlight\]\]", "", raw).strip()
        return product_empty and (plain == "")

    def _column_is_full(self, col: int) -> bool:
        """True if every visible row in this column contains content (no empty cells)."""
        return all(not self._cell_is_empty(col, r) for r in range(self.num_rows))

    def _find_lowest_empty_cell(self, col: int, start_row: int) -> int | None:
        """
        Return the index of the lowest empty cell in column `col`
        at or below `start_row` (inclusive). If none found, return None.
        """
        last_row = self.num_rows - 1
        for r in range(last_row, start_row - 1, -1):
            if self._cell_is_empty(col, r):
                return r
        return None

    def _find_highest_empty_cell(self, col: int, end_row: int) -> int | None:
        """
        Return index of the highest empty cell in column `col` at or ABOVE `end_row` (inclusive).
        If none found, return None.
        """
        for r in range(end_row, -1, -1):
            if self._cell_is_empty(col, r):
                return r
        return None

    def _row_is_empty(self, row: int) -> bool:
        """True if all active columns are empty at this row."""
        return all(self._cell_is_empty(col, row) for col in range(self.num_cols))


    def _compact_empty_rows(self):
        """
        Remove rows that are empty across all columns by shifting non-empty rows upward
        and reducing self.num_rows. Keeps at least one row visible.
        """
        # Gather all non-empty row indices in order
        non_empty = [r for r in range(self.num_rows) if not self._row_is_empty(r)]

        if not non_empty:
            # Keep one blank row; clear everything
            for col in range(self.num_cols):
                self._clear_cell_widgets(col, 0)
            for r in range(1, self.num_rows):
                self._clear_row_widgets(r)
            new_rows = 1
        else:
            # Move each non-empty row into the next write slot
            write = 0
            for r in non_empty:
                if r != write:
                    for col in range(self.num_cols):
                        self._copy_cell_values(col, r, write)
                write += 1

            # Clear trailing rows that are now duplicates
            for r in range(write, self.num_rows):
                self._clear_row_widgets(r)

            new_rows = write

        # If the visible count changed, rebuild UI & combos
        if new_rows != self.num_rows:
            self.num_rows = new_rows
            self.resize_popup()
            self.build_table()
            self.after_idle(self._update_scroll_region)
            self._refresh_insert_menu_choices()
            self._refresh_column_combo_choices()

    def on_insert_blank_row(self):
        # Parse row
        try:
            val = self.insert_before_combo.get().strip()
            before_n = int(val) if val else 1
        except Exception:
            before_n = 1
        before_n = max(1, min(before_n, self.num_rows))
        insert_at = before_n - 1

        # Column scope
        col_scope = getattr(self, "column_scope_combo", None)
        col_val = col_scope.get().strip() if col_scope else "All columns"

        # Preserve viewport
        try:
            y0, _ = self.scroll_canvas.yview()
        except Exception:
            y0 = 0.0

        if col_val == "All columns":
            # ---- existing ROW INSERT (adds a new row) ----
            if self.num_rows >= self.MAX_ROWS:
                messagebox.showwarning("Max Rows Reached", f"You can’t exceed {self.MAX_ROWS} rows.")
                return

            self.num_rows += 1
            for r in range(self.num_rows - 1, insert_at, -1):
                self._copy_row_values(r - 1, r)
            self._clear_row_widgets(insert_at)

            self.resize_popup()
            self.build_table()
            self.after_idle(self._update_scroll_region)
            self._refresh_insert_menu_choices()
            self._refresh_column_combo_choices()

        else:
            # ---- COLUMN-SCOPED CELL INSERT with correct MAX_ROWS behavior ----
            try:
                col_idx = int(col_val) - 1
            except Exception:
                col_idx = 0
            col_idx = max(0, min(col_idx, self.num_cols - 1))

            if self.num_rows == self.MAX_ROWS:
                # Look for space strictly BELOW the insertion point first
                below_empty = self._find_lowest_empty_cell(col_idx, insert_at + 1)
                if below_empty is not None:
                    for r in range(below_empty, insert_at, -1):
                        self._copy_cell_values(col_idx, r - 1, r)
                    self._clear_cell_widgets(col_idx, insert_at)
                    self.after_idle(self._update_scroll_region)
                else:
                    # No space below; look for an empty STRICTLY ABOVE the insertion point
                    above_empty = self._find_highest_empty_cell(col_idx, insert_at - 1)
                    if above_empty is not None:
                        # Shift UP the block [above_empty+1 .. insert_at] so the empty moves to insert_at
                        for r in range(above_empty, insert_at):
                            self._copy_cell_values(col_idx, r + 1, r)
                        self._clear_cell_widgets(col_idx, insert_at)
                        self.after_idle(self._update_scroll_region)
                    else:
                        # No empties anywhere in this column → strict overflow → warn
                        messagebox.showwarning(
                            "Cannot Insert Cell",
                            "This column already has the maximum number of filled steps.\n"
                            "Clear a cell or delete a row before inserting."
                        )
                        return

            else:
                # num_rows < MAX_ROWS
                target_is_empty = self._cell_is_empty(col_idx, insert_at)

                if target_is_empty:
                    # Always grow so repeated inserts can reach MAX_ROWS
                    self.num_rows += 1
                    for r in range(self.num_rows - 1, insert_at, -1):
                        self._copy_cell_values(col_idx, r - 1, r)
                    self._clear_cell_widgets(col_idx, insert_at)

                    self.resize_popup()
                    self.build_table()
                    self.after_idle(self._update_scroll_region)
                    self._refresh_insert_menu_choices()
                    self._refresh_column_combo_choices()

                else:
                    # Prefer shifting into an empty slot strictly below; grow only if none
                    empty_at = self._find_lowest_empty_cell(col_idx, insert_at + 1)
                    if empty_at is not None:
                        for r in range(empty_at, insert_at, -1):
                            self._copy_cell_values(col_idx, r - 1, r)
                        self._clear_cell_widgets(col_idx, insert_at)
                        self.after_idle(self._update_scroll_region)
                    else:
                        self.num_rows += 1
                        for r in range(self.num_rows - 1, insert_at, -1):
                            self._copy_cell_values(col_idx, r - 1, r)
                        self._clear_cell_widgets(col_idx, insert_at)

                        self.resize_popup()
                        self.build_table()
                        self.after_idle(self._update_scroll_region)
                        self._refresh_insert_menu_choices()
                        self._refresh_column_combo_choices()

        # Clean up selections; restore viewport
        try:
            for w in self.text_widgets:
                w.tag_remove("sel", "1.0", "end")
                w.tag_remove("highlight_selected", "1.0", "end")
        except Exception:
            pass
        try:
            self.scroll_canvas.yview_moveto(y0)
        except Exception:
            pass

    def on_delete_selected_row(self):
        # Parse row
        if self.num_rows <= 1 and (getattr(self, "column_scope_combo", None) and self.column_scope_combo.get() == "All columns"):
            messagebox.showwarning("Cannot Delete", "At least one row must remain.")
            return

        try:
            val = self.insert_before_combo.get().strip()
            before_n = int(val) if val else 1
        except Exception:
            before_n = 1
        before_n = max(1, min(before_n, self.num_rows))
        del_at = before_n - 1

        col_scope = getattr(self, "column_scope_combo", None)
        col_val = col_scope.get().strip() if col_scope else "All columns"

        # Preserve viewport
        try:
            y0, _ = self.scroll_canvas.yview()
        except Exception:
            y0 = 0.0

        if col_val == "All columns":
            # ---- existing ROW DELETE (removes a row) ----
            if self.num_rows <= 1:
                messagebox.showwarning("Cannot Delete", "At least one row must remain.")
                return

            for r in range(del_at, self.num_rows - 1):
                self._copy_row_values(r + 1, r)
            self._clear_row_widgets(self.num_rows - 1)
            self.num_rows -= 1

            self.resize_popup()
            self.build_table()
            self.after_idle(self._update_scroll_region)
            self._refresh_insert_menu_choices()
            self._refresh_column_combo_choices()

            # keep row selection reasonable
            try:
                self.insert_before_combo.set(str(max(1, min(before_n, self.num_rows))))
            except Exception:
                pass

        else:
            # ---- COLUMN-SCOPED CELL DELETE (does NOT change row count) ----
            col_idx = max(0, min(int(col_val) - 1, self.num_cols - 1))
            last_row = self.num_rows - 1

            # Shift up within this column: r+1 -> r
            for r in range(del_at, last_row):
                self._copy_cell_values(col_idx, r + 1, r)

            # Clear last cell in column
            self._clear_cell_widgets(col_idx, last_row)

            # Light refresh
            self.after_idle(self._update_scroll_region)

        # Clean up & restore viewport
        try:
            for w in self.text_widgets:
                w.tag_remove("sel", "1.0", "end")
                w.tag_remove("highlight_selected", "1.0", "end")
        except Exception:
            pass
        try:
            self.scroll_canvas.yview_moveto(y0)
        except Exception:
            pass

        # Optional: focus the product entry at the affected row/column
        try:
            focus_row = min(del_at, self.num_rows - 1)
            focus_col = 0 if col_val == "All columns" else max(0, min(int(col_val) - 1, self.num_cols - 1))
            self.column_data[focus_col]["entries"][focus_row][0].focus_set()
        except Exception:
            pass

    def _snapshot_state(self) -> dict:
        """
        Capture a canonical snapshot of the current UI state for change detection.
        Includes num_rows/cols, date, headers, product text, and directions with [[highlight]] tags.
        """
        snap = {
            "num_rows": self.num_rows,
            "num_cols": self.num_cols,
            "start_date": self.date_entry.get().strip(),
        }

        for c in range(self.num_cols):
            header = self.column_data[c]["header"].get().strip()
            snap[f"Col{c+1}_Header"] = header

            steps = []
            for r in range(self.num_rows):
                product_entry, direction_box = self.column_data[c]["entries"][r]
                product = product_entry.get().strip()
                directions = self.extract_text_with_highlight(direction_box).strip()
                steps.append({"product": product, "directions": directions})

            snap[f"Col{c+1}"] = steps

        return snap


    def _is_dirty(self) -> bool:
        """Compare current state to the initial snapshot."""
        try:
            return self._snapshot_state() != getattr(self, "_initial_snapshot", None)
        except Exception:
            # If anything goes wrong, play it safe and ask for confirmation.
            return True
