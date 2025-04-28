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

        self.button_frame.columnconfigure((0, 1, 2, 3, 4), weight=0)

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
                    selectforeground="#FFFFFF"
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


    def add_column(self):
        if self.num_cols < self.MAX_COLS:
            self.num_cols += 1
            self.resize_popup()
            self.build_table()
            self.after_idle(self._update_scroll_region)


    def delete_row(self):
        if self.num_rows > 1:
            self.num_rows -= 1
            self.resize_popup()
            self.build_table()
            self.after_idle(self._update_scroll_region)


    def delete_column(self):
        if self.num_cols > 2:
            self.num_cols -= 1
            self.resize_popup()
            self.build_table()
            self.after_idle(self._update_scroll_region)


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

        print(f"🟡 Extracted with highlight: {repr(output.strip())}")
        return output.strip()


    def on_create(self):
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

        print("✅ Collected Prescription:")
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
        print(f"✅ PDF generated at: {pdf_path}")
        
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
                print(f"🟢 Inserting normal text: {repr(normal_text)}")
                text_widget.insert("end", normal_text)

            # Insert highlighted text and apply tag
            start_idx = text_widget.index("insert")
            text_widget.insert("insert", highlighted_text)
            end_idx = text_widget.index("insert")
            text_widget.tag_add("highlight", start_idx, end_idx)
            text_widget.tag_config("highlight", background="yellow", foreground="black")
            print(f"🟡 Highlighted: {repr(highlighted_text)} from {start_idx} to {end_idx}")

            has_any_highlight = True
            last_end = end

        # Insert any remaining plain text after the last highlight
        if last_end < len(content):
            tail = content[last_end:]
            print(f"🔵 Inserting trailing text: {repr(tail)}")
            text_widget.insert("end", tail)

        if not has_any_highlight:
            print("⚠️ No highlight tags found in this content.")


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


    def highlight_current_selection(self):
        self.update_idletasks()
        widget = getattr(self, 'last_focused_widget', None)

        if not widget:
            print("⚠️ No focused text widget found.")
            return

        try:
            start = widget.index("sel.first")
            end = widget.index("sel.last")

            if start == end:
                print("⚠️ Empty selection. Nothing to highlight or dehighlight.")
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
                print(f"❎ De-highlighted: {widget.get(start, end)} from {start} to {end}")
            else:
                widget.tag_add("highlight", start, end)
                widget.tag_config("highlight", background="yellow", foreground="black")
                print(f"✅ Highlighted: {widget.get(start, end)} from {start} to {end}")

            # Remove selection coloring immediately after toggling
            widget.tag_remove("sel", "1.0", "end")
            widget.tag_remove("highlight_selected", "1.0", "end")

        except Exception as e:
            print(f"❌ Failed to toggle highlight: {e}")
