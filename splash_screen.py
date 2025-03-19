import customtkinter as ctk


class SplashScreen(ctk.CTkToplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.title("Loading...")
        self.geometry("500x300")
        self.resizable(False, False)

        # Background
        self.configure(bg="#2b2b2b")

        # Logo
        self.logo_label = ctk.CTkLabel(self, text="SkinPro", font=("Arial", 32, "bold"))
        self.logo_label.pack(pady=30)

        # Progress Label
        self.progress_label = ctk.CTkLabel(self, text="Starting up...", font=("Arial", 14))
        self.progress_label.pack(pady=10)

        # Progress Bar
        self.progress_bar = ctk.CTkProgressBar(self)
        self.progress_bar.pack(pady=20, padx=40, fill="x")
        self.progress_bar.set(0)  # Start at 0%

        self.update_idletasks()

    def update_progress(self, progress, message):
        """Update the progress bar and label text dynamically."""
        self.progress_bar.set(progress)
        self.progress_label.configure(text=message)
        self.update_idletasks()  # Force UI refresh
