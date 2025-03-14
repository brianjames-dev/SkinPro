import customtkinter as ctk
from tkinter import ttk
from tkinter import filedialog
from PIL import Image, ImageTk
import os

class PhotosPage:
    def __init__(self, parent, conn, main_app):
        self.conn = conn
        self.cursor = conn.cursor()
        self.main_app = main_app  # Reference to main app
        self.client_id = None  # Store selected client ID

        self.before_image_index = 0  # Track navigation index
        self.after_image_index = 0
        self.photo_paths = []  # Store paths for navigation

        # Load images for buttons
        back_arrow = ctk.CTkImage(Image.open("icons/arrow_back.png"), size=(24, 24))
        fwd_arrow = ctk.CTkImage(Image.open("icons/arrow_forward.png"), size=(24, 24))

        # Create Main Frame
        main_frame = ctk.CTkFrame(parent)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Configure grid layout
        main_frame.columnconfigure(0, weight=4)  # Listbox column
        main_frame.columnconfigure(1, weight=1)  # Before Image
        main_frame.columnconfigure(2, weight=1)  # Before Image
        main_frame.columnconfigure(3, weight=1)  # Before Image
        main_frame.columnconfigure(4, weight=1)  # After Image
        main_frame.columnconfigure(5, weight=1)  # After Image
        main_frame.columnconfigure(6, weight=1)  # After Image

        main_frame.rowconfigure(0, weight=1)  # Stretch row for previews
        main_frame.rowconfigure(1, weight=0)  # Buttons & Labels
        main_frame.rowconfigure(2, weight=1, minsize=100)  # Description Box

        # Treeview Frame (Left Panel)
        treeview_frame = ctk.CTkFrame(main_frame)
        treeview_frame.grid(row=0, column=0, rowspan=3, sticky="nsew", padx=(0, 10))

        self.photo_list = ttk.Treeview(treeview_frame, selectmode="browse", show="headings", style="Appointments.Treeview")
        self.photo_list["columns"] = ("photo_path",)
        self.photo_list.heading("photo_path", text="Photos (By Most Recent)")
        self.photo_list.column("photo_path", width=200)
        self.photo_list.pack(fill="both", expand=True)

        self.photo_list.bind("<ButtonRelease-1>", self.set_before_image)    # Set Before Image
        self.photo_list.bind("<ButtonRelease-3>", self.set_after_image)     # Set After Image

        # Before Image Preview Pane (Middle Column)
        before_frame = ctk.CTkFrame(main_frame)
        before_frame.grid(row=0, column=1, columnspan=3, sticky="nsew", padx=5)

        ctk.CTkLabel(before_frame, text="Before", font=("Arial", 16)).pack()
        self.before_label = ctk.CTkLabel(before_frame, text="<No Image Selected>", width=250, height=445, fg_color="gray")
        self.before_label.pack(fill="both", expand=True)

        # After Image Preview Pane (Right Column)
        after_frame = ctk.CTkFrame(main_frame)
        after_frame.grid(row=0, column=4, columnspan=3, sticky="nsew", padx=5)

        ctk.CTkLabel(after_frame, text="After", font=("Arial", 16)).pack()
        self.after_label = ctk.CTkLabel(after_frame, text="<No Image Selected>", width=250, height=445, fg_color="gray")
        self.after_label.pack(fill="both", expand=True)

        # Navigation Buttons & Date Label (Before Image)
        self.before_nav_frame = ctk.CTkFrame(main_frame)
        self.before_nav_frame.grid(row=1, column=2, sticky="ew", pady=(5, 10))

        self.before_left_button = ctk.CTkButton(self.before_nav_frame, text="", image=back_arrow, width=30, command=lambda: self.navigate_image(-1, "before"))
        self.before_left_button.pack(side="left")

        self.before_date_label = ctk.CTkLabel(self.before_nav_frame, text="", font=("Arial", 12, "bold"))
        self.before_date_label.pack(side="left", expand=True)

        self.before_right_button = ctk.CTkButton(self.before_nav_frame, text="", image=fwd_arrow, width=30, command=lambda: self.navigate_image(1, "before"))
        self.before_right_button.pack(side="right")

        # Navigation Buttons & Date Label (After Image)
        self.after_nav_frame = ctk.CTkFrame(main_frame)
        self.after_nav_frame.grid(row=1, column=5, sticky="ew", pady=(5, 10))

        self.after_left_button = ctk.CTkButton(self.after_nav_frame, text="", image=back_arrow, width=30, command=lambda: self.navigate_image(-1, "after"))
        self.after_left_button.pack(side="left")

        self.after_date_label = ctk.CTkLabel(self.after_nav_frame, text="", font=("Arial", 12, "bold"))
        self.after_date_label.pack(side="left", expand=True)

        self.after_right_button = ctk.CTkButton(self.after_nav_frame, text="", image=fwd_arrow, width=30, command=lambda: self.navigate_image(1, "after"))
        self.after_right_button.pack(side="right")

        # Photo Description Box (Before Image)
        self.before_desc_frame = ctk.CTkFrame(main_frame)
        self.before_desc_frame.grid(row=2, column=1, columnspan=3, sticky="nsew", padx=5)

        ctk.CTkLabel(self.before_desc_frame, text="Before Image Description", font=("Arial", 14)).pack(anchor="w", padx=5)
        self.before_desc_textbox = ctk.CTkTextbox(self.before_desc_frame, height=60, wrap="word", corner_radius=0, fg_color="#1e1e1e")
        self.before_desc_textbox.pack(fill="both", expand=True)

        # Photo Description Box (After Image)
        self.after_desc_frame = ctk.CTkFrame(main_frame)
        self.after_desc_frame.grid(row=2, column=4, columnspan=3, sticky="nsew", padx=5)

        ctk.CTkLabel(self.after_desc_frame, text="After Image Description", font=("Arial", 14)).pack(anchor="w", padx=5)
        self.after_desc_textbox = ctk.CTkTextbox(self.after_desc_frame, height=60, wrap="word", corner_radius=0, fg_color="#1e1e1e")
        self.after_desc_textbox.pack(fill="both", expand=True)

    def set_before_image(self, event):
        """Set the selected image as the Before Image."""
        selected_item = self.photo_list.selection()
        if not selected_item:
            return
        file_path = self.photo_list.item(selected_item, "values")[0]
        self.before_image_index = self.photo_paths.index(file_path)  # Track index
        self.load_image(file_path, self.before_label)

    def set_after_image(self, event):
        """Set the selected image as the After Image."""
        selected_item = self.photo_list.selection()
        if not selected_item:
            return
        file_path = self.photo_list.item(selected_item, "values")[0]
        self.after_image_index = self.photo_paths.index(file_path)  # Track index
        self.load_image(file_path, self.after_label)

    def load_image(self, file_path, label):
        """Load and display an image in the specified label."""
        if os.path.exists(file_path):
            try:
                image = Image.open(file_path)
                image.thumbnail((250, 445))  # Scale while maintaining aspect ratio
                photo = ImageTk.PhotoImage(image)

                label.configure(image=photo, text="")
                label.image = photo  # Keep reference
                self.update_photo_metadata(file_path)  # Update date & description
            except Exception as e:
                print(f"⚠ Error loading image: {e}")
                label.configure(text="Error loading image", image="")
        else:
            label.configure(text="Image not found", image="")

    def update_photo_metadata(self, file_path):
        """Update the date label and description based on the selected photo."""
        self.cursor.execute("SELECT appointment_date, description FROM photos WHERE file_path = ?", (file_path,))
        result = self.cursor.fetchone()

        if result:
            appointment_date, description = result
            self.date_label.configure(text=appointment_date)  # Update Date Label
            self.desc_textbox.delete("1.0", "end")
            self.desc_textbox.insert("1.0", description if description else "<No Description Yet>")
        else:
            self.date_label.configure(text="Unknown Date")
            self.desc_textbox.delete("1.0", "end")
            self.desc_textbox.insert("1.0", "<No Description Yet>")

    def navigate_image(self, direction, frame_type):
        """Cycle through images using navigation buttons."""
        if not self.photo_paths:
            return  # No images to navigate

        # Determine which label to update (Before or After)
        if direction == -1:  # Left button
            self.before_image_index = (self.before_image_index - 1) % len(self.photo_paths)
            file_path = self.photo_paths[self.before_image_index]
            self.load_image(file_path, self.before_label)
        else:  # Right button
            self.after_image_index = (self.after_image_index + 1) % len(self.photo_paths)
            file_path = self.photo_paths[self.after_image_index]
            self.load_image(file_path, self.after_label)
