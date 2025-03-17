import customtkinter as ctk
from tkinter import ttk
from tkinter import filedialog
from PIL import Image, ImageTk
from customtkinter import CTkImage
from class_elements.treeview_styling import style_treeview
import os

class PhotosPage:
    def __init__(self, parent, conn, main_app):
        self.conn = conn
        self.cursor = conn.cursor()
        self.main_app = main_app  # Reference to main app
        self.client_id = None  # Store selected client ID

        self.before_image_index = 0  # Track navigation index
        self.after_image_index = 0

        self.photo_paths = []  # Stores tuples of (photo_id, file_path) for navigation
        self.photo_file_paths = {}
        self.thumbnails = {}  # Stores {photo_id: thumbnail image} for Treeview
        
        # Load images for buttons
        back_arrow = ctk.CTkImage(Image.open("icons/arrow_back.png"), size=(16, 16))
        fwd_arrow = ctk.CTkImage(Image.open("icons/arrow_forward.png"), size=(16, 16))

        # Create Main Frame
        main_frame = ctk.CTkFrame(parent)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Configure grid layout
        main_frame.columnconfigure(0, weight=6)  # Listbox column
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

        # Apply treeview styling
        style_treeview("Photos.Treeview", rowheight=55)

        self.photo_list = ttk.Treeview(treeview_frame, selectmode="browse", show="tree headings", style="Photos.Treeview")
        self.photo_list["columns"] = ("appt_date", "treatment")
        self.photo_list.heading("#0", text="Thumbnail")  # ✅ Thumbnail as the first column
        self.photo_list.heading("appt_date", text="Date")
        self.photo_list.heading("treatment", text="Treatment")
        self.photo_list.column("#0", width=75, anchor="w")  # ✅ Use the implicit first column for thumbnails
        self.photo_list.column("appt_date", width=50)
        self.photo_list.column("treatment", width=100)
        self.photo_list.pack(fill="both", expand=True)
        self.photo_list.bind("<Button-1>", self.clear_selection_on_empty_click)
        self.photo_list.bind("<ButtonRelease-1>", self.set_before_image)    # Set Before Image
        self.photo_list.bind("<Control-ButtonRelease-1>", self.set_after_image)     # Set After Image

        # Before Image Preview Pane (Middle Column)
        before_frame = ctk.CTkFrame(main_frame, width=279, height=372)
        before_frame.grid(row=0, column=1, columnspan=3, sticky="nsew", padx=5)

        ctk.CTkLabel(before_frame, text="Before", font=("Arial", 16)).pack()
        self.before_label = ctk.CTkLabel(before_frame, text="<No Image Selected>", width=279, height=372, fg_color="gray")
        self.before_label.pack(pady=(0, 10))

        # After Image Preview Pane (Right Column)
        after_frame = ctk.CTkFrame(main_frame, width=279, height=372)
        after_frame.grid(row=0, column=4, columnspan=3, sticky="nsew", padx=5)

        ctk.CTkLabel(after_frame, text="After", font=("Arial", 16)).pack()
        self.after_label = ctk.CTkLabel(after_frame, text="<No Image Selected>", width=279, height=372, fg_color="gray")
        self.after_label.pack(pady=(0, 10))

        # Navigation Buttons & Date Label (Before Image)
        self.before_nav_frame = ctk.CTkFrame(main_frame)
        self.before_nav_frame.grid(row=1, column=2, sticky="ew", pady=(5, 5))

        self.before_left_button = ctk.CTkButton(self.before_nav_frame, text="", image=back_arrow, width=30, command=lambda: self.navigate_image(-1, "before"))
        self.before_left_button.pack(side="left")

        self.before_date_label = ctk.CTkLabel(self.before_nav_frame, text="                   ", font=("Arial", 12, "bold"))
        self.before_date_label.pack(side="left", expand=True)

        self.before_right_button = ctk.CTkButton(self.before_nav_frame, text="", image=fwd_arrow, width=30, command=lambda: self.navigate_image(1, "before"))
        self.before_right_button.pack(side="right")

        # Navigation Buttons & Date Label (After Image)
        self.after_nav_frame = ctk.CTkFrame(main_frame)
        self.after_nav_frame.grid(row=1, column=5, sticky="ew", pady=(5, 5))

        self.after_left_button = ctk.CTkButton(self.after_nav_frame, text="", image=back_arrow, width=30, command=lambda: self.navigate_image(-1, "after"))
        self.after_left_button.pack(side="left")

        self.after_date_label = ctk.CTkLabel(self.after_nav_frame, text="                   ", font=("Arial", 12, "bold"))
        self.after_date_label.pack(side="left", expand=True)

        self.after_right_button = ctk.CTkButton(self.after_nav_frame, text="", image=fwd_arrow, width=30, command=lambda: self.navigate_image(1, "after"))
        self.after_right_button.pack(side="right")

        # Photo Description Box (Before Image)
        self.before_desc_frame = ctk.CTkFrame(main_frame)
        self.before_desc_frame.grid(row=2, column=1, columnspan=3, sticky="nsew", padx=10)

        ctk.CTkLabel(self.before_desc_frame, text="Description", font=("Arial", 14)).pack(anchor="w", padx=10)
        self.before_desc_textbox = ctk.CTkTextbox(self.before_desc_frame, height=60, wrap="word", corner_radius=0, fg_color="#1e1e1e")
        self.before_desc_textbox.pack(fill="both", expand=True)

        # Photo Description Box (After Image)
        self.after_desc_frame = ctk.CTkFrame(main_frame)
        self.after_desc_frame.grid(row=2, column=4, columnspan=3, sticky="nsew", padx=10)

        ctk.CTkLabel(self.after_desc_frame, text="Description", font=("Arial", 14)).pack(anchor="w", padx=10)
        self.after_desc_textbox = ctk.CTkTextbox(self.after_desc_frame, height=60, wrap="word", corner_radius=0, fg_color="#1e1e1e")
        self.after_desc_textbox.pack(fill="both", expand=True)

    def set_before_image(self, event):
        """Set the selected image as the Before Image."""
        selected_item = self.photo_list.selection()
        if not selected_item:
            print("⚠ Ignoring empty click in Treeview")
            return

        photo_id = int(selected_item[0])  # Convert ID to integer

        # ✅ Retrieve file path from our dictionary
        file_path = self.photo_file_paths.get(photo_id)

        if file_path and os.path.exists(file_path):
            self.before_image_index = self.photo_paths.index(file_path)  # Track index
            self.load_image(file_path, self.before_label, "before")  # ✅ Display it
        else:
            print(f"⚠ Error: {file_path} not found in photo_paths list or does not exist.")


    def set_after_image(self, event):
        """Set the selected image as the After Image."""
        selected_item = self.photo_list.selection()
        if not selected_item:
            print("⚠ Ignoring empty click in Treeview")
            return

        photo_id = int(selected_item[0])  # Convert ID to integer

        # ✅ Retrieve file path from our dictionary
        file_path = self.photo_file_paths.get(photo_id)

        if file_path and os.path.exists(file_path):
            self.after_image_index = self.photo_paths.index(file_path)  # Track index
            self.load_image(file_path, self.after_label, "after")  # ✅ Display it
        else:
            print(f"⚠ Error: {file_path} not found in photo_paths list or does not exist.")

    def load_image(self, file_path, label, frame_type):
        """Load and display an image in the specified label while preserving aspect ratio."""
        print(f"🟢 Debug: Attempting to load image → {file_path}")

        if not os.path.exists(file_path):
            print(f"❌ File does NOT exist: {file_path}")
            label.configure(text="Image not found", image="")
            return

        try:
            img = Image.open(file_path)
            print(f"✅ Successfully loaded image: {file_path}")

            # ✅ FIX: Prevent label from dynamically resizing each time
            label.update_idletasks()  # Ensure we have the correct width/height
            fixed_width, fixed_height = 279, 372  # Manually set fixed dimensions

            # ✅ Preserve aspect ratio while fitting within `fixed_width` & `fixed_height`
            img_ratio = img.width / img.height
            target_ratio = fixed_width / fixed_height

            if img_ratio > target_ratio:
                # Image is wider than target → Fit width, adjust height proportionally
                new_width = fixed_width
                new_height = int(fixed_width / img_ratio)
            else:
                # Image is taller than target → Fit height, adjust width proportionally
                new_height = fixed_height
                new_width = int(fixed_height * img_ratio)

            img = img.resize((new_width, new_height), Image.LANCZOS)

            # ✅ Convert to CTkImage & Apply Fixed Size
            photo = CTkImage(img, size=(fixed_width, fixed_height))  # Ensure consistent sizing
            print(f"✅ CTkImage created successfully with size {fixed_width}x{fixed_height}")

            # ✅ Center the image inside the label (to prevent odd spacing issues)
            label.configure(image=photo, text="", width=fixed_width, height=fixed_height)
            label.image = photo  # Keep reference to prevent garbage collection

            # ✅ Update Metadata for the Image
            self.update_photo_metadata(file_path, frame_type)

        except Exception as e:
            print(f"⚠ Error loading image: {e}")
            label.configure(text="Error loading image", image="")

    def update_photo_metadata(self, file_path, frame_type):
        """Update the date label and description based on the selected photo."""
        if not file_path:
            print(f"⚠ Warning: No file path provided for metadata lookup.")
            return

        self.cursor.execute("SELECT appt_date, description FROM photos WHERE file_path = ?", (file_path,))  # ✅ Fix column name
        result = self.cursor.fetchone()

        if result:
            appointment_date, description = result

            # ✅ Debugging log
            print(f"🟢 Retrieved metadata → Date: {appointment_date}, Description: {description}")

            if frame_type == "before":
                self.before_date_label.configure(text=appointment_date)
                self.before_desc_textbox.delete("1.0", "end")
                self.before_desc_textbox.insert("1.0", description if description else "<No Description Yet>")
            elif frame_type == "after":
                self.after_date_label.configure(text=appointment_date)
                self.after_desc_textbox.delete("1.0", "end")
                self.after_desc_textbox.insert("1.0", description if description else "<No Description Yet>")
        else:
            print(f"⚠ Warning: No metadata found for {file_path}")

    def navigate_image(self, direction, frame_type):
        """Cycle through images using navigation buttons."""
        if not self.photo_paths:
            return  # No images available

        if frame_type == "before":
            self.before_image_index = (self.before_image_index + direction) % len(self.photo_paths)
            file_path = self.photo_paths[self.before_image_index]
            self.load_image(file_path, self.before_label, "before")
        elif frame_type == "after":
            self.after_image_index = (self.after_image_index + direction) % len(self.photo_paths)
            file_path = self.photo_paths[self.after_image_index]
            self.load_image(file_path, self.after_label, "after")

    def refresh_photos_list(self, client_id):
        """Load photos for the selected client into the Treeview/Listbox with thumbnails."""
        self.before_label.configure(text="<No Image Selected>", image="")
        self.after_label.configure(text="<No Image Selected>", image="")
        self.before_date_label.configure(text="                   ")  # Clear before date
        self.after_date_label.configure(text="                   ")  # Clear after date
        self.before_desc_textbox.delete("1.0", "end")  # Clear before description
        self.after_desc_textbox.delete("1.0", "end")  # Clear after description

        # ✅ Reset Navigation Indexes
        self.before_image_index = 0
        self.after_image_index = 0

        self.photo_list.delete(*self.photo_list.get_children())  # ✅ Clear existing list
        self.photo_file_paths.clear()
        self.photo_paths.clear()
        self.thumbnails.clear()
        print("🔄 Debug: Cleared previous photo data.")

        # Fetch all photos for the selected client, sorted by most recent
        self.cursor.execute("SELECT id, appt_date, treatment, file_path FROM photos WHERE client_id = ? ORDER BY appt_date DESC", (client_id,))
        photos = self.cursor.fetchall()

        print(f"🟢 Debug: Fetched {len(photos)} photos for Client ID {client_id}")
        if not photos:
            print(f"⚠ No photos found for Client ID {client_id}")
            return

        # Store paths & insert into Treeview/Listbox
        for photo in photos:
            photo_id, appt_date, treatment, file_path = photo  # ✅ Corrected order

            # ✅ Ensure `photo_id` is unique in the Treeview
            if self.photo_list.exists(str(photo_id)):  # Tkinter requires `iid` as a string
                print(f"⚠ Warning: Duplicate Photo ID {photo_id} detected, skipping...")
                continue  # Skip inserting duplicates

            print(f"🖼️ Debug: Adding Photo ID {photo_id} | Path: {file_path} | Date: {appt_date} | Treatment: {treatment}")

            # ✅ Generate and store thumbnail (if file exists)
            thumbnail = self.generate_thumbnail(file_path, photo_id) if file_path else None
            self.photo_file_paths[photo_id] = file_path  # ✅ Map ID → file_path for selection
            self.photo_paths.append(file_path)  # ✅ Store correct path for navigation

            # ✅ Insert into Treeview, linking the image via the `image` parameter
            print(f"📌 Inserting Image: {self.thumbnails.get(str(photo_id))} for ID {photo_id}")
            self.photo_list.insert(
                "", "end", iid=str(photo_id),  # Tkinter requires `iid` as a string
                values=(appt_date, treatment),  # Leave first column empty for image
                image=self.thumbnails.get(str(photo_id), None)  # ✅ Use stored thumbnail, None if missing
            )

        print(f"🔍 Debug: Thumbnails dictionary contains {len(self.thumbnails)} entries")
        for key, value in self.thumbnails.items():
            print(f"  🔹 {key} → {value}")

        print(f"🟢 Loaded {len(photos)} photos for Client ID: {client_id}")

    def generate_thumbnail(self, file_path, photo_id, size=(50, 50)):  # Adjust size as needed
        """Generate and return a thumbnail image for Treeview."""
        try:
            if os.path.exists(file_path):
                img = Image.open(file_path)

                # ✅ **Step 1: Ensure Image is in RGB Mode (Fix for PNGs with Alpha)**
                img = img.convert("RGB")  # Ensures consistent color mode

                # ✅ **Step 2: Crop to Square Center**
                width, height = img.size
                min_side = min(width, height)
                left = (width - min_side) / 2
                top = (height - min_side) / 2
                right = (width + min_side) / 2
                bottom = (height + min_side) / 2
                img = img.crop((left, top, right, bottom))

                # ✅ **Step 3: Resize to 50x50**
                img = img.resize(size, Image.LANCZOS)

                # ✅ **Step 4: Convert to Tkinter-compatible Image**
                thumbnail = ImageTk.PhotoImage(img)  # ✅ Keep reference to prevent GC
                
                self.thumbnails[str(photo_id)] = thumbnail  # ✅ Store reference
                print(f"✅ Debug: Generated thumbnail for {photo_id} ({file_path})")
                return thumbnail  # ✅ Return image
            else:
                print(f"⚠ Error: File does not exist - {file_path}")
                return None
        except Exception as e:
            print(f"⚠ Error generating thumbnail for {file_path}: {e}")
            return None

    def on_photo_selected(self, event):
        """Display the selected photo(s) in the Before/After panes."""
        selected_items = self.photo_list.selection()

        if not selected_items:
            return

        selected_photos = []
        
        # Fetch the actual file paths instead of thumbnails
        for item in selected_items[:2]:
            self.cursor.execute("SELECT file_path FROM photos WHERE id = ?", (item,))
            result = self.cursor.fetchone()
            if result:
                selected_photos.append(result[0])

        # Load images into Before/After panes
        if len(selected_photos) > 0:
            self.before_image_index = self.photo_paths.index(selected_photos[0])
            self.load_image(selected_photos[0], self.before_label)

        if len(selected_photos) > 1:
            self.after_image_index = self.photo_paths.index(selected_photos[1])
            self.load_image(selected_photos[1], self.after_label)

    def clear_selection_on_empty_click(self, event):
        """Deselects Treeview selection when clicking an empty space."""
        region = self.photo_list.identify("region", event.x, event.y)

        if region not in ("cell", "item"):  # ✅ Click is outside rows
            print("⚠ Clicked on empty space, clearing selection.")
            self.photo_list.selection_remove(self.photo_list.selection())  # ✅ Deselect all
