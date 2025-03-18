import customtkinter as ctk
from PIL import Image, ImageTk
import time

class LoadingScreen(ctk.CTkToplevel):
    def __init__(self, master, image_cache):
        super().__init__(master)
        self.master = master
        self.image_cache = image_cache
        self.progress = 0

        self.geometry("600x400")
        self.title("Loading...")
        self.configure(bg="black")

        # Load and display a program logo
        self.logo_img = Image.open("icons/add_photo_alt.png")  # Replace with your actual path
        self.logo_img = self.logo_img.resize((300, 150), Image.LANCZOS)
        self.logo_photo = ImageTk.PhotoImage(self.logo_img)
        self.logo_label = ctk.CTkLabel(self, image=self.logo_photo, text="", bg_color="black")
        self.logo_label.pack(pady=40)

        # Loading bar
        self.progress_var = ctk.DoubleVar()
        self.progress_bar = ctk.CTkProgressBar(self, variable=self.progress_var, width=400)
        self.progress_bar.pack(pady=10)
        self.progress_bar.set(0)  # Start empty

        # Loading text
        self.loading_label = ctk.CTkLabel(self, text="Loading Images...", font=("Arial", 14), bg_color="black", fg_color="white")
        self.loading_label.pack()

        # Force window to stay on top
        self.attributes("-topmost", True)
        self.update_idletasks()

    def update_progress(self, progress, total):
        """Update the loading bar dynamically"""
        percent = progress / total
        self.progress_bar.set(percent)
        self.loading_label.configure(text=f"Loading Images... {int(percent * 100)}%")
        self.update_idletasks()
