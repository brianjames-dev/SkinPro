import customtkinter as ctk
from customtkinter import CTkImage
from tkinter import ttk
from PIL import Image, ImageTk
from class_elements.treeview_styling_light import style_treeview_light
import os
from pdf2image import convert_from_path
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from datetime import datetime
import textwrap
from tkinter import messagebox
from prescriptions.pdf_generators.pdf_2col import Pdf2ColGenerator
from prescriptions.pdf_generators.pdf_3col import Pdf3ColGenerator
from prescriptions.pdf_generators.pdf_4col import Pdf4ColGenerator
from prescriptions.pdf_generators.prescription_entry_popup import PrescriptionEntryPopup
from PdfRenderThread import PdfRenderWorker
import json


class PrescriptionsPage:
    def __init__(self, parent, conn, main_app):
        self.conn = conn
        self.cursor = conn.cursor() if conn else None
        self.main_app = main_app
        self.appointment_id = None
        self.current_prescription_id = None
        self.pdf_render_worker = PdfRenderWorker(self.display_rendered_pdf)
        self.pdf_2col = Pdf2ColGenerator()
        self.pdf_3col = Pdf3ColGenerator()
        self.pdf_4col = Pdf4ColGenerator()

        self.prescription_paths = {}  # {iid: filepath}

        # Main container
        main_frame = ctk.CTkFrame(parent)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Configure Grid Layout
        main_frame.columnconfigure(0, weight=1)  # Treeview
        main_frame.columnconfigure(1, weight=0)  # Prescription display + Create button
        main_frame.columnconfigure(2, weight=0)  # Edit button
        main_frame.columnconfigure(3, weight=0)  # Delete button
        main_frame.columnconfigure(4, weight=0)  # Preview PDF button
        main_frame.columnconfigure(5, weight=0)  # Print button
        main_frame.columnconfigure(6, weight=0)  # Alert button
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

        add_img = ctk.CTkImage(Image.open("icons/add.png"), size=(24, 24))
        edit_img = ctk.CTkImage(Image.open("icons/edit_document.png"), size=(24, 24))
        delete_img = ctk.CTkImage(Image.open("icons/delete.png"), size=(24, 24))
        preview_img = ctk.CTkImage(Image.open("icons/preview.png"), size=(24, 24))
        print_img = ctk.CTkImage(Image.open("icons/print.png"), size=(24, 24))
        alert_img = ctk.CTkImage(Image.open("icons/alert.png"), size=(24, 24))

        # Create buttons in a row
        button_specs = [
            ("New", self.create_prescription, add_img),
            ("Edit", self.edit_prescription, edit_img),
            ("Delete", self.delete_prescription, delete_img),
            ("Preview", self.preview_prescription, preview_img),
            ("Print", self.print_prescription, print_img),
            ("Alert", self.set_alert, alert_img)
        ]

        for i, (text, command, image) in enumerate(button_specs):
            button = ctk.CTkButton(
                button_row_frame,
                text=text,
                image=image,
                compound="left",  # ← Image on the left, text on the right
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
        self.scroll_canvas = ctk.CTkCanvas(display_frame, highlightthickness=0)
        self.scroll_canvas.pack(fill="both", expand=True, padx=5, pady=(0, 5))

        # Hidden Scrollbar (not placed in layout)
        scrollbar = ctk.CTkScrollbar(display_frame, orientation="vertical", command=self.scroll_canvas.yview)
        scrollbar.configure(border_spacing=0)

        # Still connect canvas to scrollbar for yview tracking
        self.scroll_canvas.configure(yscrollcommand=scrollbar.set)

        # === Internal Frame inside Canvas ===
        self.preview_inner_frame = ctk.CTkFrame(self.scroll_canvas)
        self.scroll_window = self.scroll_canvas.create_window((0, 0), window=self.preview_inner_frame, anchor="nw")

        # === Scroll Region & Mouse Events ===
        self.preview_inner_frame.bind("<Configure>", self._update_scroll_region)
        self._bind_mousewheel_events()


    def create_prescription(self):
        client_id = getattr(self.main_app.profile_card, "client_id", None)

        if not client_id:
            messagebox.showwarning("Warning", "Please select a client first.")
            return

        cursor = self.conn.cursor()
        PrescriptionEntryPopup(self.main_app, self.handle_prescription_submission, client_id, cursor)


    def handle_prescription_submission(self, pdf_path, data):
        start_date = data.get("start_date") or datetime.today().strftime("%m/%d/%Y")
        num_columns = sum(1 for key in data if key.startswith("Col") and "_Header" in key)
        form_type = f"{num_columns}-column"
        client_id = getattr(self.main_app.profile_card, "client_id", None)

        if not client_id:
            print("❌ No client selected.")
            return

        # Store in DB
        self.cursor.execute("""
            INSERT INTO prescriptions (client_id, form_type, file_path, data_json, start_date)
            VALUES (?, ?, ?, ?, ?)
        """, (
            client_id,
            form_type,
            pdf_path,
            json.dumps(data),
            start_date
        ))

        # Get the inserted row ID
        prescription_id = self.cursor.lastrowid

        self.conn.commit()

        # Add to Treeview
        iid = self.prescription_list.insert(
            "", "end",
            iid=str(prescription_id),
            values=(start_date, form_type)
        )
        self.prescription_paths[str(prescription_id)] = pdf_path
        self.prescription_list.selection_set(iid)
        self.render_pdf_to_preview(pdf_path)


    def load_prescriptions_for_client(self, client_id):
        self.prescription_list.delete(*self.prescription_list.get_children())
        self.prescription_paths.clear()

        self.cursor.execute("""
            SELECT id, form_type, file_path, start_date FROM prescriptions
            WHERE client_id = ?
            ORDER BY start_date DESC
        """, (client_id,))
        prescriptions = self.cursor.fetchall()

        for pres in prescriptions:
            pres_id, form_type, file_path, start_date = pres

            # Example: use file creation/modification time as "date" column value
            if os.path.exists(file_path):
                created_date = start_date
            else:
                created_date = "Unknown"

            iid = self.prescription_list.insert(
                "", "end",
                iid=str(pres_id),
                values=(created_date, form_type)
            )
            self.prescription_paths[iid] = file_path
        
        children = self.prescription_list.get_children()
        if children:
            self.prescription_list.selection_set(children[0])
            self.on_prescription_select(None)


    def add_prescription_to_list(self, date, template, path):
        iid = self.prescription_list.insert("", "end", values=(date, template))
        self.prescription_paths[iid] = path


    def edit_prescription(self, event=None):
        selected = self.prescription_list.selection()
        if not selected:
            print("❌ No prescription selected for editing.")
            return

        iid = selected[0]  # This is the prescription ID (as string)
        prescription_id = int(iid)

        try:
            self.cursor.execute("""
                SELECT data_json, file_path, form_type
                FROM prescriptions
                WHERE id = ?
            """, (prescription_id,))
            result = self.cursor.fetchone()

            if not result:
                print("❌ Prescription not found in database.")
                return

            data_json, original_path, form_type = result
            parsed_data = json.loads(data_json)

            # Open the popup with existing data
            PrescriptionEntryPopup(
                self.main_app,
                lambda updated_path, updated_data: self.handle_edit_submission(prescription_id, updated_path, updated_data),
                getattr(self.main_app.profile_card, "client_id", None),
                self.cursor,
                initial_data=parsed_data,
                original_path=original_path
            )

        except Exception as e:
            print(f"❌ Failed to load prescription for editing: {e}")


    def handle_edit_submission(self, prescription_id, updated_path, updated_data):
        try:
            form_type = f"{sum(1 for key in updated_data if key.startswith('Col') and '_Header' in key)}-column"
            start_date = updated_data.get("start_date")

            self.cursor.execute("""
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
            self.conn.commit()

            # Update Treeview visually
            if self.prescription_list.exists(str(prescription_id)):
                self.prescription_list.item(str(prescription_id), values=(
                    start_date,
                    form_type
                ))
                self.prescription_paths[str(prescription_id)] = updated_path
                self.render_pdf_to_preview(updated_path)

            print("✅ Prescription updated successfully.")

        except Exception as e:
            print(f"❌ Failed to update prescription: {e}")


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

            # Delete from database
            self.cursor.execute("DELETE FROM prescriptions WHERE file_path = ?", (pdf_path,))
            self.conn.commit()

            # Remove from Treeview and internal state
            self.prescription_list.delete(iid)
            del self.prescription_paths[iid]

            print("✅ Prescription successfully deleted.")

        except Exception as e:
            print(f"❌ Failed to delete prescription: {e}")

        finally:
            confirmation_window.destroy()


    def preview_prescription(self):
        selected = self.prescription_list.selection()
        if not selected:
            print("❌ No prescription selected.")
            return

        iid = selected[0]
        pdf_path = self.prescription_paths.get(iid)

        if not pdf_path or not os.path.exists(pdf_path):
            print("❌ PDF file not found for preview.")
            return

        # Open popout window
        self.open_pdf_popup(pdf_path)


    def open_pdf_popup(self, pdf_path):
        popup = ctk.CTkToplevel()
        popup.title("Full Size PDF Preview")

        popup.geometry("850x1100")  # Or adjust to your desired full-size dimensions
        popup.configure(fg_color="#ebebeb")

        # Lock interaction to this window only
        popup.grab_set()

        try:
            pages = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=1)

            if pages:
                image = pages[0]
                image = image.resize((850, int(850 * 11 / 8.5)))  # Maintain letter ratio
                tk_image = ImageTk.PhotoImage(image)

                label = ctk.CTkLabel(popup, image=tk_image, text="")
                label.image = tk_image
                label.pack(padx=10, pady=10)
                print("✅ PDF displayed in popup window.")
            else:
                print("⚠️ No pages found in PDF.")

        except Exception as e:
            print(f"❌ Failed to load PDF for popup: {e}")


    def print_prescription(self):
        selected = self.prescription_list.selection()
        if not selected:
            print("❌ No prescription selected.")
            return

        iid = selected[0]
        pdf_path = self.prescription_paths.get(iid)

        if not pdf_path or not os.path.exists(pdf_path):
            print("❌ PDF file not found.")
            return

        try:
            # For Windows
            os.startfile(pdf_path, "print")
            print("🖨️ Sent to printer.")
        except Exception as e:
            print(f"❌ Failed to print: {e}")


    def set_alert(self):
        print("🔔 Set reminder alert")
  

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

            print("✅ PDF rendered in background and updated UI.")

        self.main_app.after(0, update)


    def on_prescription_select(self, event):
        selected = self.prescription_list.selection()
        if selected:
            iid = selected[0]
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
