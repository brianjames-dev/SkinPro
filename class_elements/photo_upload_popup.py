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


class PhotoUploadPopup(ctk.CTkToplevel):
    def __init__(self, parent, client_id, appointment_id=None, appointment_date=None, client_name="", appt_type="", main_app=None, profile_card=None):
        super().__init__(parent)
        self.title("Upload Photos")
        self.geometry("300x360")
        self.resizable(False, False)

        self._polling_task = None
        self.profile_card = profile_card
        self.is_profile_upload = profile_card is not None
        self.client_id = client_id
        self.appointment_id = appointment_id
        self.appointment_date = appointment_date
        self.client_name = client_name
        self.appt_type = appt_type
        self.parent = parent
        self.main_app = main_app
        self.start_time = datetime.datetime.now().timestamp()

        # Lock interaction to this pop-up
        self.transient(main_app)
        self.grab_set()
        self.focus_force()

        # === Main Frame ===
        main_frame = ctk.CTkFrame(self)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Grid setup for layout control
        main_frame.rowconfigure(0, weight=0)
        main_frame.rowconfigure(1, weight=1)
        main_frame.rowconfigure(2, weight=0)
        main_frame.columnconfigure(0, weight=1)

        ctk.CTkLabel(main_frame, text=f"Add Photos for\n{client_name}", font=("Helvetica", 16, "bold")).grid(row=0, column=0, pady=(10, 5), sticky="n")

        # === QR + status in sub-frame
        center_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        center_frame.grid(row=1, column=0, sticky="nsew")
        center_frame.columnconfigure(0, weight=1)

        self.qr_label = ctk.CTkLabel(center_frame, text="")
        self.qr_label.grid(row=0, column=0, pady=(5, 5), sticky="n")

        self.status_label = ctk.CTkLabel(center_frame, text="", font=("Helvetica", 14))
        self.status_label.grid(row=1, column=0, pady=(0, 5), sticky="n")

        # Upload Local Button
        ctk.CTkButton(main_frame, text="Upload Local Photos", command=self.upload_local_photos).grid(row=2, column=0, pady=(10, 10), sticky="n")

        # Setup and start
        self.generate_qr()
        self.start_polling()


    def upload_local_photos(self):
        if getattr(self, "is_profile_upload", False):
            # === PROFILE PICTURE UPLOAD ===
            file_path = filedialog.askopenfilename(
                title="Select Profile Picture",
                filetypes=[("Image Files", "*.jpg *.jpeg *.png *.bmp *.gif")]
            )
            if not file_path:
                return

            try:
                # Generate a standardized profile picture filename
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

                # Update profile path in DB
                self.main_app.conn.cursor().execute("""
                    UPDATE clients SET profile_picture = ? WHERE id = ?
                """, (save_path, self.client_id))

                # Ensure default zoom/shift exists
                self.main_app.conn.cursor().execute("SELECT id FROM client_images WHERE client_id = ?", (self.client_id,))
                if self.main_app.conn.cursor().fetchone():
                    self.main_app.conn.cursor().execute("""
                        UPDATE client_images SET zoom = ?, shift = ? WHERE client_id = ?
                    """, (100, 0, self.client_id))
                else:
                    self.main_app.conn.cursor().execute("""
                        INSERT INTO client_images (client_id, zoom, shift) VALUES (?, ?, ?)
                    """, (self.client_id, 100, 0))

                self.main_app.conn.commit()

                # Refresh profile picture UI
                if hasattr(self, "profile_card") and self.profile_card:
                    self.profile_card.load_client(self.client_id)

                messagebox.showinfo("Success", "Profile picture uploaded successfully.")
                self.destroy()

            except Exception as e:
                print(f"❌ Failed to upload profile picture: {e}")
                messagebox.showerror("Error", "Could not upload profile picture.")
            return

        # === APPOINTMENT PHOTO MODE ===
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

        for file_path in file_paths:
            filename = os.path.basename(file_path)
            new_path = os.path.join(client_folder, filename)
            counter = 1
            while os.path.exists(new_path):
                name, ext = os.path.splitext(filename)
                new_path = os.path.join(client_folder, f"{name}_{counter}{ext}")
                counter += 1
            shutil.copy(file_path, new_path)
            self.main_app.conn.cursor().execute(
                "INSERT INTO photos (client_id, appointment_id, appt_date, file_path, type) VALUES (?, ?, ?, ?, ?)",
                (self.client_id, self.appointment_id, self.appointment_date, new_path, self.appt_type)
            )

        self.main_app.conn.cursor().execute("UPDATE appointments SET photos_taken = 'Yes' WHERE id = ?", (self.appointment_id,))
        self.main_app.conn.commit()
        messagebox.showinfo("Success", f"{len(file_paths)} photo(s) uploaded successfully.")

        # Refresh UI
        if "Photos" in self.main_app.tabs:
            self.main_app.tabs["Photos"].refresh_photos_list(self.client_id)

        self.main_app.tabs["Appointments"].load_client_appointments(self.client_id)


    def generate_qr(self):
        self.ensure_server_running()
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
        """Launch Flask server in a background subprocess if not already running."""
        if not hasattr(sys, '_flask_server_started'):
            print("🟢 Starting Flask server...")

            # Determine whether we're running from a PyInstaller .exe
            is_frozen = getattr(sys, 'frozen', False)

            if is_frozen:
                # PyInstaller bundle: server.py is extracted into _MEIPASS
                server_path = os.path.join(sys._MEIPASS, "upload_server", "server.py")
                python_cmd = "python"  # assume installed system Python
            else:
                # Dev mode: use local path and Python executable
                from utils.path_utils import resource_path
                server_path = resource_path(os.path.join("upload_server", "server.py"))
                python_cmd = sys.executable

            # Check that python is available in frozen mode
            if is_frozen:
                try:
                    result = subprocess.run(
                        [python_cmd, "--version"],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        creationflags=(subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
                    )
                    if result.returncode != 0:
                        raise EnvironmentError(f"Python not found: {result.stderr.strip()}")
                    else:
                        print(f"🧪 Found system Python: {result.stdout.strip()}")
                except Exception as e:
                    print(f"❌ Could not verify system Python: {e}")
                    return

            # Launch server
            creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            try:
                subprocess.Popen([python_cmd, server_path], creationflags=creationflags)
                sys._flask_server_started = True
                print(f"🟢 Flask server launched using {python_cmd}: {server_path}")
            except Exception as e:
                print(f"❌ Failed to start Flask server: {e}")


    def start_polling(self):
        if self._polling_task is not None:
            self.after_cancel(self._polling_task)
        self._polling_task = self.after(3000, self.check_for_uploaded_photos)


    def check_for_uploaded_photos(self):
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

                if self.profile_card:
                    self.profile_card.load_client(self.client_id)
                    self.after(200, lambda: self.profile_card.open_settings_popup())

                if self._polling_task:
                    self.after_cancel(self._polling_task)
                    self._polling_task = None

                messagebox.showinfo("Upload Complete", "Profile picture uploaded successfully!")
                self.destroy()
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
        self.status_label.configure(text="Upload Complete!")
        messagebox.showinfo("Upload Complete", f"{num_uploaded} photo(s) uploaded successfully!")
        self.main_app.tabs["Photos"].refresh_photos_list(self.client_id)
        self.main_app.tabs["Appointments"].load_client_appointments(self.client_id)
        self.after_cancel(self._polling_task)
        self._polling_task = None
        self.destroy()
