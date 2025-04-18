import os
import json
import shutil
from tkinter import filedialog, messagebox

class DataDirectoryManager:
    def __init__(self, config_filename="config.json"):
        self.default_data_dir = os.path.expanduser("~/OneDrive/Desktop/SkinProData")
        self.config_path = os.path.join(self.default_data_dir, config_filename)
        self.data_dir = None
        self._load_or_create_config()


    def get_base_dir(self):
        import sys
        if getattr(sys, 'frozen', False):
            return os.path.dirname(sys.executable)
        return os.path.abspath(".")


    def _load_or_create_config(self):
        os.makedirs(self.default_data_dir, exist_ok=True)

        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    config = json.load(f)
                    self.data_dir = config.get("data_dir")

                    if not self.data_dir or not os.path.exists(self.data_dir):
                        raise ValueError("Invalid or missing data_dir in config.")

            except (json.JSONDecodeError, ValueError) as e:
                print(f"⚠️ Invalid config file: {e}. Regenerating...")
                self.select_data_directory()
        else:
            self.select_data_directory()


    def select_data_directory(self):
        folder = filedialog.askdirectory(title="Select location for SkinProData")
        if not folder:
            messagebox.showerror("Folder Required", "You must select a location to store SkinPro data.")
            raise Exception("Data directory selection cancelled by user.")

        self.data_dir = os.path.join(folder, "SkinProData")
        os.makedirs(self.data_dir, exist_ok=True)
        self._create_subfolders()

        with open(self.config_path, "w") as f:
            json.dump({"data_dir": self.data_dir}, f)

        self.save_data_paths()


    def _create_subfolders(self):
        for subfolder in ["images", "prescriptions", "profile_pictures", "backups", "qrcodes"]:
            os.makedirs(os.path.join(self.data_dir, subfolder), exist_ok=True)


    def change_data_directory(self):
        old_dir = self.data_dir
        new_root = filedialog.askdirectory(title="Select New SkinProData Location")
        if not new_root:
            return  # Cancelled

        new_dir = os.path.join(new_root, "SkinProData")
        shutil.copytree(old_dir, new_dir, dirs_exist_ok=True)

        self.data_dir = new_dir
        with open(self.config_path, "w") as f:
            json.dump({"data_dir": self.data_dir}, f)

        self.save_data_paths()

        messagebox.showinfo("Folder Updated", "SkinProData folder has been moved.\nPlease restart the application.")


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
