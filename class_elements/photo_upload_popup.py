import customtkinter as ctk
from tkinter import filedialog, messagebox
import shutil
import os
from upload_server.qr_helper import generate_upload_qr
from PIL import Image
from customtkinter import CTkImage
import subprocess
import sys
import sqlite3

class PhotoUploadPopup(ctk.CTkToplevel):
    def __init__(self, parent, client_id, appointment_id, appointment_date, client_name, appt_type, main_app):
        super().__init__(parent)
        self.title("Upload Photos")
        self.geometry("300x330")
        self.resizable(False, False)

        self.client_id = client_id
        self.appointment_id = appointment_id
        self.appointment_date = appointment_date
        self.client_name = client_name
        self.appt_type = appt_type
        self.parent = parent
        self.main_app = main_app

        # Lock interaction to this pop-up
        self.transient(main_app)
        self.grab_set()
        self.focus_force()

        # === Main Frame ===
        main_frame = ctk.CTkFrame(self)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Grid setup for layout control
        main_frame.rowconfigure(0, weight=0)   # Title
        main_frame.rowconfigure(1, weight=1)   # QR + status
        main_frame.rowconfigure(2, weight=0)   # Button
        main_frame.columnconfigure(0, weight=1)

        # === Title Label ===
        ctk.CTkLabel(
            main_frame,
            text=f"Add Photos for {client_name}",
            font=("Helvetica", 16, "bold")
        ).grid(row=0, column=0, pady=(10, 5), sticky="n")

        # === QR and status (in sub-frame to center)
        center_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        center_frame.grid(row=1, column=0, sticky="nsew")
        center_frame.columnconfigure(0, weight=1)

        self.qr_label = ctk.CTkLabel(center_frame, text="")
        self.qr_label.grid(row=0, column=0, pady=(10, 10), sticky="n")

        self.status_label = ctk.CTkLabel(center_frame, text="", font=("Helvetica", 12))
        self.status_label.grid(row=1, column=0, pady=(0, 10), sticky="n")

        # === Upload Button pinned to bottom
        ctk.CTkButton(
            main_frame,
            text="Upload Local Photos",
            command=self.upload_local_photos
        ).grid(row=2, column=0, pady=(10, 10), sticky="n")

        # Start polling for uploaded photos
        self.generate_qr()
        self.after(3000, self.check_for_uploaded_photos)


    def upload_local_photos(self):
        # Sanitize folder name
        safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in self.client_name).replace(" ", "_")
        date_formatted = self.appointment_date.replace("/", "-")
        client_folder = os.path.join("images", "before_after", f"{safe_name}_id_{self.client_id}", date_formatted)
        os.makedirs(client_folder, exist_ok=True)

        file_paths = filedialog.askopenfilenames(
            title="Select Photos",
            filetypes=[("Image Files", "*.jpg *.jpeg *.png *.bmp *.gif")]
        )

        if not file_paths:
            return

        for file_path in file_paths:
            filename = os.path.basename(file_path)
            new_path = os.path.join(client_folder, filename)
            counter = 1
            while os.path.exists(new_path):
                name, ext = os.path.splitext(filename)
                new_path = os.path.join(client_folder, f"{name}_{counter}{ext}")
                counter += 1
            shutil.copy(file_path, new_path)
            self.parent.cursor.execute(
                "INSERT INTO photos (client_id, appointment_id, appt_date, file_path, type) VALUES (?, ?, ?, ?, ?)",
                (self.client_id, self.appointment_id, self.appointment_date, new_path, self.appt_type)
            )

        self.parent.cursor.execute("UPDATE appointments SET photos_taken = 'Yes' WHERE id = ?", (self.appointment_id,))
        self.parent.conn.commit()
        messagebox.showinfo("Success", f"{len(file_paths)} photo(s) uploaded successfully.")

        # Refresh UI
        if "Photos" in self.parent.main_app.tabs:
            self.parent.main_app.tabs["Photos"].refresh_photos_list(self.client_id)
        self.parent.load_client_appointments(self.client_id)


    def generate_qr(self):
        self.ensure_server_running()
        qr_path = generate_upload_qr(self.client_id, self.appointment_id)

        try:
            image = Image.open(qr_path)
            self.qr_image = CTkImage(light_image=image, size=(200, 200))
            self.qr_label.configure(image=self.qr_image, text="", corner_radius=10)

        except Exception as e:
            self.qr_label.configure(text="Failed to load QR code image.")
            print(f"❌ Error loading QR code image: {e}")


    def ensure_server_running(self):
        """Launch Flask server in a background subprocess if not already running."""
        if not hasattr(sys, '_flask_server_started'):
            print("🟢 Starting Flask server...")
            subprocess.Popen(["python", "upload_server/server.py"])
            sys._flask_server_started = True


    def check_for_uploaded_photos(self):
        try:
            conn = sqlite3.connect("client_database.db")  # Adjust if needed
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) FROM photos
                WHERE client_id = ? AND appointment_id = ?
            """, (self.client_id, self.appointment_id))
            count = cursor.fetchone()[0]
            conn.close()

            # First run: store initial count
            if not hasattr(self, "initial_photo_count"):
                self.initial_photo_count = count
                self.after(2000, self.check_for_uploaded_photos)
                return

            # If new photos were added
            if count > self.initial_photo_count:
                print(f"📸 Detected {count - self.initial_photo_count} new photos")

                # Prevent future calls
                self._upload_confirmed = True

                # Delay briefly to allow all photos to finish uploading
                self.after(1500, lambda: self.finish_success_popup(count - self.initial_photo_count))
                return

            # No new photos yet — poll again
            if not getattr(self, "_upload_confirmed", False):
                self.after(2000, self.check_for_uploaded_photos)

        except Exception as e:
            print(f"❌ Error checking for uploaded photos: {e}")
            self.after(3000, self.check_for_uploaded_photos)


    def finish_success_popup(self, num_uploaded):
        messagebox.showinfo("Upload Complete", f"{num_uploaded} photo(s) uploaded successfully!")

        # Refresh both views
        self.main_app.tabs["Photos"].refresh_photos_list(self.client_id)
        self.main_app.tabs["Appointments"].load_client_appointments(self.client_id)

        self.destroy()  # Close the popup cleanly
