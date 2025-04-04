import customtkinter as ctk
from PIL import Image
import time

class SplashScreen(ctk.CTkToplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.title("Loading...")
        self.geometry("500x500")
        self.resizable(False, False)

        # Load Image
        self.bg_image = ctk.CTkImage(light_image=Image.open("icons/apotheca_logo.jpg"),
                                     size=(500, 500))  # Adjust size as needed
        
        # Background Label
        self.bg_label = ctk.CTkLabel(self, image=self.bg_image, text="")  
        self.bg_label.place(relwidth=1, relheight=1)  # Cover full window
        
        # Progress Bar
        self.progress_bar = ctk.CTkProgressBar(self)
        self.progress_bar.pack(pady=(460, 0), padx=40, fill="x")
        self.progress_bar.set(0)  # Start at 0%

        # Frame for Progress and Timer Labels (Side-by-Side)
        label_frame = ctk.CTkFrame(self, fg_color="#dbdbdb")
        label_frame.pack(pady=5, padx=40, fill="x")  # Align with progress bar width

        # Progress Label (Left)
        self.progress_label = ctk.CTkLabel(label_frame, text="Starting up...", 
                                           font=("Helvetica", 14),
                                           fg_color="#dbdbdb",
                                           corner_radius=0)
        self.progress_label.pack(side="left", padx=10)

        # Timer Label (Right)
        self.timer_label = ctk.CTkLabel(label_frame, text="Elapsed Time: 0s", 
                                        font=("Helvetica", 12),
                                        fg_color="#dbdbdb",
                                        corner_radius=0)
        self.timer_label.pack(side="right", padx=10)

        # Timer Variables
        self.start_time = time.time()
        self.timer_running = True  
        self.update_timer()  

        self.update_idletasks()

    def update_progress(self, progress, message):
        """Update the progress bar and label text dynamically."""
        self.progress_bar.set(progress)
        self.progress_label.configure(text=message)
        self.update_idletasks()  # Force UI refresh

    def update_timer(self):
        """Update the elapsed time and refresh UI at regular intervals."""
        if not hasattr(self, 'timer_running') or not self.timer_running:
            return  # ✅ Prevent AttributeError if called after destruction

        elapsed_time = time.time() - self.start_time
        self.timer_label.configure(text=f"Elapsed Time: {elapsed_time:.0f}s")
        self.after(100, self.update_timer)  # ✅ Update every 100ms

    def stop_timer(self):
        """Stops the timer when loading completes."""
        self.timer_running = False  # ✅ Prevent further updates
        elapsed_time = time.time() - self.start_time
        self.timer_label.configure(text=f"Total Time: {elapsed_time:.0f}s")
