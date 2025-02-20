import customtkinter as ctk
from PIL import Image, ImageOps, ImageDraw
from tkinter import filedialog

# Image size
w, h = 58, 58

class ProfileCard:
    def __init__(self, parent, conn):
        self.conn = conn                            # Store database connection
        self.client_id = None                       # Selected client ID
        self.profile_path = "icons/add_photo.png"   # Default placeholder

        # Frame to hold the profile picture and name
        self.profile_frame = ctk.CTkFrame(parent, fg_color="transparent")
        self.profile_frame.pack(side="top", anchor="w", padx=(10, 0), pady=(10, 0))

        # **Initialize zoom & shift**
        self.zoom = 1.8                             # Default zoom level
        self.shift = 1                              # Default shift value

        # Placeholder image for profile picture
        self.profile_image = ctk.CTkImage(Image.open(self.profile_path), size=(w, h))

        # Create a button for the profile picture (Click to upload)
        self.profile_button = ctk.CTkButton(
            self.profile_frame,
            image=self.profile_image,
            text="",
            fg_color="transparent",
            hover_color="#242424",
            width=w, height=h,
            border_width=0,
            command=self.change_profile_picture  # Upload & open settings
        )
        self.profile_button.grid(row=0, column=0, padx=(0, 10), ipadx=0, ipady=0, sticky="nsew")

        # Label for the client's name
        self.name_label = ctk.CTkLabel(self.profile_frame, text="No Client Selected", font=("Arial", 16), anchor="w")
        self.name_label.grid(row=0, column=1, sticky="w")

    def change_profile_picture(self):
        """Step 1: Select a new image, then open the settings popup."""
        file_path = filedialog.askopenfilename(
            title="Select Profile Picture",
            filetypes=[("Image Files", "*.png;*.jpg;*.jpeg;*.bmp")]
        )
        if file_path:
            self.profile_path = file_path  # Save the new image path
            print(f"The path to the selected image: {self.profile_path}")
            self.open_settings_popup()  # Open settings window after selecting

    def open_settings_popup(self):
        """Step 2: Open a settings popup with live preview & adjustment controls."""
        self.popup = ctk.CTkToplevel()
        self.popup.title("Adjust Profile Picture")
        self.popup.geometry("250x250")
        self.popup.resizable(False, False)
        
        # **Force focus and keep on top**
        self.popup.transient(self.profile_frame.winfo_toplevel())  # Link to main window
        self.popup.grab_set()  # Prevent interactions with the main app until closed
        self.popup.focus_force()  # Immediately focus the popup window
        
        # Load icons
        zoom_in_icon = ctk.CTkImage(Image.open("icons/zoom_in.png"), size=(24, 24))
        zoom_out_icon = ctk.CTkImage(Image.open("icons/zoom_out.png"), size=(24, 24))
        arrow_up_icon = ctk.CTkImage(Image.open("icons/arrow_up.png"), size=(24, 24))
        arrow_down_icon = ctk.CTkImage(Image.open("icons/arrow_down.png"), size=(24, 24))

        # **Live Preview of Circular Image**
        self.preview_label = ctk.CTkLabel(self.popup, text="")  # Placeholder label for preview
        self.preview_label.pack(pady=5)
        self.update_preview()  # Load initial preview

        # Zoom controls
        zoom_frame = ctk.CTkFrame(self.popup)
        zoom_frame.pack(pady=5)
        ctk.CTkButton(zoom_frame, text="", width=40, image=zoom_out_icon, command=self.zoom_in).pack(side="left", padx=5)
        ctk.CTkButton(zoom_frame, text="", width=40, image=zoom_in_icon, command=self.zoom_out).pack(side="left", padx=5)

        # Shift controls
        shift_frame = ctk.CTkFrame(self.popup)
        shift_frame.pack(pady=5)
        ctk.CTkButton(shift_frame, text="", width=40, image=arrow_down_icon, command=self.shift_up).pack(side="left", padx=5)
        ctk.CTkButton(shift_frame, text="", width=40, image=arrow_up_icon, command=self.shift_down).pack(side="left", padx=5)

        # Save button
        ctk.CTkButton(self.popup, text="Save Changes", command=self.apply_changes).pack(pady=10)

    def update_preview(self):
        """Update the circular image preview inside the popup window."""
        preview_image = self.load_circular_image(self.profile_path)
        self.preview_label.configure(image=preview_image)
        self.preview_label.image = preview_image  # Prevent garbage collection

    def zoom_in(self):
        """Increase zoom and update preview."""
        self.zoom += 100
        self.update_preview()

    def zoom_out(self):
        """Decrease zoom and update preview."""
        self.zoom -= 100
        self.update_preview()

    def shift_up(self):
        """Move the image up slightly and update preview."""
        self.shift += 100
        self.update_preview()

    def shift_down(self):
        """Move the image down slightly and update preview."""
        self.shift -= 100
        self.update_preview()

    def apply_changes(self):
        """Apply the adjusted profile picture and update the main profile card."""
        print("✅ Applying picture changes and updating main UI...")  # Debugging log

        # **Step 1: Save the processed image**
        self.profile_image = self.load_circular_image(self.profile_path)  # Load edited image

        # **Step 2: Update the main profile button's image**
        self.profile_button.configure(image=self.profile_image)

        # **Step 3: If client ID exists, update the database**
        if self.client_id:
            cursor = self.conn.cursor()
            cursor.execute("UPDATE clients SET profile_picture = ? WHERE id = ?", (self.profile_path, self.client_id))
            self.conn.commit()
            print(f"📁 Saved image path to DB for Client ID: {self.client_id}")

        # **Step 4: Close the popup window**
        self.popup.destroy()

    def load_circular_image(self, image_path):
        """Load and convert an image to a circular format."""
        image = Image.open(image_path)
        circular_image = self.create_circular_image(image)
        return ctk.CTkImage(circular_image, size=(w, h))  # Convert to Tkinter-compatible format

    def create_circular_image(self, image):
        """Convert an image into a circular format while ensuring proper cropping."""
        width, height = image.size

        # **Apply Zoom & Shift**
        if width == height:
            cropped_image = image
        else:
            crop_size = width // 1 + self.zoom
            crop_x = (width - crop_size) // 2
            crop_y = (height - crop_size) // 2 + self.shift

            # Crop picture (left, top, right, bottom)
            cropped_image = image.crop((crop_x, crop_y, crop_x + crop_size, crop_y + crop_size))

        # **🔹 Step 1: Use a High-Resolution Mask**
        upscale_factor = 4  # Increase resolution for smooth edges
        mask_size = (w * upscale_factor, h * upscale_factor)  
        mask = Image.new("L", mask_size, 0)  
        draw = ImageDraw.Draw(mask)

        # Draw an anti-aliased circle on a larger mask
        draw.ellipse((0, 0, mask_size[0], mask_size[1]), fill=255)  

        # **🔹 Step 2: Resize Mask Down to Prevent Blocky Edges**
        mask = mask.resize((w, h), Image.LANCZOS)  

        # **🔹 Step 3: Resize and apply circular mask**
        circular_image = ImageOps.fit(cropped_image, (w, h), centering=(0.5, 0.5))
        circular_image.putalpha(mask) 

        return circular_image
    
    def load_client(self, client_id):
        """Load client details and update the profile card."""
        self.client_id = client_id
        cursor = self.conn.cursor()
        cursor.execute("SELECT full_name, profile_picture FROM clients WHERE id = ?", (client_id,))
        client_data = cursor.fetchone()

        if client_data:
            full_name, profile_picture = client_data
            self.name_label.configure(text=full_name)  # Update name label

            # Load profile picture or use default
            self.profile_path = profile_picture if profile_picture else "icons/add_photo.png"

            # ✅ Corrected: Remove extra CTkImage wrapping
            self.profile_image = ctk.CTkImage(Image.open(self.profile_path), size=(w, h))

            # Update UI
            self.profile_button.configure(image=self.profile_image)
