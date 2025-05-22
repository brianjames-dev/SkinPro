import customtkinter as ctk
from tkinter import ttk, filedialog, messagebox
from PIL import Image, ImageTk
from customtkinter import CTkImage
from class_elements.treeview_styling_light import style_treeview_light
from utils.path_utils import resource_path
import os
import sqlite3


class PhotosPage:
    def __init__(self, parent, main_app, image_cache, image_loader, data_manager):
        self.main_app = main_app
        self.image_cache = image_cache  # Store reference the shared image cache
        self.image_loader = image_loader
        self.data_manager = data_manager
        self.client_id = None           # Store selected client ID

        self.before_image_index = -1  # Track navigation index
        self.after_image_index = -1
        self.last_clicked_index = None  # Used for shift+click range selection

        self.photo_paths = []  # Stores tuples of (photo_id, file_path) for navigation
        self.photo_file_paths = {}
        self.thumbnails = {}  # Stores {photo_id: thumbnail image} for Treeview
        
        # Load images for buttons
        back_arrow = ctk.CTkImage(Image.open(resource_path("icons/arrow_back.png")), size=(16, 16))
        fwd_arrow = ctk.CTkImage(Image.open(resource_path("icons/arrow_forward.png")), size=(16, 16))

        # Create Main Frame
        main_frame = ctk.CTkFrame(parent)
        main_frame.pack(fill="both", expand=True, padx=10)

        # Configure grid layout
        main_frame.columnconfigure(0, weight=2, minsize=420)  # Listbox column
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
        style_treeview_light("Photos.Treeview", rowheight=105, font=("Helvetica", 18))

        # Grid layout in treeview_frame
        treeview_frame.rowconfigure(0, weight=1)
        treeview_frame.columnconfigure(0, weight=1)

        self.photo_list = ttk.Treeview(treeview_frame, selectmode="browse", show="tree headings", style="Photos.Treeview")
        self.photo_list["columns"] = ("appt_date", "type")
        self.photo_list.heading("#0", text="Thumbnail")  # Thumbnail as the first column
        self.photo_list.heading("appt_date", text="Date")
        self.photo_list.heading("type", text="Type")
        self.photo_list.column("#0", width=150, stretch=False)  # Use the implicit first column for thumbnails
        self.photo_list.column("appt_date", width=55, anchor="center")
        self.photo_list.column("type", width=60, anchor="center")
        self.photo_list.grid(row=0, column=0, sticky="nsew")
        self.photo_list.bind("<ButtonRelease-1>", self.set_before_image)         # Set Before Image
        self.photo_list.bind("<Control-ButtonRelease-1>", self.set_after_image)  # Set After Image
        self.photo_list.bind("<Shift-ButtonRelease-1>", self.handle_shift_click)
        self.photo_list.bind("<Delete>", self.delete_photo)
        self.photo_list.bind("<BackSpace>", self.delete_photo)
        self.photo_list.tag_configure("before_highlight", background="#563A9C", foreground="#ebebeb")  # Before highlight color
        self.photo_list.tag_configure("after_highlight", background="#251254", foreground="#ebebeb")   # After highlight color

        # Add vertical scrollbar
        scrollbar = ttk.Scrollbar(treeview_frame, orient="vertical", command=self.photo_list.yview, style="Vertical.TScrollbar")
        scrollbar.grid(row=0, column=1, sticky="ns")
        self.photo_list.configure(yscrollcommand=scrollbar.set)

        # Before Image Preview Pane (Middle Column)
        before_frame = ctk.CTkFrame(main_frame, width=300, height=400, fg_color="#563A9C")
        before_frame.grid(row=0, column=1, columnspan=3, sticky="nsew", padx=(5, 5))

        ctk.CTkLabel(before_frame, text="Before", font=("Helvetica", 16, "bold"), fg_color="transparent", text_color="#ebebeb").pack()
        self.before_label = ctk.CTkLabel(before_frame, text="<No Image Selected>", width=300, height=400, fg_color="#ebebeb")
        self.before_label.pack(pady=(0, 5))

        # After Image Preview Pane (Right Column)
        after_frame = ctk.CTkFrame(main_frame, width=300, height=400, fg_color="#251254")
        after_frame.grid(row=0, column=4, columnspan=3, sticky="nsew", padx=(5, 0))

        ctk.CTkLabel(after_frame, text="After", font=("Helvetica", 16, "bold"), fg_color="transparent", text_color="#ebebeb").pack()
        self.after_label = ctk.CTkLabel(after_frame, text="<No Image Selected>", width=300, height=400, fg_color="#ebebeb")
        self.after_label.pack(pady=(0, 5))

        # Navigation Buttons & Date Label (Before Image)
        self.before_nav_frame = ctk.CTkFrame(main_frame)
        self.before_nav_frame.grid(row=1, column=2, sticky="ew", pady=(5, 5))

        self.before_left_button = ctk.CTkButton(self.before_nav_frame, text="", image=back_arrow, width=30, command=lambda: self.navigate_image(-1, "before"))
        self.before_left_button.pack(side="left")

        self.before_date_label = ctk.CTkLabel(self.before_nav_frame, text="                   ", font=("Helvetica", 12, "bold"), fg_color="#dbdbdb", padx=40)
        self.before_date_label.pack(side="left", expand=True)

        self.before_right_button = ctk.CTkButton(self.before_nav_frame, text="", image=fwd_arrow, width=30, command=lambda: self.navigate_image(1, "before"))
        self.before_right_button.pack(side="right")

        # Navigation Buttons & Date Label (After Image)
        self.after_nav_frame = ctk.CTkFrame(main_frame)
        self.after_nav_frame.grid(row=1, column=5, sticky="ew", pady=(5, 5))

        self.after_left_button = ctk.CTkButton(self.after_nav_frame, text="", image=back_arrow, width=30, command=lambda: self.navigate_image(-1, "after"))
        self.after_left_button.pack(side="left")

        self.after_date_label = ctk.CTkLabel(self.after_nav_frame, text="                   ", font=("Helvetica", 12, "bold"), fg_color="#dbdbdb", padx=40)
        self.after_date_label.pack(side="left", expand=True)

        self.after_right_button = ctk.CTkButton(self.after_nav_frame, text="", image=fwd_arrow, width=30, command=lambda: self.navigate_image(1, "after"))
        self.after_right_button.pack(side="right")

        # Photo Description Box (Before Image)
        self.before_desc_frame = ctk.CTkFrame(main_frame, fg_color="#563A9C")
        self.before_desc_frame.grid(row=2, column=1, columnspan=3, sticky="nsew", padx=(5, 5))
        self.before_header_frame = ctk.CTkFrame(self.before_desc_frame, fg_color="#563A9C")
        self.before_header_frame.pack(fill="both", padx=10) 

        ctk.CTkLabel(self.before_header_frame, text="Description", font=("Helvetica", 14, "bold"), fg_color="transparent", text_color="#ebebeb").pack(side="left", pady=(5,0))
        self.before_save_button = ctk.CTkButton(self.before_header_frame, text="Save", width=60, height=20, command=self.save_before_description, state="disabled", fg_color="#696969", text_color="#ebebeb")
        self.before_save_button.pack(side="right")
        self.before_desc_textbox = ctk.CTkTextbox(self.before_desc_frame, height=60, wrap="word", corner_radius=7)
        self.before_desc_textbox.pack(fill="both", expand=True, padx=5, pady=(0, 5))
        self.before_desc_textbox.bind("<KeyRelease>", self.on_before_text_change)

        # Photo Description Box (After Image)
        self.after_desc_frame = ctk.CTkFrame(main_frame, fg_color="#563A9C")
        self.after_desc_frame.grid(row=2, column=4, columnspan=3, sticky="nsew", padx=(5, 0))
        self.after_header_frame = ctk.CTkFrame(self.after_desc_frame, fg_color="#563A9C")
        self.after_header_frame.pack(fill="both", padx=10) 

        ctk.CTkLabel(self.after_header_frame, text="Description", font=("Helvetica", 14, "bold"), fg_color="transparent", text_color="#ebebeb").pack(side="left", pady=(5,0))
        self.after_save_button = ctk.CTkButton(self.after_header_frame, text="Save", width=60, height=20, command=self.save_after_description, state="disabled", fg_color="#696969", text_color="#ebebeb")
        self.after_save_button.pack(side="right") 
        self.after_desc_textbox = ctk.CTkTextbox(self.after_desc_frame, height=60, wrap="word", corner_radius=7)
        self.after_desc_textbox.pack(fill="both", expand=True, padx=5, pady=(0, 5))
        self.after_desc_textbox.bind("<KeyRelease>", self.on_after_text_change)


    def set_before_image(self, event):
        selected_item = self.photo_list.selection()
        if not selected_item:
            print("Ignoring empty click in Treeview")
            return

        clicked_item = self.photo_list.identify_row(event.y)
        if clicked_item:
            all_items = self.photo_list.get_children()
            self.last_clicked_index = all_items.index(clicked_item)

        photo_id = int(selected_item[0])
        file_path = self.photo_file_paths.get(photo_id)

        if file_path and os.path.exists(file_path):
            self.before_image_index = self.photo_paths.index(file_path)
            self.load_image(file_path, self.before_label, "before")
            self.before_save_button.configure(state="disabled", text="Save", fg_color="#696969")

            # Force selection to this photo to ensure deletion works
            self.photo_list.selection_set(str(photo_id))
            self.photo_list.focus(str(photo_id))

            if self.after_image_index != -1:
                self.highlight_images_in_treeview()

            print(f"Selected Before Image: {file_path} (Index: {self.before_image_index})")
        else:
            print(f"Error: {file_path} not found in photo_paths list or does not exist.")


    def set_after_image(self, event):
        selected_item = self.photo_list.selection()
        if not selected_item:
            print("Ignoring empty click in Treeview")
            return

        photo_id = int(selected_item[0])
        file_path = self.photo_file_paths.get(photo_id)

        if file_path and os.path.exists(file_path):
            self.after_image_index = self.photo_paths.index(file_path)
            self.load_image(file_path, self.after_label, "after")
            self.after_save_button.configure(state="disabled", text="Save", fg_color="#696969")
            self.highlight_images_in_treeview()
            print(f"Selected After Image: {file_path} (Index: {self.after_image_index})")

            # Always reselect the before image after setting after image
            if self.before_image_index != -1 and self.before_image_index < len(self.photo_paths):
                before_file_path = self.photo_paths[self.before_image_index]
                before_photo_id = next((pid for pid, path in self.photo_file_paths.items() if path == before_file_path), None)
                if before_photo_id is not None:
                    self.photo_list.selection_set(str(before_photo_id))
                    self.photo_list.focus(str(before_photo_id))

        else:
            print(f"Error: {file_path} not found in photo_paths list or does not exist.")


    def save_before_description(self):
        """Save the before image description to the database and update UI."""
        if not hasattr(self, "before_label") or not self.before_label.image:
            print("No before image selected.")
            return

        file_path = self.photo_paths[self.before_image_index]
        new_description = self.before_desc_textbox.get("1.0", "end").strip()

        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()

                cursor.execute("SELECT id FROM photos WHERE file_path = ?", (file_path,))
                result = cursor.fetchone()

                if result:
                    photo_id = result[0]
                    cursor.execute("UPDATE photos SET description = ? WHERE id = ?", (new_description, photo_id))
                    conn.commit()
                    print(f"Saved description for Before Image (Photo ID: {photo_id})")

                    # Store new description as the original
                    self.before_original_text = new_description

                    # Disable Save button after saving
                    self.before_save_button.configure(state="disabled", text="Saved!", fg_color="#696969")
                else:
                    print("No photo record found for the selected file path.")

        except Exception as e:
            print(f"Failed to save before image description: {e}")


    def save_after_description(self):
        """Save the after image description to the database and update UI."""
        if not hasattr(self, "after_label") or not self.after_label.image:
            print("⚠ No after image selected.")
            return

        file_path = self.photo_paths[self.after_image_index]
        new_description = self.after_desc_textbox.get("1.0", "end").strip()

        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()

                cursor.execute("SELECT id FROM photos WHERE file_path = ?", (file_path,))
                result = cursor.fetchone()

                if result:
                    photo_id = result[0]
                    cursor.execute("UPDATE photos SET description = ? WHERE id = ?", (new_description, photo_id))
                    conn.commit()
                    print(f"Saved description for After Image (Photo ID: {photo_id})")

                    # Store new description as the original
                    self.after_original_text = new_description

                    # Disable Save button after saving
                    self.after_save_button.configure(state="disabled", text="Saved!", fg_color="#696969")
                else:
                    print("No photo record found for the selected file path.")

        except Exception as e:
            print(f"Failed to save after image description: {e}")


    def on_before_text_change(self, event):
        """Enable the Save button when the before description is modified."""
        if not hasattr(self, "before_original_text"):
            return  # Ensure original text is set

        current_text = self.before_desc_textbox.get("1.0", "end")

        if current_text and current_text != self.before_original_text:
            # print("Text changed! Enabling Save button.")
            self.before_save_button.configure(state="normal", text="Save", fg_color="#563A9C")
        else:
            # print("No change detected. Disabling Save button.")
            self.before_save_button.configure(state="disabled", text="Saved!", fg_color="#696969")


    def on_after_text_change(self, event):
        """Enable the Save button only if the text has changed from the original."""
        if not hasattr(self, "after_original_text"):
            return  # Ensure original text is set

        current_text = self.after_desc_textbox.get("1.0", "end")

        if current_text and current_text != self.after_original_text:
            # print("Text changed! Enabling Save button.")
            self.after_save_button.configure(state="normal", text="Save", fg_color="#563A9C")
        else:
            # print("No change detected. Disabling Save button.")
            self.after_save_button.configure(state="disabled", text="Saved!", fg_color="#696969")


    def load_image(self, file_path, label, frame_type):
        """Load and display an image in the specified label, using cached images for faster loading."""
        print(f"Debug: Attempting to load image → {file_path}")

        if not os.path.exists(file_path):
            print(f"File does NOT exist: {file_path}")
            label.configure(text="Image not found", image="")
            return
        
        try:
            image = self.image_cache.get_image(file_path)

            if image:
                print(f"Instant Load: Using cached image for {file_path}")
                label.configure(image=image, text="", width=300, height=400)
                label.image = image  # Keep reference to prevent garbage collection

                # Update metadata for the image
                self.update_photo_metadata(file_path, frame_type)
            else:
                print(f"Failed to load image for {file_path}")

        except Exception as e:
            print(f"Error loading image: {e}")
            label.configure(text="Error loading image", image="")


    def update_photo_metadata(self, file_path, frame_type):
        """Update the date label and description based on the selected photo."""
        if not file_path:
            print(f"Warning: No file path provided for metadata lookup.")
            return

        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT appt_date, description FROM photos WHERE file_path = ?", (file_path,))
                result = cursor.fetchone()

            if result:
                appointment_date, description = result

                print(f"Retrieved metadata → Date: {appointment_date}, Description: {description}")

                if frame_type == "before":
                    self.before_date_label.configure(text=appointment_date)

                    self.before_desc_textbox.unbind("<KeyRelease>")
                    self.before_desc_textbox.delete("1.0", "end")
                    self.before_desc_textbox.insert("1.0", description if description else "<No Description Yet>")
                    self.before_desc_textbox.bind("<KeyRelease>", self.on_before_text_change)

                    self.before_original_text = description if description else ""

                elif frame_type == "after":
                    self.after_date_label.configure(text=appointment_date)

                    self.after_desc_textbox.unbind("<KeyRelease>")
                    self.after_desc_textbox.delete("1.0", "end")
                    self.after_desc_textbox.insert("1.0", description if description else "<No Description Yet>")
                    self.after_desc_textbox.bind("<KeyRelease>", self.on_after_text_change)

                    self.after_original_text = description if description else ""
            else:
                print(f"Warning: No metadata found for {file_path}")

        except Exception as e:
            print(f"Failed to retrieve photo metadata: {e}")


    def navigate_image(self, direction, frame_type):
        """Navigate through images, preventing wrap-around but allowing free movement."""
        if not self.photo_paths:
            return  # No images available

        if frame_type == "before":
            new_index = self.before_image_index + direction

            # Prevent wrap-around (stay within range)
            if new_index < 0 or new_index >= len(self.photo_paths):
                print("⚠ Cannot navigate further in this direction.")
                return  # Stay at the current image

            self.before_image_index = new_index
            file_path = self.photo_paths[self.before_image_index]
            self.load_image(file_path, self.before_label, "before")

        elif frame_type == "after":
            new_index = self.after_image_index + direction

            # Prevent wrap-around (stay within range)
            if new_index < 0 or new_index >= len(self.photo_paths):
                print("Cannot navigate further in this direction.")
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

        # Clear previous photos
        self.clear_photos_list()

        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, appt_date, type, file_path 
                    FROM photos 
                    WHERE client_id = ? 
                    ORDER BY appt_date DESC
                """, (client_id,))
                photos = cursor.fetchall()

            print(f"Debug: Fetched {len(photos)} photos for Client ID {client_id}")
            if not photos:
                print(f"No photos found for Client ID {client_id}")
                return

            for index, photo in enumerate(photos):
                photo_id, appt_date, type, file_path = photo

                if self.photo_list.exists(str(photo_id)):
                    continue

                self.photo_file_paths[photo_id] = file_path
                self.photo_paths.append(file_path)

                self.photo_list.insert(
                    "", "end", iid=str(photo_id),
                    values=(appt_date, type)
                )

                thumbnail = self.image_cache.get_thumbnail(file_path)

                if thumbnail is None:
                    self.image_loader.add_task(file_path, photo_id)
                else:
                    self.thumbnails[str(photo_id)] = thumbnail
                    self.photo_list.item(str(photo_id), image=thumbnail)

            print(f"Debug: Thumbnail cache contains {len(self.image_cache.thumbnail_cache)} entries")

        except Exception as e:
            print(f"Failed to refresh photo list: {e}")


    def clear_photos_list(self):
        """Clear the Treeview/Listbox and reset all relevant variables."""
        self.photo_list.delete(*self.photo_list.get_children())  # Clear existing list
        self.photo_file_paths.clear()
        self.photo_paths.clear()

        print("Cleared previous photo data.")


    def delete_photo(self, event=None):
        selected = self.photo_list.selection()
        if not selected:
            return

        confirm = messagebox.askyesno("Confirm Deletion", "Are you sure you want to delete the selected photo(s)?")
        if not confirm:
            return

        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()

                for iid in selected:
                    photo_id = int(iid)
                    file_path = self.photo_file_paths.get(photo_id)

                    # Delete file from disk
                    if file_path and os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception as e:
                            print(f"Failed to delete file {file_path}: {e}")

                    # Delete from DB
                    cursor.execute("DELETE FROM photos WHERE id = ?", (photo_id,))
                    print(f"Deleted: {file_path}")

                    # Remove from Treeview
                    self.photo_list.delete(iid)

                    # Clean up internal references
                    if file_path in self.photo_paths:
                        self.photo_paths.remove(file_path)
                    self.photo_file_paths.pop(photo_id, None)
                    self.thumbnails.pop(str(photo_id), None)

                conn.commit()

        except Exception as e:
            print(f"Failed to delete photo(s): {e}")

        # Optional: reset image previews if deleted image was being shown
        self.before_label.configure(text="<No Image Selected>", image="")
        self.after_label.configure(text="<No Image Selected>", image="")


    def handle_shift_click(self, event):
        # Get the row that was clicked
        clicked_item = self.photo_list.identify_row(event.y)
        if not clicked_item:
            return

        # Get list of all photo_ids (iids) in the Treeview
        all_items = self.photo_list.get_children()
        clicked_index = all_items.index(clicked_item)

        if self.last_clicked_index is None:
            self.last_clicked_index = clicked_index
            self.photo_list.selection_set(clicked_item)
        else:
            start = min(self.last_clicked_index, clicked_index)
            end = max(self.last_clicked_index, clicked_index)
            items_to_select = all_items[start:end + 1]
            self.photo_list.selection_set(items_to_select)

        # Restore focus to the most recent item
        self.photo_list.focus(clicked_item)


    def highlight_images_in_treeview(self):
        """Highlight Before and After images in the Treeview with different colors."""
        current_selection = self.photo_list.selection()

        # Remove previous highlights
        for item in self.photo_list.get_children():
            self.photo_list.item(item, tags=())  # Clears all tags

        # Apply the Before highlight
        if self.before_image_index != -1 and self.before_image_index < len(self.photo_paths):
            before_file_path = self.photo_paths[self.before_image_index]
            before_photo_id = next((pid for pid, path in self.photo_file_paths.items() if path == before_file_path), None)
            if before_photo_id is not None:
                self.photo_list.item(str(before_photo_id), tags=("before_highlight",))

        # Apply the After highlight
        if self.after_image_index != -1 and self.after_image_index < len(self.photo_paths):
            after_file_path = self.photo_paths[self.after_image_index]
            after_photo_id = next((pid for pid, path in self.photo_file_paths.items() if path == after_file_path), None)
            if after_photo_id is not None:
                self.photo_list.item(str(after_photo_id), tags=("after_highlight",))

        # Don't clear the user's manual selection anymore
        self.photo_list.selection_set(current_selection)
        if current_selection:
            self.photo_list.focus(current_selection[0])


    def update_ui_with_thumbnail(self, photo_id, thumbnail):
        """Update the Treeview with the new thumbnail and store the reference to prevent GC."""
        if self.photo_list.exists(str(photo_id)):
            self.thumbnails[str(photo_id)] = thumbnail  # Store the reference
            # Wrap in a function to bind thumbnail by default
            def set_item_image():
                self.photo_list.item(str(photo_id), image=self.thumbnails[str(photo_id)])

            self.main_app.after(0, set_item_image)

        else:
            print(f"Skipping UI update: Treeview item {photo_id} not found.")
