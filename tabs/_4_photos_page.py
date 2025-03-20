import customtkinter as ctk
from tkinter import ttk
from tkinter import filedialog
from PIL import Image, ImageTk
from customtkinter import CTkImage
from class_elements.treeview_styling import style_treeview
import os

class PhotosPage:
    def __init__(self, parent, conn, main_app, image_cache):
        self.conn = conn
        self.cursor = conn.cursor()
        self.main_app = main_app        # Reference to main app
        self.image_cache = image_cache  # Store reference to the shared image cache
        self.client_id = None           # Store selected client ID

        self.before_image_index = -1  # Track navigation index
        self.after_image_index = -1

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
        treeview_frame.grid(row=0, column=0, rowspan=3, sticky="nsew", padx=(0, 5))

        # Apply treeview styling
        style_treeview("Photos.Treeview", rowheight=55)

        self.photo_list = ttk.Treeview(treeview_frame, selectmode="browse", show="tree headings", style="Photos.Treeview")
        self.photo_list["columns"] = ("appt_date", "type")
        self.photo_list.heading("#0", text="Thumbnail")  # Thumbnail as the first column
        self.photo_list.heading("appt_date", text="Date")
        self.photo_list.heading("type", text="Type")
        self.photo_list.column("#0", width=85, stretch=False)  # Use the implicit first column for thumbnails
        self.photo_list.column("appt_date", width=50, anchor="center")
        self.photo_list.column("type", width=65, anchor="center")
        self.photo_list.pack(fill="both", expand=True)
        self.photo_list.bind("<ButtonRelease-1>", self.set_before_image)            # Set Before Image
        self.photo_list.bind("<Control-ButtonRelease-1>", self.set_after_image)     # Set After Image
        self.photo_list.tag_configure("before_highlight", background="#0080FF")  # Before highlight color
        self.photo_list.tag_configure("after_highlight", background="green")   # Before highlight color

        # Before Image Preview Pane (Middle Column)
        before_frame = ctk.CTkFrame(main_frame, width=279, height=372, fg_color="#0080FF")
        before_frame.grid(row=0, column=1, columnspan=3, sticky="nsew", padx=(5, 5))

        ctk.CTkLabel(before_frame, text="Before", font=("Arial", 16)).pack()
        self.before_label = ctk.CTkLabel(before_frame, text="<No Image Selected>", width=279, height=372, fg_color="gray")
        self.before_label.pack(pady=(0, 10))

        # After Image Preview Pane (Right Column)
        after_frame = ctk.CTkFrame(main_frame, width=279, height=372, fg_color="green")
        after_frame.grid(row=0, column=4, columnspan=3, sticky="nsew", padx=(5, 0))

        ctk.CTkLabel(after_frame, text="After", font=("Arial", 16)).pack()
        self.after_label = ctk.CTkLabel(after_frame, text="<No Image Selected>", width=279, height=372, fg_color="gray")
        self.after_label.pack(pady=(0, 10))

        # Navigation Buttons & Date Label (Before Image)
        self.before_nav_frame = ctk.CTkFrame(main_frame, fg_color="#2b2b2b")
        self.before_nav_frame.grid(row=1, column=2, sticky="ew", pady=(5, 5))

        self.before_left_button = ctk.CTkButton(self.before_nav_frame, text="", image=back_arrow, width=30, command=lambda: self.navigate_image(-1, "before"))
        self.before_left_button.pack(side="left")

        self.before_date_label = ctk.CTkLabel(self.before_nav_frame, text="                   ", font=("Arial", 12, "bold"))
        self.before_date_label.pack(side="left", expand=True)

        self.before_right_button = ctk.CTkButton(self.before_nav_frame, text="", image=fwd_arrow, width=30, command=lambda: self.navigate_image(1, "before"))
        self.before_right_button.pack(side="right")

        # Navigation Buttons & Date Label (After Image)
        self.after_nav_frame = ctk.CTkFrame(main_frame, fg_color="#2b2b2b")
        self.after_nav_frame.grid(row=1, column=5, sticky="ew", pady=(5, 5))

        self.after_left_button = ctk.CTkButton(self.after_nav_frame, text="", image=back_arrow, width=30, command=lambda: self.navigate_image(-1, "after"))
        self.after_left_button.pack(side="left")

        self.after_date_label = ctk.CTkLabel(self.after_nav_frame, text="                   ", font=("Arial", 12, "bold"))
        self.after_date_label.pack(side="left", expand=True)

        self.after_right_button = ctk.CTkButton(self.after_nav_frame, text="", image=fwd_arrow, width=30, command=lambda: self.navigate_image(1, "after"))
        self.after_right_button.pack(side="right")

        # Photo Description Box (Before Image)
        self.before_desc_frame = ctk.CTkFrame(main_frame)
        self.before_desc_frame.grid(row=2, column=1, columnspan=3, sticky="nsew", padx=(5, 5))
        self.before_header_frame = ctk.CTkFrame(self.before_desc_frame, fg_color="#333333")
        self.before_header_frame.pack(fill="both", padx=10) 

        ctk.CTkLabel(self.before_header_frame, text="Description", font=("Arial", 14)).pack(side="left", pady=(5,0))
        self.before_save_button = ctk.CTkButton(self.before_header_frame, text="Save", width=60, height=20, command=self.save_before_description, state="disabled", fg_color="#696969", text_color="white")
        self.before_save_button.pack(side="right")
        self.before_desc_textbox = ctk.CTkTextbox(self.before_desc_frame, height=60, wrap="word", corner_radius=0, fg_color="#1e1e1e")
        self.before_desc_textbox.pack(fill="both", expand=True)
        self.before_desc_textbox.bind("<KeyRelease>", self.on_before_text_change)

        # Photo Description Box (After Image)
        self.after_desc_frame = ctk.CTkFrame(main_frame)
        self.after_desc_frame.grid(row=2, column=4, columnspan=3, sticky="nsew", padx=(5, 0))
        self.after_header_frame = ctk.CTkFrame(self.after_desc_frame, fg_color="#333333")
        self.after_header_frame.pack(fill="both", padx=10) 

        ctk.CTkLabel(self.after_header_frame, text="Description", font=("Arial", 14)).pack(side="left", pady=(5,0))
        self.after_save_button = ctk.CTkButton(self.after_header_frame, text="Save", width=60, height=20, command=self.save_after_description, state="disabled", fg_color="#696969", text_color="white")
        self.after_save_button.pack(side="right") 
        self.after_desc_textbox = ctk.CTkTextbox(self.after_desc_frame, height=60, wrap="word", corner_radius=0, fg_color="#1e1e1e")
        self.after_desc_textbox.pack(fill="both", expand=True)
        self.after_desc_textbox.bind("<KeyRelease>", self.on_after_text_change)


    def set_before_image(self, event):
        """Set the selected image as the Before Image and ensure After highlight isn't forced."""
        selected_item = self.photo_list.selection()
        if not selected_item:
            print("⚠ Ignoring empty click in Treeview")
            return

        photo_id = int(selected_item[0])  # Convert ID to integer

        # Retrieve file path from our dictionary
        file_path = self.photo_file_paths.get(photo_id)

        if file_path and os.path.exists(file_path):
            self.before_image_index = self.photo_paths.index(file_path)  # Track index
            self.load_image(file_path, self.before_label, "before")

            # ✅ Reset save button state for Before
            self.before_save_button.configure(state="disabled", text="Save", fg_color="#696969")

            # ✅ Only update highlights if an After image was actually set (Prevent green auto-highlighting)
            if self.after_image_index != -1:
                self.highlight_images_in_treeview()

            print(f"🟢 Selected Before Image: {file_path} (Index: {self.before_image_index})")
        else:
            print(f"⚠ Error: {file_path} not found in photo_paths list or does not exist.")


    def set_after_image(self, event):
        """Set the selected image as the After Image with no restrictions."""
        selected_item = self.photo_list.selection()
        if not selected_item:
            print("⚠ Ignoring empty click in Treeview")
            return

        photo_id = int(selected_item[0])  # Convert ID to integer

        # Retrieve file path from our dictionary
        file_path = self.photo_file_paths.get(photo_id)

        if file_path and os.path.exists(file_path):
            self.after_image_index = self.photo_paths.index(file_path)  # ✅ Always allow selection
            self.load_image(file_path, self.after_label, "after")

            # ✅ Reset save button state for After
            self.after_save_button.configure(state="disabled", text="Save", fg_color="#696969")

            # ✅ Apply highlighting in treeview
            self.highlight_images_in_treeview()
            print(f"🟢 Selected After Image: {file_path} (Index: {self.after_image_index})")
        else:
            print(f"⚠ Error: {file_path} not found in photo_paths list or does not exist.")


    def save_before_description(self):
        """Save the before image description to the database and update UI."""
        if not hasattr(self, "before_label") or not self.before_label.image:
            print("⚠ No before image selected.")
            return

        file_path = self.photo_paths[self.before_image_index]
        new_description = self.before_desc_textbox.get("1.0", "end").strip()

        self.cursor.execute("SELECT id FROM photos WHERE file_path = ?", (file_path,))
        result = self.cursor.fetchone()

        if result:
            photo_id = result[0]
            self.cursor.execute("UPDATE photos SET description = ? WHERE id = ?", (new_description, photo_id))
            self.conn.commit()
            print(f"✅ Saved description for Before Image (Photo ID: {photo_id})")

            # ✅ Store new description as the original
            self.before_original_text = new_description

            # ✅ Disable Save button after saving
            self.before_save_button.configure(state="disabled", text="Saved!", fg_color="#696969")


    def save_after_description(self):
        """Save the after image description to the database and update UI."""
        if not hasattr(self, "after_label") or not self.after_label.image:
            print("⚠ No after image selected.")
            return

        file_path = self.photo_paths[self.after_image_index]
        new_description = self.after_desc_textbox.get("1.0", "end").strip()

        self.cursor.execute("SELECT id FROM photos WHERE file_path = ?", (file_path,))
        result = self.cursor.fetchone()

        if result:
            photo_id = result[0]
            self.cursor.execute("UPDATE photos SET description = ? WHERE id = ?", (new_description, photo_id))
            self.conn.commit()
            print(f"✅ Saved description for After Image (Photo ID: {photo_id})")

            # ✅ Store new description as the original
            self.after_original_text = new_description

            # ✅ Disable Save button after saving
            self.after_save_button.configure(state="disabled", text="Saved!", fg_color="#696969")


    def on_before_text_change(self, event):
        """Enable the Save button when the before description is modified."""
        if not hasattr(self, "before_original_text"):
            return  # Ensure original text is set

        current_text = self.before_desc_textbox.get("1.0", "end")

        if current_text and current_text != self.before_original_text:
            # print("🟢 Text changed! Enabling Save button.")
            self.before_save_button.configure(state="normal", text="Save", fg_color="#3B8ED0")
        else:
            # print("🔴 No change detected. Disabling Save button.")
            self.before_save_button.configure(state="disabled", text="Saved!", fg_color="#696969")


    def on_after_text_change(self, event):
        """Enable the Save button only if the text has changed from the original."""
        if not hasattr(self, "after_original_text"):
            return  # Ensure original text is set

        current_text = self.after_desc_textbox.get("1.0", "end")

        if current_text and current_text != self.after_original_text:
            # print("🟢 Text changed! Enabling Save button.")
            self.after_save_button.configure(state="normal", text="Save", fg_color="#3B8ED0")
        else:
            # print("🔴 No change detected. Disabling Save button.")
            self.after_save_button.configure(state="disabled", text="Saved!", fg_color="#696969")


    def load_image(self, file_path, label, frame_type):
        """Load and display an image in the specified label, using cached images for faster loading."""
        print(f"🟢 Debug: Attempting to load image → {file_path}")

        if not os.path.exists(file_path):
            print(f"❌ File does NOT exist: {file_path}")
            label.configure(text="Image not found", image="")
            return
        
        try:
            # Use the correct `get_image()` method
            image = self.image_cache.get_image(file_path)

            if image:
                print(f"⚡ Instant Load: Using cached image for {file_path}")
            else:
                print(f"🛠️ Processing image → {file_path}")
                image = self.image_cache.preload_image(file_path)  # Preload and cache the image

            if image:
                label.configure(image=image, text="", width=279, height=372)
                label.image = image  # Keep reference to prevent garbage collection

            # Update metadata for the image
            self.update_photo_metadata(file_path, frame_type)

        except Exception as e:
            print(f"⚠ Error loading image: {e}")
            label.configure(text="Error loading image", image="")


    def update_photo_metadata(self, file_path, frame_type):
        """Update the date label and description based on the selected photo."""
        if not file_path:
            print(f"⚠ Warning: No file path provided for metadata lookup.")
            return

        self.cursor.execute("SELECT appt_date, description FROM photos WHERE file_path = ?", (file_path,))  # Fix column name
        result = self.cursor.fetchone()

        if result:
            appointment_date, description = result

            # Debugging log
            print(f"🟢 Retrieved metadata → Date: {appointment_date}, Description: {description}")

            if frame_type == "before":
                self.before_date_label.configure(text=appointment_date)

                self.before_desc_textbox.unbind("<KeyRelease>")  # Temporarily unbind event
                self.before_desc_textbox.delete("1.0", "end")
                self.before_desc_textbox.insert("1.0", description if description else "<No Description Yet>")
                self.before_desc_textbox.bind("<KeyRelease>", self.on_before_text_change)  # Rebind event

                self.before_original_text = description if description else ""

            elif frame_type == "after":
                self.after_date_label.configure(text=appointment_date)

                self.after_desc_textbox.unbind("<KeyRelease>")
                self.after_desc_textbox.delete("1.0", "end")
                self.after_desc_textbox.insert("1.0", description if description else "<No Description Yet>")
                self.after_desc_textbox.bind("<KeyRelease>", self.on_after_text_change)

                self.after_original_text = description if description else ""
        else:
            print(f"⚠ Warning: No metadata found for {file_path}")


    def navigate_image(self, direction, frame_type):
        """Navigate through images, preventing wrap-around but allowing free movement."""
        if not self.photo_paths:
            return  # No images available

        if frame_type == "before":
            new_index = self.before_image_index + direction

            # ✅ Prevent wrap-around (stay within range)
            if new_index < 0 or new_index >= len(self.photo_paths):
                print("⚠ Cannot navigate further in this direction.")
                return  # Stay at the current image

            self.before_image_index = new_index
            file_path = self.photo_paths[self.before_image_index]
            self.load_image(file_path, self.before_label, "before")

        elif frame_type == "after":
            new_index = self.after_image_index + direction

            # ✅ Prevent wrap-around (stay within range)
            if new_index < 0 or new_index >= len(self.photo_paths):
                print("⚠ Cannot navigate further in this direction.")
                return  # Stay at the current image

            self.after_image_index = new_index
            file_path = self.photo_paths[self.after_image_index]
            self.load_image(file_path, self.after_label, "after")

        # Clear selection to avoid confusion but keep colored row highlights
        self.photo_list.selection_remove(self.photo_list.selection())

        # Call highlight function after navigating
        self.highlight_images_in_treeview()


    def refresh_photos_list(self, client_id):
        """Load photos for the selected client into the Treeview/Listbox with thumbnails."""
        self.before_label.configure(text="<No Image Selected>", image="")
        self.after_label.configure(text="<No Image Selected>", image="")
        self.before_date_label.configure(text="                   ")  # Clear before date
        self.after_date_label.configure(text="                   ")  # Clear after date
        self.before_desc_textbox.delete("1.0", "end")  # Clear before description
        self.after_desc_textbox.delete("1.0", "end")  # Clear after description

        # Reset Save Buttons (Prevent previous client's data from affecting new selection)
        self.before_save_button.configure(state="disabled", text="Save", fg_color="#696969")
        self.after_save_button.configure(state="disabled", text="Save", fg_color="#696969")

        # Reset original texts (Prevents Save button from activating incorrectly)
        self.before_original_text = ""
        self.after_original_text = ""

        # Reset Navigation Indexes
        self.before_image_index = -1
        self.after_image_index = -1

        self.photo_list.delete(*self.photo_list.get_children())  # Clear existing list
        self.photo_file_paths.clear()
        self.photo_paths.clear()

        print("🔄 Debug: Cleared previous photo data.")

        # Fetch all photos for the selected client, sorted by most recent
        self.cursor.execute("SELECT id, appt_date, type, file_path FROM photos WHERE client_id = ? ORDER BY appt_date DESC", (client_id,))
        photos = self.cursor.fetchall()

        print(f"🟢 Debug: Fetched {len(photos)} photos for Client ID {client_id}")
        if not photos:
            print(f"⚠ No photos found for Client ID {client_id}")
            return

        for photo in photos:
            photo_id, appt_date, type, file_path = photo  # Unpack data

            # Ensure `photo_id` is unique in the Treeview
            if self.photo_list.exists(str(photo_id)):
                continue  

            # print(f"🖼️ Debug: Adding Photo ID {photo_id} | Path: {file_path} | Date: {appt_date} | Type: {type}")

            # ✅ Retrieve cached thumbnail first
            thumbnail = self.image_cache.get_thumbnail(file_path)


            if not isinstance(thumbnail, ImageTk.PhotoImage):  # ✅ Must be PhotoImage for ttk.Treeview
                print(f"⚠ Warning: Cached thumbnail is invalid. Regenerating: {file_path}")
                thumbnail = self.generate_thumbnail(file_path, photo_id)  # Ensure this returns PhotoImage
                self.image_cache.add_thumbnail_to_cache(file_path, thumbnail)

            # ✅ If thumbnail is still invalid, log the issue and skip insertion
            if not isinstance(thumbnail, ImageTk.PhotoImage):
                print(f"❌ Error: Could not generate valid PhotoImage for {file_path}. Skipping...")
                continue  # Prevents Tkinter crash

            # ✅ Store the valid thumbnail reference
            self.thumbnails[str(photo_id)] = thumbnail  
            self.photo_file_paths[photo_id] = file_path  
            self.photo_paths.append(file_path)  

            # ✅ Insert into Treeview using PhotoImage
            self.photo_list.insert(
                "", "end", iid=str(photo_id),  # Tkinter requires `iid` as a string
                values=(appt_date, type),
                image=self.thumbnails[str(photo_id)]  # Use PhotoImage, not CTkImage
            )

        print(f"🔍 Debug: Thumbnail cache contains {len(self.thumbnails)} entries")
        print(f"🔍 Debug: Full-size image cache contains {len(self.image_cache.image_cache)} entries")


    def generate_thumbnail(self, file_path, photo_id, size=(50, 50)):  
        """Generate and return a Tkinter-compatible PhotoImage thumbnail for Treeview."""
        try:
            if not os.path.exists(file_path):
                print(f"❌ File does not exist: {file_path}")
                return None
            
            img = Image.open(file_path)
            img = img.convert("RGB")  # Ensures consistent color mode

            # Crop to square center
            width, height = img.size
            min_side = min(width, height)
            left = (width - min_side) / 2
            top = (height - min_side) / 2
            right = (width + min_side) / 2
            bottom = (height + min_side) / 2
            img = img.crop((left, top, right, bottom))

            # Resize to target size (50x50)
            img = img.resize(size, Image.LANCZOS)

            # ✅ Convert to `PhotoImage` for use in `ttk.Treeview`
            thumbnail = ImageTk.PhotoImage(img)  

            if not isinstance(thumbnail, ImageTk.PhotoImage):  
                print(f"⚠ Error: Thumbnail generation failed for {file_path}")
                return None

            return thumbnail  # ✅ Correct format for `ttk.Treeview`

        except Exception as e:
            print(f"⚠ Error generating thumbnail for {file_path}: {e}")
            return None


    def add_thumbnail_to_cache(self, file_path, thumbnail):
        """Add a thumbnail to the cache with LRU handling."""
        if not thumbnail or not isinstance(thumbnail, CTkImage):  # ✅ Extra safeguard
            print(f"⚠ Warning: Not caching invalid thumbnail for {file_path}")
            return  

        if file_path in self.thumbnail_cache:
            self.thumbnail_cache.move_to_end(file_path)
        else:
            if len(self.thumbnail_cache) >= self.cache_size:
                removed = self.thumbnail_cache.popitem(last=False)
                print(f"🔄 LRU Removed Oldest Thumbnail: {removed[0]}")

            self.thumbnail_cache[file_path] = thumbnail
            print(f"✅ Cached Thumbnail: {file_path}")


    def highlight_images_in_treeview(self):
        """Highlight Before and After images in the Treeview with different colors."""
        # ✅ Remove previous highlights
        for item in self.photo_list.get_children():
            self.photo_list.item(item, tags=())  # Clears all tags

        # ✅ Apply the Before highlight
        if self.before_image_index != -1 and self.before_image_index < len(self.photo_paths):
            before_file_path = self.photo_paths[self.before_image_index]
            before_photo_id = next((pid for pid, path in self.photo_file_paths.items() if path == before_file_path), None)
            if before_photo_id is not None:
                self.photo_list.item(str(before_photo_id), tags=("before_highlight",))

        # ✅ Apply the After highlight **ONLY IF** a valid After image was chosen
        if self.after_image_index != -1 and self.after_image_index < len(self.photo_paths):
            after_file_path = self.photo_paths[self.after_image_index]
            after_photo_id = next((pid for pid, path in self.photo_file_paths.items() if path == after_file_path), None)
            if after_photo_id is not None:
                self.photo_list.item(str(after_photo_id), tags=("after_highlight",))

        # ✅ Deselect all items to prevent default selection highlight
        self.photo_list.selection_remove(self.photo_list.selection())


    def preload_image(self, file_path):
        """Preload and resize an image for instant display."""
        try:
            img = Image.open(file_path)

            # ✅ Ensure consistent color mode (fixes issues with PNGs)
            img = img.convert("RGB")  

            # ✅ Resize image **once** and store it in cache
            fixed_width, fixed_height = 279, 372  
            img_ratio = img.width / img.height
            target_ratio = fixed_width / fixed_height

            if img_ratio > target_ratio:
                new_width = fixed_width
                new_height = int(fixed_width / img_ratio)
            else:
                new_height = fixed_height
                new_width = int(fixed_height * img_ratio)

            img = img.resize((new_width, new_height), Image.LANCZOS)

            # ✅ Convert to a CTkImage for Tkinter use
            return CTkImage(img, size=(fixed_width, fixed_height))

        except Exception as e:
            print(f"⚠ Error preloading image {file_path}: {e}")
            return None
