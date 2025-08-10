import customtkinter as ctk
from customtkinter import CTkImage
from tkinter import ttk, messagebox
from PIL import Image, ImageTk
from class_elements.treeview_styling_light import style_treeview_light
import os, json, sqlite3, shutil, re, textwrap
from pdf2image import convert_from_path
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from datetime import datetime
from utils.path_utils import resource_path
from class_elements.pdf_generators.pdf_2col import Pdf2ColGenerator
from class_elements.pdf_generators.pdf_3col import Pdf3ColGenerator
from class_elements.pdf_generators.pdf_4col import Pdf4ColGenerator
from class_elements.pdf_generators.prescription_entry_popup import PrescriptionEntryPopup
from class_elements.PdfRenderThread import PdfRenderWorker


class PrescriptionsPage:
    def __init__(self, parent, main_app, data_manager):
        self.main_app = main_app
        self.data_manager = data_manager
        self.appointment_id = None
        self.current_prescription_id = None
        self.pdf_render_worker = PdfRenderWorker(self.display_rendered_pdf)
        self.pdf_2col = Pdf2ColGenerator(data_manager)
        self.pdf_3col = Pdf3ColGenerator(data_manager)
        self.pdf_4col = Pdf4ColGenerator(data_manager)

        self.prescription_paths = {}  # {iid: filepath}

        # Main container
        main_frame = ctk.CTkFrame(parent)
        main_frame.pack(fill="both", expand=True, padx=10)

        # Configure Grid Layout
        main_frame.columnconfigure(0, weight=0, minsize=400)  # Treeview
        main_frame.columnconfigure(1, weight=1)  # Prescription + Create button
        main_frame.columnconfigure(2, weight=0)  # Edit button
        main_frame.columnconfigure(3, weight=0)  # Delete button
        main_frame.columnconfigure(4, weight=0)  # Preview PDF button
        main_frame.columnconfigure(5, weight=0)  # Print button
        # main_frame.columnconfigure(6, weight=0)  # Alert button
        main_frame.columnconfigure(6, weight=0)  # Copy button
        main_frame.rowconfigure(0, weight=0)
        main_frame.rowconfigure(1, weight=1)  # PDF preview row

        # Treeview Frame (Past Prescriptions)
        treeview_frame = ctk.CTkFrame(main_frame)
        treeview_frame.grid(row=0, rowspan=2, column=0, sticky="nsew", padx=(0, 5))

        # Apply treeview styling
        style_treeview_light("Prescriptions.Treeview")

        # Grid layout in treeview_frame
        treeview_frame.rowconfigure(0, weight=1)
        treeview_frame.rowconfigure(1, weight=0)  # Scrollbar
        treeview_frame.columnconfigure(0, weight=1)

        # Style and Treeview
        self.prescription_list = ttk.Treeview(treeview_frame, selectmode="browse", show="headings", style="Prescriptions.Treeview")
        self.prescription_list["columns"] = ("date", "template")
        self.prescription_list.heading("date", text="Start Date")
        self.prescription_list.heading("template", text="Template")
        self.prescription_list.column("date", width=90, anchor="center")
        self.prescription_list.column("template", width=90, anchor="center")
        self.prescription_list.grid(row=0, rowspan=2, column=0, sticky="nsew")
        self.prescription_list.bind("<<TreeviewSelect>>", self.on_prescription_select)
        self.prescription_list.bind("<Double-1>", self.edit_prescription)

        # Scrollbar for Treeview
        scrollbar = ttk.Scrollbar(treeview_frame, orient="vertical", command=self.prescription_list.yview, style="Vertical.TScrollbar")
        scrollbar.grid(row=0, column=1, sticky="ns")
        self.prescription_list.configure(yscrollcommand=scrollbar.set)

        # Button row above PDF preview
        button_row_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        button_row_frame.grid(row=0, column=1, columnspan=6, sticky="nw", padx=5, pady=(0, 5))

        # Configure columns for equal spacing
        for i in range(6):
            button_row_frame.columnconfigure(i, weight=1)

        add_img = CTkImage(Image.open(resource_path("icons/add.png")), size=(24, 24))
        edit_img = CTkImage(Image.open(resource_path("icons/edit_document.png")), size=(24, 24))
        delete_img = CTkImage(Image.open(resource_path("icons/delete.png")), size=(24, 24))
        preview_img = CTkImage(Image.open(resource_path("icons/preview.png")), size=(24, 24))
        print_img = CTkImage(Image.open(resource_path("icons/print.png")), size=(24, 24))
        # alert_img = CTkImage(Image.open(resource_path("icons/alert.png")), size=(24, 24))
        copy_img = CTkImage(Image.open(resource_path("icons/copy_file.png")), size=(24, 24))


        # Create buttons in a row
        button_specs = [
            ("New", self.create_prescription, add_img),
            ("Edit", self.edit_prescription, edit_img),
            ("Delete", self.delete_prescription, delete_img),
            ("Preview", self.preview_prescription, preview_img),
            ("Print", self.print_prescription, print_img),
            # ("Alert", self.set_alert, alert_img),
            ("Copy", self.copy_file, copy_img)
        ]

        for i, (text, command, image) in enumerate(button_specs):
            button = ctk.CTkButton(
                button_row_frame,
                text=text,
                image=image,
                compound="left",
                width=100,
                command=command
            )
            button.grid(row=0, column=i, sticky="ew", padx=5, pady=(0, 5))

        # === Prescription Display Area (Editable or PDF Preview Placeholder) ===
        display_frame = ctk.CTkFrame(main_frame, fg_color="#563A9C")
        display_frame.grid(row=1, column=1, columnspan=6, sticky="nsew", padx=5)

        ctk.CTkLabel(display_frame, text="Current Prescription", font=("Helvetica", 16, "bold"),
                    fg_color="transparent", text_color="#ebebeb").pack()

        # === Scrollable Frame for PDF Preview ===
        self.scroll_canvas = ctk.CTkCanvas(display_frame, highlightthickness=0, bg="#ebebeb")
        self.scroll_canvas.pack(fill="both", expand=True, padx=5, pady=(0, 5))

        # Hidden Scrollbar (not placed in layout)
        scrollbar = ctk.CTkScrollbar(display_frame, orientation="vertical", command=self.scroll_canvas.yview)
        scrollbar.configure(border_spacing=0)

        # Still connect canvas to scrollbar for yview tracking
        self.scroll_canvas.configure(yscrollcommand=scrollbar.set)

        # === Internal Frame inside Canvas ===
        self.preview_inner_frame = ctk.CTkFrame(self.scroll_canvas, fg_color="#ebebeb")
        self.scroll_window = self.scroll_canvas.create_window((0, 0), window=self.preview_inner_frame, anchor="nw")

        # === Scroll Region & Mouse Events ===
        self.preview_inner_frame.bind("<Configure>", self._update_scroll_region)
        self._bind_mousewheel_events()


    def _sanitize_for_path(self, s: str) -> str:
        """Make a client name safe for use in folder names."""
        s = s.strip()
        s = re.sub(r"\s+", "_", s)          # spaces -> underscores
        s = re.sub(r"[^\w\-\.]", "", s)     # remove illegal/special chars
        return s


    def copy_file(self):
        """Open a popup window for copying a prescription to another client."""
        print(f"Inside copy_file - current Prescription ID: {self.current_prescription_id}")

        if not self.current_prescription_id:
            print("No prescription selected. Cannot open popup.")
            return

        # CREATE POP-UP WINDOW
        self.appointment_window = ctk.CTkToplevel()
        self.appointment_window.title("Copy Prescription")
        self.appointment_window.geometry("540x120")
        self.appointment_window.resizable(True, True)

        # Make modal
        self.appointment_window.transient(self.main_app)
        self.appointment_window.grab_set()
        self.appointment_window.focus_force()

        # Configure popup layout
        self.appointment_window.grid_rowconfigure(0, weight=1)
        self.appointment_window.grid_columnconfigure(0, weight=1)

        # Main frame
        self.pop_main_frame = ctk.CTkFrame(self.appointment_window)
        self.pop_main_frame.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        self.pop_main_frame.grid_rowconfigure(0, weight=0)  # top client selector
        self.pop_main_frame.grid_rowconfigure(1, weight=1)  # rest of body
        self.pop_main_frame.grid_columnconfigure(0, weight=1)

        # === Top selection strip ===
        search_frame = ctk.CTkFrame(self.pop_main_frame, fg_color="#563A9C")
        search_frame.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        search_frame.columnconfigure(1, weight=1)

        search_label = ctk.CTkLabel(
            search_frame,
            text="Select Client to Copy To:",
            font=("Helvetica", 14, "bold"),
            fg_color="transparent",
            text_color="#ebebeb"
        )
        search_label.grid(row=0, column=0, sticky="w", padx=10)

        self.copy_client_var = ctk.StringVar(value="Select a client...")
        self.copy_client_combobox = ctk.CTkComboBox(
            search_frame,
            variable=self.copy_client_var,
            values=[],
            command=self.on_client_selected,
            width=220,
            text_color="#797e82"
        )
        self.copy_client_combobox.grid(row=0, column=1, sticky="ew", padx=8, pady=6)

        # Keybinds
        self.copy_client_combobox.bind("<KeyRelease>", self.filter_clients)
        self.copy_client_combobox.bind("<FocusOut>", self.restore_placeholder)
        self.copy_client_combobox.bind("<Button-1>", self.clear_placeholder)
        self.copy_client_combobox.bind("<FocusIn>", self.clear_placeholder)


    # =====================
    # Combobox Functions
    # =====================

    def on_client_selected(self, selected_client):
        """Copy the currently selected prescription to the chosen client (DB + PDF) and update UI if needed."""

        # UI: placeholder behavior
        if not selected_client or selected_client == "No matches found":
            self.copy_client_combobox.configure(text_color="#797e82")
            self.copy_client_combobox.set("Select a client...")
            return

        # Resolve target client_id
        with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM clients WHERE full_name = ?", (selected_client,))
            row = cursor.fetchone()

        if not row:
            print("Could not resolve client from selection.")
            return

        target_client_id = int(row[0])

        # Validate current prescription
        if not getattr(self, "current_prescription_id", None):
            print("No prescription selected to copy.")
            return

        source_prescription_id = int(self.current_prescription_id)

        # Read source prescription
        with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT form_type, file_path, data_json, start_date
                FROM prescriptions
                WHERE id = ?
            """, (source_prescription_id,))
            src = cursor.fetchone()

        if not src:
            print("Source prescription not found.")
            return

        form_type, src_path, data_json, src_start_date = src
        if not src_path or not os.path.exists(src_path):
            print("Source PDF file missing; cannot copy.")
            return

        # Start date for new copy (keep today's date; or swap to src_start_date to preserve original)
        new_start_date = datetime.today().strftime("%m/%d/%Y")

        # Insert new row with empty file_path
        with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO prescriptions (client_id, form_type, file_path, data_json, start_date)
                VALUES (?, ?, ?, ?, ?)
            """, (target_client_id, form_type, "", data_json, new_start_date))
            new_prescription_id = cursor.lastrowid

            # --- Build destination folder + filename ---
            # Folder: SkinProData/prescriptions/<ClientName>_<ClientID>/
            safe_client_name = re.sub(r"[^\w\s-]", "", selected_client).strip()   # remove special chars
            safe_client_name = re.sub(r"\s+", "_", safe_client_name)              # spaces -> underscores
            dest_dir = os.path.join(
                self.main_app.data_manager.prescriptions_dir,
                f"{safe_client_name}_{target_client_id}"
            )
            os.makedirs(dest_dir, exist_ok=True)

            # Filename: <DATE>_<form_type>.pdf (DATE mirrors DB start_date) — normalize + pick next free suffix
            try:
                date_for_filename = datetime.strptime(new_start_date, "%m/%d/%Y").strftime("%m-%d-%Y")
            except Exception:
                date_for_filename = datetime.today().strftime("%m-%d-%Y")

            ft_norm_map = {"2-column": "2-col", "3-column": "3-col", "4-column": "4-col"}
            form_type_filename = ft_norm_map.get(form_type.lower().strip(), form_type)

            base_name = f"{date_for_filename}_{form_type_filename}"
            ext = ".pdf"

            # Gather used suffixes in dest_dir (0 means no suffix)
            pattern = re.compile(rf"^{re.escape(base_name)}(?: \((\d+)\))?{re.escape(ext)}$", re.IGNORECASE)
            used = set()
            src_abs = os.path.normcase(os.path.abspath(src_path))

            for fname in os.listdir(dest_dir):
                m = pattern.match(fname)
                if m:
                    n = int(m.group(1)) if m.group(1) else 0
                    used.add(n)

            # Pick the smallest n >= 0 that is unused and not the source path
            n = 0
            while True:
                candidate = base_name + ("" if n == 0 else f" ({n})") + ext
                cand_path = os.path.join(dest_dir, candidate)
                if n not in used and os.path.normcase(os.path.abspath(cand_path)) != src_abs:
                    dest_path = cand_path
                    break
                n += 1

            # Copy PDF
            shutil.copy2(src_path, dest_path)

            # Update DB with the real file path
            cursor.execute("""
                UPDATE prescriptions
                SET file_path = ?
                WHERE id = ?
            """, (dest_path, new_prescription_id))
            conn.commit()

        print(f"Copied prescription {source_prescription_id} → new {new_prescription_id} for client {target_client_id}")
        print(f"Saved PDF: {dest_path}")

        # If we copied to the SAME client currently displayed, refresh and select the new one
        try:
            active_client_id = getattr(self.main_app.profile_card, "client_id", None)
            if active_client_id == target_client_id:
                self.load_prescriptions_for_client(target_client_id, select_id=new_prescription_id)
        except Exception as e:
            print(f"Post-copy UI refresh skipped due to error: {e}")

        # --- Show success banner in popup ---
        success_frame = ctk.CTkFrame(self.pop_main_frame)
        success_frame.grid(row=2, column=0, sticky="ew", padx=10, pady=10)
        success_frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            success_frame,
            text=f"Copied to {selected_client}!",
            text_color="#155724",
            font=("Helvetica", 14, "bold")
        ).grid(row=0, column=0, sticky="w", padx=10, pady=6)

        ctk.CTkButton(
            success_frame,
            text="Close",
            command=self.appointment_window.destroy
        ).grid(row=0, column=1, padx=10, pady=6)


    def filter_clients(self, event):
        """Dynamically update the client dropdown based on user input."""
        query = self.copy_client_combobox.get().strip()
        if query:
            self.copy_client_combobox.configure(text_color="#000000")
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT full_name FROM clients WHERE full_name LIKE ? LIMIT 10", (f"%{query}%",))
                matches = [row[0] for row in cursor.fetchall()]
            self.copy_client_combobox.configure(values=matches if matches else ["No matches found"])
        else:
            self.copy_client_combobox.configure(values=[])
        self.copy_client_combobox.focus()


    def restore_placeholder(self, event=None):
        """Restore the placeholder text if no valid client is selected when focus is lost."""
        current_text = self.copy_client_var.get().strip()
        if not current_text or current_text == "No matches found":
            self.copy_client_combobox.set("Select a client...")
            self.copy_client_combobox.configure(text_color="#797e82")


    def clear_placeholder(self, event=None):
        """Clear the placeholder text when the user clicks or focuses on the combobox."""
        if self.copy_client_var.get() == "Select a client...":
            self.copy_client_combobox.set("")
            self.copy_client_combobox.configure(text_color="#797e82")


    def create_prescription(self):
        client_id = getattr(self.main_app.profile_card, "client_id", None)

        if not client_id:
            messagebox.showwarning("Warning", "Please select a client first.")
            return

        PrescriptionEntryPopup(
            self.main_app,
            self.handle_prescription_submission,
            client_id,
            self.main_app.data_manager  # Pass this instead of cursor
        )


    def handle_prescription_submission(self, pdf_path, data):
        start_date = data.get("start_date") or datetime.today().strftime("%m/%d/%Y")
        num_columns = sum(1 for key in data if key.startswith("Col") and "_Header" in key)
        form_type = f"{num_columns}-column"
        client_id = getattr(self.main_app.profile_card, "client_id", None)

        if not client_id:
            print("No client selected.")
            return

        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO prescriptions (client_id, form_type, file_path, data_json, start_date)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    client_id,
                    form_type,
                    pdf_path,
                    json.dumps(data),
                    start_date
                ))

                prescription_id = cursor.lastrowid
                conn.commit()

            # Add to Treeview
            iid = self.prescription_list.insert(
                "", "end",
                iid=str(prescription_id),
                values=(start_date, form_type)
            )
            self.prescription_paths[str(prescription_id)] = pdf_path
            self.prescription_list.selection_set(iid)
            self.render_pdf_to_preview(pdf_path)

        except Exception as e:
            print(f"Failed to save prescription: {e}")


    def load_prescriptions_for_client(self, client_id, select_id=None):
        self.clear_prescriptions_list()

        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, form_type, file_path, start_date FROM prescriptions
                    WHERE client_id = ?
                    ORDER BY start_date DESC
                """, (client_id,))
                prescriptions = cursor.fetchall()

            for index, pres in enumerate(prescriptions):
                pres_id, form_type, file_path, start_date = pres

                tag = 'alternate' if index % 2 == 1 else None
                created_date = start_date if os.path.exists(file_path) else "Unknown"

                iid = self.prescription_list.insert(
                    "", "end",
                    iid=str(pres_id),
                    values=(created_date, form_type),
                    tags=(tag,)
                )
                self.prescription_paths[iid] = file_path

            # Select requested item if provided, else default to first row
            if select_id is not None and self.prescription_list.exists(str(select_id)):
                iid = str(select_id)
                self.prescription_list.selection_set(iid)
                self.prescription_list.see(iid)
                path = self.prescription_paths.get(iid)
                if path and os.path.exists(path):
                    self.pdf_render_worker.render_async(path)
            else:
                children = self.prescription_list.get_children()
                if children:
                    self.prescription_list.selection_set(children[0])
                    self.on_prescription_select(None)

            # Clear preview frame (in case no selection rendered anything)
            for widget in self.preview_inner_frame.winfo_children():
                widget.destroy()

            self.prescription_list.tag_configure('alternate', background='#b3b3b3')

        except Exception as e:
            print(f"Failed to load prescriptions for client {client_id}: {e}")


    def clear_prescriptions_list(self):
        """Clear the prescription list and internal state."""
        self.prescription_list.delete(*self.prescription_list.get_children())
        self.prescription_paths.clear()

        # Clear previous image
        for widget in self.preview_inner_frame.winfo_children():
            widget.destroy()


    def add_prescription_to_list(self, date, template, path):
        iid = self.prescription_list.insert("", "end", values=(date, template))
        self.prescription_paths[iid] = path


    def edit_prescription(self, event=None):
        selected = self.prescription_list.selection()
        if not selected:
            print("No prescription selected for editing.")
            return

        iid = selected[0]  # This is the prescription ID (as string)
        prescription_id = int(iid)

        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT data_json, file_path, form_type
                    FROM prescriptions
                    WHERE id = ?
                """, (prescription_id,))
                result = cursor.fetchone()

            if not result:
                print("Prescription not found in database.")
                return

            data_json, original_path, form_type = result
            parsed_data = json.loads(data_json)

            # Open the popup with existing data
            PrescriptionEntryPopup(
                self.main_app,
                lambda updated_path, updated_data: self.handle_edit_submission(prescription_id, updated_path, updated_data),
                getattr(self.main_app.profile_card, "client_id", None),
                data_manager=self.main_app.data_manager,
                initial_data=parsed_data,
                original_path=original_path
            )

        except Exception as e:
            print(f"Failed to load prescription for editing: {e}")


    def handle_edit_submission(self, prescription_id, updated_path, updated_data):
        try:
            form_type = f"{sum(1 for key in updated_data if key.startswith('Col') and '_Header' in key)}-column"
            start_date = updated_data.get("start_date")

            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE prescriptions
                    SET form_type = ?, file_path = ?, data_json = ?, start_date = ?
                    WHERE id = ?
                """, (
                    form_type,
                    updated_path,
                    json.dumps(updated_data),
                    start_date,
                    prescription_id
                ))
                conn.commit()

            # Update Treeview visually
            if self.prescription_list.exists(str(prescription_id)):
                self.prescription_list.item(str(prescription_id), values=(
                    start_date,
                    form_type
                ))
                self.prescription_paths[str(prescription_id)] = updated_path
                self.render_pdf_to_preview(updated_path)

            print("Prescription updated successfully.")

        except Exception as e:
            print(f"Failed to update prescription: {e}")


    def delete_prescription(self, event=None):
        """Delete the selected prescription from the database and file system after confirmation."""
        selected_item = self.prescription_list.selection()

        if not selected_item:
            print("⚠ No prescription selected for deletion.")
            return

        iid = selected_item[0]
        pdf_path = self.prescription_paths.get(iid)

        # Create Confirmation Pop-up
        confirmation = ctk.CTkToplevel()
        confirmation.title("Confirm Deletion")
        confirmation.geometry("350x150")
        confirmation.resizable(False, False)

        # Lock interaction to this pop-up
        confirmation.transient(self.main_app)
        confirmation.grab_set()
        confirmation.focus_force()

        # Main Frame
        main_frame = ctk.CTkFrame(confirmation)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Confirmation Message
        ctk.CTkLabel(
            main_frame,
            text="Are you sure you want to delete this prescription?",
            font=("Helvetica", 14),
            wraplength=300
        ).pack(pady=(25, 10))

        # Buttons Frame
        button_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        button_frame.pack(pady=10)

        # Cancel Button
        ctk.CTkButton(button_frame, text="Cancel", command=confirmation.destroy).pack(side="left", padx=5)

        # Delete Button
        ctk.CTkButton(
            button_frame, text="Delete", fg_color="#FF4444", hover_color="#CC0000",
            command=lambda: self._execute_delete_prescription(iid, pdf_path, confirmation)
        ).pack(side="right", padx=5)


    def _execute_delete_prescription(self, iid, pdf_path, confirmation_window):
        try:
            # Delete the PDF file
            if pdf_path and os.path.exists(pdf_path):
                os.remove(pdf_path)
                print(f"🗑️ Deleted PDF file: {pdf_path}")

                # Delete folder if empty
                folder = os.path.dirname(pdf_path)
                if os.path.exists(folder) and not os.listdir(folder):
                    os.rmdir(folder)
                    print(f"🗑️ Deleted empty folder: {folder}")

            # Delete from database
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM prescriptions WHERE file_path = ?", (pdf_path,))
                conn.commit()

            # Remove from Treeview and internal state
            self.prescription_list.delete(iid)
            del self.prescription_paths[iid]

            # Clear the PDF preview/render frame
            for widget in self.preview_inner_frame.winfo_children():
                widget.destroy()

            print("Prescription successfully deleted.")

        except Exception as e:
            print(f"Failed to delete prescription: {e}")

        finally:
            confirmation_window.destroy()


    def preview_prescription(self):
        selected = self.prescription_list.selection()
        if not selected:
            print("No prescription selected.")
            return

        iid = selected[0]
        pdf_path = self.prescription_paths.get(iid)

        if not pdf_path or not os.path.exists(pdf_path):
            print("PDF file not found for preview.")
            return

        # Open popout window
        self.open_pdf_popup(pdf_path)


    def open_pdf_popup(self, pdf_path):
        popup = ctk.CTkToplevel()
        popup.title("Full Size PDF Preview")

        popup_width = int(850 * 0.7)
        popup_height = int(1100 * 0.7)
        popup.geometry(f"{popup_width}x{popup_height}")
        popup.configure(fg_color="#ebebeb")

        # Lock interaction to this window only
        popup.grab_set()

        try:
            pages = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=1)

            if pages:
                image = pages[0]

                # Resize the image to exactly match popup size
                resized_image = image.resize((popup_width, popup_height), Image.LANCZOS)

                # Properly use CTkImage here
                ctk_image = CTkImage(light_image=resized_image, dark_image=resized_image, size=(popup_width, popup_height))

                # Use CTkLabel with CTkImage
                label = ctk.CTkLabel(popup, image=ctk_image, text="")
                label.image = ctk_image  # Keep a reference to prevent garbage collection
                label.pack(fill="both", expand=True, padx=0, pady=0)

                print(f"PDF displayed at {popup_width}x{popup_height}px.")
            else:
                print("No pages found in PDF.")

        except Exception as e:
            print(f"Failed to load PDF for popup: {e}")


    def print_prescription(self):
        selected = self.prescription_list.selection()
        if not selected:
            print("No prescription selected.")
            return

        iid = selected[0]
        pdf_path = self.prescription_paths.get(iid)

        if not pdf_path or not os.path.exists(pdf_path):
            print("PDF file not found.")
            return

        try:
            # Windows: send to default printer
            os.startfile(pdf_path, "print")
            print("Sent to printer.")
        except Exception as e:
            print(f"Failed to print via os.startfile(): {e}")
            try:
                # Fallback: open the file instead
                os.startfile(pdf_path)
                print("Opened PDF for manual printing.")
            except Exception as e2:
                print(f"Failed to open PDF as fallback: {e2}")


    # def set_alert(self):
    #     current_client_id = self.main_app.profile_card.client_id  # or however you store it
    #     self.main_app.tabs["Alerts"].create_proxy_alert(current_client_id)
  

    def render_pdf_to_preview(self, pdf_path):
        # Launch threaded PDF rendering to keep UI responsive
        self.pdf_render_worker.render_async(pdf_path)


    def display_rendered_pdf(self, image):
        # Must run UI updates on main thread
        def update():
            ctk_image = CTkImage(light_image=image, size=image.size)

            # Clear previous image
            for widget in self.preview_inner_frame.winfo_children():
                widget.destroy()

            label = ctk.CTkLabel(self.preview_inner_frame, image=ctk_image, text="", fg_color="#ebebeb")
            label.image = ctk_image
            label.pack()

            print("PDF rendered in background and updated UI.")

        self.main_app.after(0, update)


    def on_prescription_select(self, event):
        selected = self.prescription_list.selection()
        if selected:
            iid = selected[0]
            # Track current selection for features like Copy
            try:
                self.current_prescription_id = int(iid)
            except ValueError:
                self.current_prescription_id = None

            path = self.prescription_paths.get(iid)
            if path and os.path.exists(path):
                self.pdf_render_worker.render_async(path)



    def _update_scroll_region(self, event):
        self.scroll_canvas.configure(scrollregion=self.scroll_canvas.bbox("all"))


    def _on_mousewheel(self, event):
        self.scroll_canvas.yview_scroll(-1 * (event.delta // 120), "units")


    def _bind_mousewheel_events(self):
        self.scroll_canvas.bind("<Enter>", lambda e: self.scroll_canvas.bind_all("<MouseWheel>", self._on_mousewheel))
        self.scroll_canvas.bind("<Leave>", lambda e: self.scroll_canvas.unbind_all("<MouseWheel>"))
