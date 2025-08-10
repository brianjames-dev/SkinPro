import os
import json
import shutil
from tkinter import filedialog, messagebox
import time

class DataDirectoryManager:
    def __init__(self, config_filename="config.json"):
        self.pointer_path = os.path.join(os.path.expanduser("~"), ".skinpro_config_location.json")
        self.config_filename = config_filename
        self.data_dir = None
        self.config_path = None
        self._load_or_create_config()


    def get_base_dir(self):
        import sys
        if getattr(sys, 'frozen', False):
            return os.path.dirname(sys.executable)
        return os.path.abspath(".")


    def _load_or_create_config(self):
        if os.path.exists(self.pointer_path):
            try:
                with open(self.pointer_path, "r") as f:
                    pointer = json.load(f)
                    self.data_dir = pointer.get("data_dir")

                # Check if it's missing or empty
                if not self.data_dir:
                    print("Empty data_dir in pointer — running first-time setup...")
                    self._show_initial_warning()
                    self.select_data_directory()
                    return

                # Set config_path
                self.config_path = os.path.join(self.data_dir, self.config_filename)

                # Folder missing? Wait in loop until user restores it
                while not os.path.exists(self.data_dir):
                    msg = (
                        f"The 'SkinProData' folder is missing from its expected location:\n\n"
                        f"{self.data_dir}\n\n"
                        "Please move the folder back to this location.\n\n"
                        "The app will resume once the folder is restored."
                    )
                    messagebox.showerror("Missing SkinProData Folder", msg)
                    time.sleep(5)

            except (json.JSONDecodeError, ValueError) as e:
                print(f"Invalid pointer file: {e}. Regenerating pointer...")
                self._show_initial_warning()
                self.select_data_directory()
        else:
            # No pointer at all — first ever run
            self._show_initial_warning()
            self.select_data_directory()


    def _show_initial_warning(self):
        messagebox.showinfo(
            "Set SkinProData Location",
            "You are about to choose a permanent location for the SkinProData folder.\n\n"
            "Please select a reliable place on your computer.\n\n"
            "Avoid temporary or cloud-sync folders unless you're confident."
        )


    def select_data_directory(self):
        folder = filedialog.askdirectory(title="Select location for SkinProData")
        if not folder:
            messagebox.showerror("Folder Required", "You must select a location to store SkinPro data.")
            raise Exception("Data directory selection cancelled by user.")

        self.data_dir = os.path.join(folder, "SkinProData")
        os.makedirs(self.data_dir, exist_ok=True)
        self._create_subfolders()

        self.config_path = os.path.join(self.data_dir, self.config_filename)

        # Save pointer to user home directory
        with open(self.pointer_path, "w") as f:
            json.dump({"data_dir": self.data_dir}, f)

        # Save config file inside SkinProData folder
        with open(self.config_path, "w") as f:
            json.dump({"data_dir": self.data_dir}, f)

        self.save_data_paths()


    def _create_subfolders(self):
        for subfolder in ["images", "prescriptions", "profile_pictures", "backups", "qrcodes"]:
            os.makedirs(os.path.join(self.data_dir, subfolder), exist_ok=True)


    # def change_data_directory(self):
    #     old_dir = self.data_dir
    #     new_root = filedialog.askdirectory(title="Select New SkinProData Location")
    #     if not new_root:
    #         return  # Cancelled

    #     new_dir = os.path.join(new_root, "SkinProData")
    #     shutil.copytree(old_dir, new_dir, dirs_exist_ok=True)

    #     self.data_dir = new_dir
    #     with open(self.config_path, "w") as f:
    #         json.dump({"data_dir": self.data_dir}, f)

    #     self.save_data_paths()

    #     messagebox.showinfo("Folder Updated", "SkinProData folder has been moved.\nPlease restart the application.")


    def get_path(self, subfolder, filename=None):
        path = os.path.join(self.data_dir, subfolder)
        if filename:
            path = os.path.join(path, filename)
        return path


    def save_data_paths(self):
        config = {
            "database": self.db_path,
            "photos": self.images_dir,
            "profile_pictures": self.profile_pics_dir
        }
        with open(os.path.join(self.data_dir, "paths.json"), "w") as f:
            json.dump(config, f, indent=2)


    def get_photo_path(self, client_folder_name: str, date_folder_name: str) -> str:
        """
        Constructs the full path to a client's appointment photo folder with correct formatting.
        """
        path = os.path.join(self.images_dir, client_folder_name, date_folder_name)
        os.makedirs(path, exist_ok=True)
        return path


    @property
    def db_path(self):
        return os.path.join(self.data_dir, "skinpro.db")

    @property
    def images_dir(self):
        return os.path.join(self.data_dir, "images")

    @property
    def prescriptions_dir(self):
        return os.path.join(self.data_dir, "prescriptions")

    @property
    def profile_pics_dir(self):
        return os.path.join(self.data_dir, "profile_pictures")

    @property
    def backups_dir(self):
        return os.path.join(self.data_dir, "backups")
