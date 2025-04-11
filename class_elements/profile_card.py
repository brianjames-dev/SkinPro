import os
import customtkinter as ctk
from PIL import Image, ImageOps, ImageDraw
from tkinter import filedialog

# Image size
w, h = 58, 58

class ProfileCard:
    def __init__(self, parent, conn, cursor):
        self.conn = conn                            # Store database connection
        self.cursor = cursor
        self.client_id = None                       # Selected client ID
        self.profile_path = "icons/account_circle.png"   # Default placeholder

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
            width=w, height=h,
            border_width=0,
            command=self.change_profile_picture  # Upload & open settings
        )
        self.profile_button.grid(row=0, column=0, padx=(0, 10), ipadx=0, ipady=0, sticky="nsew")

        # Label for the client's name
        self.name_label = ctk.CTkLabel(self.profile_frame, text="No Client Selected", font=("Helvetica", 20), anchor="w", fg_color="transparent", text_color="#ebebeb")
        self.name_label.grid(row=0, column=1, sticky="w")

    def load_client(self, client_id):
        """Load client details and apply saved zoom/shift to profile picture."""
        self.client_id = client_id

        # If no client ID is given, reset to default state
        if client_id is None:
            print("🔄 Resetting Profile Card to default state...")
            self.client_id = None
            self.profile_path = "icons/account_circle.png"
            self.full_name = "No Client Selected"

            # Reset profile image
            self.profile_image = ctk.CTkImage(Image.open(self.profile_path), size=(w, h))
            self.profile_button.configure(image=self.profile_image)

            # Reset name label
            self.name_label.configure(text=self.full_name)
            return  # Exit early
    
        # Fetch profile_picture, full_name from `clients`, and zoom/shift from `client_images`
        self.cursor.execute("""
            SELECT c.full_name, c.profile_picture, COALESCE(ci.zoom, 100), COALESCE(ci.shift, 0)
            FROM clients c
            LEFT JOIN client_images ci ON c.id = ci.client_id
            WHERE c.id = ?
        """, (client_id,))
        
        client_data = self.cursor.fetchone()

        if not client_data:  # No data found
            print(f"⚠ No saved client found for ID: {client_id}. Using default.")
            self.full_name = "Unknown Client"  # Assign default name
            self.profile_path = "icons/account_circle.png"
            self.zoom = 100
            self.shift = 0
        else:
            self.full_name, self.profile_path, self.zoom, self.shift = client_data
            print(f"🟢 Loaded Client: {self.full_name} | Image: {self.profile_path} | Zoom: {self.zoom}, Shift: {self.shift}")

        # Update Name Label with Selected Client’s Name
        self.name_label.configure(text=self.full_name)  # Now self.full_name is always set

        # Ensure profile image exists, otherwise fallback to default
        if not self.profile_path or not os.path.exists(self.profile_path):
            print(f"⚠ Image path not found: {self.profile_path}. Using default profile picture.")
            self.profile_path = "icons/account_circle.png"

        # Load and apply circular transformation only for real images
        try:
            if self.profile_path == "icons/account_circle.png":
                self.profile_image = ctk.CTkImage(Image.open(self.profile_path), size=(w, h))
            else:
                processed_image = self.create_circular_image(Image.open(self.profile_path))
                self.profile_image = ctk.CTkImage(processed_image, size=(w, h))
        except Exception as e:
            print(f"❌ Error processing image: {e}")
            self.profile_image = ctk.CTkImage(Image.open("icons/account_circle.png"), size=(w, h))  # Ensure valid image object

        # Update UI
        self.profile_button.configure(image=self.profile_image)

    def apply_changes(self):
        """Apply the adjusted profile picture and update the database."""
        if self.client_id is None:
            print("⚠ No client selected. Cannot save profile picture.")
            return

        print("✅ Applying picture changes and updating database...")

        # **Step 1: Determine Save Path (Temp or Final)**
        if self.client_id == -1:  
            save_path = "images/profile_pics/temp_profile.png"  # Temporary location for new clients
        else:
            # Fetch Client's Full Name for File Naming
            self.cursor.execute("SELECT full_name FROM clients WHERE id = ?", (self.client_id,))
            result = self.cursor.fetchone()

            if result:
                full_name = result[0].replace(" ", "_")  # Replace spaces with underscores
                save_path = f"images/profile_pics/{full_name}_id_{self.client_id}.png"
            else:
                print(f"⚠ ERROR: No full_name found for client_id {self.client_id}. Using default name.")
                save_path = f"images/profile_pics/client_{self.client_id}.png"

        # **Step 2: Process and Save Image**
        edited_image = self.create_circular_image(Image.open(self.profile_path))
        os.makedirs(os.path.dirname(save_path), exist_ok=True)  # Ensure folder exists
        edited_image.save(save_path)  # Save processed image

        # **Step 3: Store Temporary Path if Not Saved Yet**
        if self.client_id == -1:
            print("⚠ Temporary client: Profile picture will be finalized upon save.")
            self.profile_path = save_path

            # Update ProfileCard UI Immediately
            self.profile_image = ctk.CTkImage(Image.open(save_path), size=(w, h))
            self.profile_button.configure(image=self.profile_image)  # Update UI

            self.popup.destroy()
            return  # Exit early, don't store in database yet
    
        # **Step 4: Update profile picture path in `clients` table**
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE clients 
            SET profile_picture = ? 
            WHERE id = ?""", 
            (save_path, self.client_id))

        # **Step 5: Update or Insert zoom/shift in `client_images` table**
        cursor.execute("SELECT id FROM client_images WHERE client_id = ?", (self.client_id,))
        existing_entry = cursor.fetchone()

        if existing_entry:
            # Update existing entry
            cursor.execute("""
                UPDATE client_images 
                SET zoom = ?, shift = ? 
                WHERE client_id = ?""", 
                (self.zoom, self.shift, self.client_id))
        else:
            # Insert new entry
            cursor.execute("""
                INSERT INTO client_images (client_id, zoom, shift) 
                VALUES (?, ?, ?)""", 
                (self.client_id, self.zoom, self.shift))

        # Commit changes to the database
        self.conn.commit()
        print(f"💾 Profile picture saved at {save_path} for Client ID {self.client_id}")

        # Refresh and close the popup window
        self.load_client(self.client_id)
        self.popup.destroy()

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

        # Main frame
        main_frame = ctk.CTkFrame(self.popup)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Live Preview of Circular Image
        self.preview_label = ctk.CTkLabel(main_frame, text="")  # Placeholder label for preview
        self.preview_label.pack(pady=5)
        self.update_preview()  # Load initial preview

        # Zoom controls
        zoom_frame = ctk.CTkFrame(main_frame)
        zoom_frame.pack(pady=5)
        ctk.CTkButton(zoom_frame, text="", width=40, image=zoom_out_icon, command=self.zoom_in).pack(side="left", padx=5)
        ctk.CTkButton(zoom_frame, text="", width=40, image=zoom_in_icon, command=self.zoom_out).pack(side="left", padx=5)

        # Shift controls
        shift_frame = ctk.CTkFrame(main_frame)
        shift_frame.pack(pady=5)
        ctk.CTkButton(shift_frame, text="", width=40, image=arrow_down_icon, command=self.shift_up).pack(side="left", padx=5)
        ctk.CTkButton(shift_frame, text="", width=40, image=arrow_up_icon, command=self.shift_down).pack(side="left", padx=5)

        # Save button
        ctk.CTkButton(main_frame, text="Save Changes", command=self.apply_changes).pack(pady=10)

    def update_preview(self):
        """Update the circular image preview inside the popup window."""
        preview_image = self.load_circular_image(self.profile_path)
        self.preview_label.configure(image=preview_image)
        self.preview_label.image = preview_image  # Prevent garbage collection

    def zoom_in(self):
        """Increase zoom and update preview."""
        self.zoom += 200
        self.update_preview()

    def zoom_out(self):
        """Decrease zoom and update preview."""
        self.zoom -= 200
        self.update_preview()

    def shift_up(self):
        """Move the image up slightly and update preview."""
        self.shift += 100
        self.update_preview()

    def shift_down(self):
        """Move the image down slightly and update preview."""
        self.shift -= 100
        self.update_preview()

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

        # **Step 1: Use a High-Resolution Mask**
        upscale_factor = 4  # Increase resolution for smooth edges
        mask_size = (w * upscale_factor, h * upscale_factor)  
        mask = Image.new("L", mask_size, 0)  
        draw = ImageDraw.Draw(mask)

        # Draw an anti-aliased circle on a larger mask
        draw.ellipse((0, 0, mask_size[0], mask_size[1]), fill=255)  

        # **Step 2: Resize Mask Down to Prevent Blocky Edges**
        mask = mask.resize((w, h), Image.LANCZOS)  

        # **Step 3: Resize and apply circular mask**
        circular_image = ImageOps.fit(cropped_image, (w, h), centering=(0.5, 0.5))
        circular_image.putalpha(mask) 

        return circular_image


    def set_default_profile_picture(self):
        """Reset to default profile picture."""
        self.profile_path = "icons/account_circle.png"
        self.profile_image = ctk.CTkImage(Image.open(self.profile_path), size=(w, h))
        self.profile_button.configure(image=self.profile_image)
