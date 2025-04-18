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
import datetime
from utils.path_utils import resource_path
import tempfile
import threading
import time


class PhotoUploadPopup(ctk.CTkToplevel):
    def __init__(self, parent, client_id, appointment_id=None, appointment_date=None, client_name="", appt_type="", main_app=None, profile_card=None):
        super().__init__(parent)
        self.title("Upload Photos")
        self.geometry("300x150")
        self.resizable(False, False)

        self._polling_task = None
        self.profile_card = profile_card
        self.is_profile_upload = profile_card is not None
        self.qr_mode_enabled = False
        self.client_id = client_id
        self.appointment_id = appointment_id
        self.appointment_date = appointment_date
        self.client_name = client_name
        self.appt_type = appt_type
        self.parent = parent
        self.main_app = main_app
        self._launch_settings_after_close = False
        self.start_time = datetime.datetime.now().timestamp()

        self.qr_icon = CTkImage(light_image=Image.open(resource_path("icons/qr_code.png")), size=(20, 20))
        self.upload_icon = CTkImage(light_image=Image.open(resource_path("icons/upload.png")), size=(20, 20))

        # Lock interaction to this pop-up
        self.transient(main_app)
        self.grab_set()
        self.focus_force()

        # === Main Frame ===
        main_frame = ctk.CTkFrame(self)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Row configuration
        main_frame.rowconfigure(0, weight=0)  # Title
        main_frame.rowconfigure(1, weight=0)  # QR button
        main_frame.rowconfigure(2, weight=0)  # Local upload button
        main_frame.rowconfigure(3, weight=0)  # QR code + status
        main_frame.columnconfigure(0, weight=1)

        # Title
        ctk.CTkLabel(
            main_frame,
            text=f"Upload Photos for\n{client_name}",
            font=("Helvetica", 16, "bold")
        ).grid(row=0, column=0, pady=(10, 0), sticky="n")

        # === Button Row Frame ===
        button_wrapper = ctk.CTkFrame(main_frame, fg_color="transparent")
        button_wrapper.grid(row=1, column=0, pady=(20, 0), sticky="n")
        button_wrapper.columnconfigure(0, weight=1)

        inner_button_row = ctk.CTkFrame(button_wrapper, fg_color="transparent")
        inner_button_row.grid(row=0, column=0)

        inner_button_row.columnconfigure((0, 1), weight=0)

        # Enable QR Button (Left)
        ctk.CTkButton(
            inner_button_row,
            text="QR",
            image=self.qr_icon,
            compound="left",
            command=self.enable_qr_mode,
            width=90  # slightly wider for better icon+text layout
        ).grid(row=0, column=0, padx=(0, 5))

        # Upload Local Button (Right)
        ctk.CTkButton(
            inner_button_row,
            text="Local",
            image=self.upload_icon,
            compound="left",
            command=self.upload_local_photos,
            width=90
        ).grid(row=0, column=1, padx=(5, 0))

        self.center_frame = None
        self.qr_label = None
        self.status_label = None


    def enable_qr_mode(self):
        if not self.appointment_id and not self.is_profile_upload:
            messagebox.showwarning("Missing Appointment", "QR upload is only available with an appointment.")
            return

        self.qr_mode_enabled = True
        self.generate_qr()
        self.start_polling()


    def upload_local_photos(self):
        try:
            if self.is_profile_upload:
                file_path = filedialog.askopenfilename(
                    title="Select Profile Picture",
                    filetypes=[("Image Files", "*.jpg *.jpeg *.png *.bmp *.gif")]
                )
                if not file_path:
                    return

                safe_name = self.client_name.replace(" ", "_")
                filename = f"{safe_name}_id_{self.client_id}.png"
                save_path = os.path.join(self.main_app.data_manager.profile_pics_dir, filename)

                try:
                    image = Image.open(file_path)
                    image.save(save_path)
                except Exception as e:
                    print(f"❌ Error saving image: {e}")
                    messagebox.showerror("Error", "The selected image could not be processed.")
                    return

                with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        UPDATE clients SET profile_picture = ? WHERE id = ?
                    """, (save_path, self.client_id))

                    cursor.execute("SELECT id FROM client_images WHERE client_id = ?", (self.client_id,))
                    if cursor.fetchone():
                        cursor.execute("""
                            UPDATE client_images SET zoom = ?, shift = ? WHERE client_id = ?
                        """, (100, 0, self.client_id))
                    else:
                        cursor.execute("""
                            INSERT INTO client_images (client_id, zoom, shift) VALUES (?, ?, ?)
                        """, (self.client_id, 100, 0))

                # === Reload UI and launch settings popup
                if self.profile_card:
                    self.profile_card.load_client(self.client_id)

                    # Tell main app that settings popup should be triggered after this closes
                    self._launch_settings_after_close = True
                else:
                    self._launch_settings_after_close = False

                self.after(100, self._cleanup_and_close)
                return

            safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in self.client_name).replace(" ", "_")
            date_formatted = self.appointment_date.replace("/", "-")
            client_folder = self.main_app.data_manager.get_photo_path(
                f"{safe_name}_id_{self.client_id}", date_formatted
            )
            os.makedirs(client_folder, exist_ok=True)

            file_paths = filedialog.askopenfilenames(
                title="Select Photos",
                filetypes=[("Image Files", "*.jpg *.jpeg *.png *.bmp *.gif")]
            )

            if not file_paths:
                return

            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                for file_path in file_paths:
                    filename = os.path.basename(file_path)
                    new_path = os.path.join(client_folder, filename)
                    counter = 1
                    while os.path.exists(new_path):
                        name, ext = os.path.splitext(filename)
                        new_path = os.path.join(client_folder, f"{name}_{counter}{ext}")
                        counter += 1
                    shutil.copy(file_path, new_path)
                    cursor.execute(
                        "INSERT INTO photos (client_id, appointment_id, appt_date, file_path, type) VALUES (?, ?, ?, ?, ?)",
                        (self.client_id, self.appointment_id, self.appointment_date, new_path, self.appt_type)
                    )

                cursor.execute("UPDATE appointments SET photos_taken = 'Yes' WHERE id = ?", (self.appointment_id,))

            if "Photos" in self.main_app.tabs:
                self.main_app.tabs["Photos"].refresh_photos_list(self.client_id)

            self.main_app.tabs["Appointments"].load_client_appointments(self.client_id)

            self.after(100, lambda: self._show_success_and_close(len(file_paths)))

        except Exception as e:
            print(f"❌ Failed to upload photos: {e}")
            messagebox.showerror("Error", "Failed to upload photos. Please try again.")


    def _show_success_and_close(self, num_uploaded):
        messagebox.showinfo("Upload Complete", f"{num_uploaded} photo(s) uploaded successfully!")
        self._cleanup_and_close()


    def _cleanup_and_close(self):
        if self._polling_task:
            self.after_cancel(self._polling_task)
            self._polling_task = None

        # Delay destruction and trigger the next popup after
        self.after(100, self._delayed_close)


    def _delayed_close(self):
        self.destroy()
        if self._launch_settings_after_close and self.profile_card:
            print("✅ Post-destroy: Launching profile image settings popup...")
            self.profile_card.open_settings_popup()


    def _delayed_profile_success(self):
        if self._polling_task:
            self.after_cancel(self._polling_task)
            self._polling_task = None

        print("🟣 Closing popup — final success handler.")

        should_launch_editor = False
        if self.profile_card:
            print("🟢 Loaded profile_card — refreshing client data")
            self.profile_card.load_client(self.client_id)
            should_launch_editor = True
        else:
            print("⚠️ No profile_card available. Skipping editor popup.")

        self.destroy()

        # Launch settings popup **after** window is safely destroyed
        if should_launch_editor:
            self.after(300, lambda: self.profile_card.open_settings_popup())


    def generate_qr(self):
        self.ensure_server_running()

        if self.center_frame is None:
            # Create center frame and QR widgets dynamically
            self.center_frame = ctk.CTkFrame(self.nametowidget(self.winfo_children()[0]), fg_color="transparent")
            self.center_frame.grid(row=3, column=0, sticky="nsew")
            self.center_frame.columnconfigure(0, weight=1)

            self.qr_label = ctk.CTkLabel(self.center_frame, text="")
            self.qr_label.grid(row=0, column=0, pady=(5, 5), sticky="n")

            self.status_label = ctk.CTkLabel(self.center_frame, text="", font=("Helvetica", 14))
            self.status_label.grid(row=1, column=0, pady=(0, 5), sticky="n")

            # Resize window now that we added content
            self.geometry("300x370")

        if self.is_profile_upload:
            qr_path = generate_upload_qr(self.client_id, None, self.main_app.data_manager, mode="profile")
        else:
            qr_path = generate_upload_qr(self.client_id, self.appointment_id, self.main_app.data_manager)

        try:
            image = Image.open(qr_path)
            self.qr_image = CTkImage(light_image=image, size=(200, 200))
            self.qr_label.configure(image=self.qr_image, text="", corner_radius=10)

        except Exception as e:
            self.qr_label.configure(text="Failed to load QR code image.")
            print(f"❌ Error loading QR code image: {e}")


    def ensure_server_running(self):
        """Start or restart the Flask server thread if it's not alive."""
        if not hasattr(sys, '_flask_thread'):
            sys._flask_thread = None

        # If thread doesn't exist or is dead, restart it
        if sys._flask_thread is None or not sys._flask_thread.is_alive():
            print("🟢 Flask thread not running. Launching or restarting...")

            from upload_server import server

            def run_flask():
                try:
                    server.start_flask_server()
                except Exception as e:
                    print(f"🔥 Flask server crashed: {e}")
                    # Optional: wait and try again
                    time.sleep(2)
                    print("🔁 Retrying Flask server...")
                    run_flask()

            t = threading.Thread(target=run_flask, daemon=True)
            t.start()
            sys._flask_thread = t


    def start_polling(self):
        if self._polling_task is not None:
            self.after_cancel(self._polling_task)
        self._polling_task = self.after(3000, self.check_for_uploaded_photos)


    def check_for_uploaded_photos(self):
        if not self.qr_mode_enabled:
            return  # Exit immediately if QR mode isn't active

        try:
            conn = sqlite3.connect(self.main_app.data_manager.db_path, check_same_thread=False)
            cursor = conn.cursor()

            if getattr(self, "is_profile_upload", False):
                # === Profile Picture Upload Mode ===
                cursor.execute("SELECT profile_picture FROM clients WHERE id = ?", (self.client_id,))
                result = cursor.fetchone()
                conn.close()

                if not result or not result[0] or not os.path.exists(result[0]):
                    self._polling_task = self.after(3000, self.check_for_uploaded_photos)
                    return

                modified_time = os.path.getmtime(result[0])
                if modified_time < self.start_time:
                    print("⏳ File exists but not newly modified. Waiting...")
                    self._polling_task = self.after(3000, self.check_for_uploaded_photos)
                    return

                self.status_label.configure(text="Profile Picture Uploaded ✅")

                if self._polling_task:
                    self.after_cancel(self._polling_task)
                    self._polling_task = None

                print("✅ Upload complete. Waiting briefly before closing and opening popup...")
                self.after(400, self._delayed_profile_success)
                return

            # === Appointment Photo Upload Mode ===
            cursor.execute("""
                SELECT COUNT(*) FROM photos
                WHERE client_id = ? AND appointment_id = ?
            """, (self.client_id, self.appointment_id))
            count = cursor.fetchone()[0]
            conn.close()

            if not hasattr(self, "initial_photo_count"):
                self.initial_photo_count = count
                self.last_seen_count = count
                self.stable_count_checks = 0
                self._polling_task = self.after(2000, self.check_for_uploaded_photos)
                return

            if count > self.initial_photo_count:
                if not getattr(self, "_uploading_started", False):
                    self._uploading_started = True
                    self.status_label.configure(text="Uploading... Please wait ⏳")

                if count == self.last_seen_count:
                    self.stable_count_checks += 1
                else:
                    self.stable_count_checks = 1

                self.last_seen_count = count

                if self.stable_count_checks >= 2:
                    print(f"📸 Final photo count stabilized at {count}")
                    self.status_label.configure(image="")
                    self.finish_success_popup(count - self.initial_photo_count)
                    return
            else:
                self.stable_count_checks = 0
                self.last_seen_count = count

            self._polling_task = self.after(2000, self.check_for_uploaded_photos)

        except Exception as e:
            print(f"❌ Error checking for uploaded photos: {e}")
            self._polling_task = self.after(3000, self.check_for_uploaded_photos)


    def finish_success_popup(self, num_uploaded):
        if self._polling_task:
            self.after_cancel(self._polling_task)
            self._polling_task = None

        self.status_label.configure(text="Upload Complete!")
        messagebox.showinfo("Upload Complete", f"{num_uploaded} photo(s) uploaded successfully!")
        self.main_app.tabs["Photos"].refresh_photos_list(self.client_id)
        self.main_app.tabs["Appointments"].load_client_appointments(self.client_id)
        self.destroy()
