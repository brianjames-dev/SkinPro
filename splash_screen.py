import customtkinter as ctk


class SplashScreen(ctk.CTkToplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent  # Explicitly store the reference
        self.title("Loading...")
        self.geometry("500x300")
        self.resizable(False, False)
        
        # Center the splash screen
        self.update_idletasks()
        width = self.winfo_width()
        height = self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (width // 2)
        y = (self.winfo_screenheight() // 2) - (height // 2)
        self.geometry(f"+{x}+{y}")

        # Background
        self.configure(bg="#2b2b2b")
        
        # Logo
        self.logo_label = ctk.CTkLabel(self, text="SkinPro", font=("Arial", 32, "bold"))
        self.logo_label.pack(pady=30)

        # Progress Label
        self.progress_label = ctk.CTkLabel(self, text="Loading...", font=("Arial", 14))
        self.progress_label.pack(pady=10)

        # Progress Bar
        self.progress_bar = ctk.CTkProgressBar(self)
        self.progress_bar.pack(pady=20, padx=40, fill="x")
        self.progress_bar.set(0)

        self.update_idletasks()
        self.update()


    def close_splash(self):
        """Close the splash screen safely and show the main window."""
        self.destroy()  # ✅ Close the splash screen safely

        if self.parent and self.parent.winfo_exists():
            self.parent.deiconify()  # ✅ Show the main application if it still exists
