import customtkinter as ctk
from customtkinter import CTkImage
from tkinter import ttk
from PIL import Image, ImageTk
from class_elements.treeview_styling import style_treeview
import os
from pdf2image import convert_from_path
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from datetime import datetime
import textwrap
from prescriptions.pdf_generators.pdf_2col import Pdf2ColGenerator
from prescriptions.pdf_generators.pdf_3col import Pdf3ColGenerator
from prescriptions.pdf_generators.pdf_4col import Pdf4ColGenerator



class PrescriptionsPage:
    def __init__(self, parent, conn, main_app):
        self.conn = conn
        self.cursor = conn.cursor() if conn else None
        self.main_app = main_app
        self.client_id = None
        self.appointment_id = None
        self.current_prescription_id = None
        self.pdf_2col = Pdf2ColGenerator()
        self.pdf_3col = Pdf3ColGenerator()
        self.pdf_4col = Pdf4ColGenerator()



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

        # === Scrollable Frame for PDF Preview ===
        self.scroll_canvas = ctk.CTkCanvas(display_frame, bg="#1e1e1e", highlightthickness=0)
        self.scroll_canvas.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        # Scrollbar
        scrollbar = ctk.CTkScrollbar(display_frame, orientation="vertical", command=self.scroll_canvas.yview)
        scrollbar.place(relx=1, rely=0, relheight=1, anchor="ne")

        # Configure canvas
        self.scroll_canvas.configure(yscrollcommand=scrollbar.set)

        # Internal frame inside canvas
        self.preview_inner_frame = ctk.CTkFrame(self.scroll_canvas, fg_color="#1e1e1e")
        self.scroll_window = self.scroll_canvas.create_window((0, 0), window=self.preview_inner_frame, anchor="nw")

        # Bind the <Configure> event to update the scroll region
        self.preview_inner_frame.bind("<Configure>", self._update_scroll_region)

        # Bind mouse wheel events for scrolling
        self._bind_mousewheel_events()

        # Button Column on the Right
        button_column = ctk.CTkFrame(main_frame)
        button_column.grid(row=0, column=2, sticky="ns", padx=(5, 0))

        # Buttons stacked vertically
        button_specs = [
            ("New Prescription", self.create_prescription),
            ("Edit Prescription", self.edit_prescription),
            ("Delete Prescription", self.delete_prescription),
            ("Preview PDF", self.preview_prescription),
            ("Print Prescription", self.print_prescription),
            ("Set Alert", self.set_alert)
        ]

        for text, command in button_specs:
            ctk.CTkButton(button_column, text=text, width=160, command=command).pack(fill="x", pady=(0, 10))


    def create_prescription(self):
        client_name = "Brian James"
        start_date = "03/28/2025"
        data = {
            "Col1": [
                {"product": "Cleanse", "directions": "Use the Ultra Foaming Gel Cleanser with lukewarm water, massaging gently for at least 60 seconds to ensure all debris and buildup are thoroughly removed before patting dry with a clean towel."},
                {"product": "Tone", "directions": "Apply the Balancing Toner generously using a cotton round, making sure to press gently into the skin rather than rubbing, especially around sensitive areas like the cheeks and forehead."},
                {"product": "Serum", "directions": "Dispense 1 to 2 pumps of the Growth Factor serum and distribute evenly over the face and neck. Allow the product to absorb fully before layering additional products."},
                {"product": "Moisturizer", "directions": "Use the Advanced Hydra Serum and press into the skin using the palms of your hands. Focus on drier areas and don’t forget to apply to the jawline and neck."},
                {"product": "SPF", "directions": "Apply a generous amount of Tinted Defense sunscreen 15 minutes before sun exposure. Be sure to reapply throughout the day, especially if perspiring or after towel drying."},
                {"product": "Eye Cream", "directions": "Gently tap a pea-sized amount of the Intensive Eye Cream around the entire orbital bone using your ring finger to avoid tugging on the delicate eye area."},
                {"product": "Lip Treatment", "directions": "Apply the Lip Balm after all other steps. Reapply as needed throughout the day to maintain hydration and protection from environmental stressors."},
                {"product": "Neck Cream", "directions": "Apply the Neck & Decollete Serum in upward sweeping motions. Use morning and night for best results and avoid applying to freshly exfoliated skin."}
            ],
            "Col2": [
                {"product": "Cleanse", "directions": "Use the AQ1 Deep Pore Cleanser in the evening, especially if you have worn makeup or SPF. Perform a double cleanse by starting with Skin Prep, then follow with the cleanser to ensure full removal."},
                {"product": "Mask", "directions": "Apply the Quench Mask 2–3 times a week. Leave on for 10–15 minutes while avoiding eye and lip areas. Rinse thoroughly with cool water and pat dry. Follow with hydrating products immediately."},
                {"product": "Serum", "directions": "Use the Nourishing C&E Serum in the evening, focusing on areas showing pigmentation or sun damage. Allow 5 minutes to absorb before proceeding to next step."},
                {"product": "Night Cream", "directions": "Massage the Night Cream with Collagen & Elastin into the skin using upward strokes. This step is essential to support skin elasticity and deep hydration overnight."},
                {"product": "Spot Treatment", "directions": "Apply BP-9 Cream only on active breakouts or red inflamed areas. Do not overuse as it may cause dryness or irritation. Spot use only, not full-face."},
                {"product": "Hydrating Mist", "directions": "Spritz Hydra-Cool Gel Mist after cleansing and before applying serum. This helps to prep the skin and enhance absorption of active ingredients."},
                {"product": "Retinol Cream", "directions": "Apply a thin layer of Rejuvenating Cream to the entire face, avoiding eyes and lips. Use only at night and follow with moisturizer to reduce dryness."},
                {"product": "Overnight Mask", "directions": "On nights when retinol is not used, apply the Soothing Zinc Gel Mask as the final step. Leave on overnight and rinse off in the morning."}
            ],
            "Col3": [
                {"product": "Cleanse", "directions": "Use the AQ1 Deep Pore Cleanser in the evening, especially if you have worn makeup or SPF. Perform a double cleanse by starting with Skin Prep, then follow with the cleanser to ensure full removal."},
                {"product": "Mask", "directions": "Apply the Quench Mask 2–3 times a week. Leave on for 10–15 minutes while avoiding eye and lip areas. Rinse thoroughly with cool water and pat dry. Follow with hydrating products immediately."},
                {"product": "Serum", "directions": "Use the Nourishing C&E Serum in the evening, focusing on areas showing pigmentation or sun damage. Allow 5 minutes to absorb before proceeding to next step."},
                {"product": "Night Cream", "directions": "Massage the Night Cream with Collagen & Elastin into the skin using upward strokes. This step is essential to support skin elasticity and deep hydration overnight."},
                {"product": "Spot Treatment", "directions": "Apply BP-9 Cream only on active breakouts or red inflamed areas. Do not overuse as it may cause dryness or irritation. Spot use only, not full-face."},
                {"product": "Hydrating Mist", "directions": "Spritz Hydra-Cool Gel Mist after cleansing and before applying serum. This helps to prep the skin and enhance absorption of active ingredients."},
                {"product": "Retinol Cream", "directions": "Apply a thin layer of Rejuvenating Cream to the entire face, avoiding eyes and lips. Use only at night and follow with moisturizer to reduce dryness."},
                {"product": "Overnight Mask", "directions": "On nights when retinol is not used, apply the Soothing Zinc Gel Mask as the final step. Leave on overnight and rinse off in the morning."}
            ],
            "Col1_Header": "Morning",
            "Col2_Header": "Afternoon",
            "Col3_Header": "Evening"
        }

        path = self.pdf_3col.generate(client_name, start_date, data)
        self.render_pdf_to_preview(path)
        self.add_prescription_to_list(datetime.today().strftime("%m/%d/%Y"), "2-column", path)


    def add_prescription_to_list(self, date, template, path):
        iid = self.prescription_list.insert("", "end", values=(date, template))
        self.prescription_paths[iid] = path


    def edit_prescription(self):
        print("✏️ Edit current prescription")


    def delete_prescription(self):
        print("🗑️ Delete prescription")


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
        popup.configure(fg_color="#1e1e1e")

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
        print("🖨️ Print prescription")


    def set_alert(self):
        print("🔔 Set reminder alert")
  

    def render_pdf_to_preview(self, pdf_path):
        try:
            # Convert only the first page to an image
            pages = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=1)

            if pages:
                image = pages[0]

                # Scale image to width=464, keep aspect ratio (Letter ratio is ~1.294)
                display_width = 464
                aspect_ratio = image.height / image.width
                display_height = int(display_width * aspect_ratio)

                # Resize CTkImage
                ctk_image = CTkImage(light_image=image, size=(display_width, display_height))

                # Clear previous image
                for widget in self.preview_inner_frame.winfo_children():
                    widget.destroy()

                label = ctk.CTkLabel(self.preview_inner_frame, image=ctk_image, text="", fg_color="#1e1e1e")
                label.image = ctk_image  # Keep a reference
                label.pack()

                print("✅ PDF rendered inside scrollable frame.")
            else:
                print("⚠️ No pages found in PDF.")
        except Exception as e:
            print(f"❌ Failed to render PDF: {e}")


    def on_prescription_select(self, event):
        selected = self.prescription_list.selection()
        if selected:
            iid = selected[0]
            path = self.prescription_paths.get(iid)
            if path and os.path.exists(path):
                self.render_pdf_to_preview(path)


    def _update_scroll_region(self, event):
        self.scroll_canvas.configure(scrollregion=self.scroll_canvas.bbox("all"))


    def _on_mousewheel(self, event):
        self.scroll_canvas.yview_scroll(-1 * (event.delta // 120), "units")


    def _bind_mousewheel_events(self):
        self.scroll_canvas.bind("<Enter>", lambda e: self.scroll_canvas.bind_all("<MouseWheel>", self._on_mousewheel))
        self.scroll_canvas.bind("<Leave>", lambda e: self.scroll_canvas.unbind_all("<MouseWheel>"))
