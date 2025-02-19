import customtkinter as ctk
from PIL import Image, ImageTk, ImageOps, ImageDraw
from tkinter import filedialog

# Image ratio
w = 60
h = 60
class ProfileCard:
    def __init__(self, parent):
        # Frame to hold the profile picture and name
        self.profile_frame = ctk.CTkFrame(parent, fg_color="transparent")
        self.profile_frame.pack(side="top", anchor="w", padx=(10, 0), pady=(0, 6))

        # Placeholder image for profile picture
        self.profile_image = ctk.CTkImage(Image.open("icons/add_photo.png"), size=(w, h))

        # Create a button for the profile picture
        self.profile_button = ctk.CTkButton(
            self.profile_frame,
            image=self.profile_image,
            text="",
            fg_color="transparent",
            hover_color="#2b2b2b",
            width=w, height=h,
            border_width=0,
            command=self.change_profile_picture  # Function to change the image
        )
        self.profile_button.grid(row=0, column=0, padx=(0, 10), ipadx=0, ipady=0, sticky="nsew")

        # Label for the client's name
        self.name_label = ctk.CTkLabel(self.profile_frame, text="No Client Selected", font=("Arial", 16), anchor="w")
        self.name_label.grid(row=0, column=1, sticky="w")

    def load_circular_image(self, image_path):
        """Load and convert an image to a circular format."""
        image = Image.open(image_path)                                  # Loads image
        circular_image = self.create_circular_image(image)              # Convert image to circular format

        return ctk.CTkImage(circular_image, size=(w, h))                # Convert to Tkinter-compatible format

    def create_circular_image(self, image):
        """Convert an image into a circular format with transparency while ensuring proper cropping."""
        width, height = image.size      # Get image dimensions
        zoom = 1.8
        shift = 3

        # Disregard landscape photos
        if width > height:
            return
        
        # Only crop portrait photos (square photos are passed through)
        if width == height:
            cropped_image = image
        else:
            crop_size = width // zoom

            # Cropping logic
            crop_x = (width - crop_size) // 2  # Center horizontally
            crop_y = (height - crop_size) // shift # Shift vertically

            # Crop picture (left, top, right, bottom)
            cropped_image = image.crop((crop_x, crop_y, crop_x + crop_size, crop_y + crop_size))
            new_width, new_height = cropped_image.size

        # Create circular mask
        mask = Image.new("L", (new_width, new_height), 0)  # Create a black mask
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0) + (new_width, new_height), fill=255)  # Draw a white circle

        # Resize and crop the image to fit within the circular mask
        circular_image = ImageOps.fit(cropped_image, (new_width, new_height), centering=(0.5, 0.5))
        circular_image = circular_image.convert("RGBA")  # Ensure it supports transparency
        circular_image.putalpha(mask)  # Apply the mask for transparency

        return circular_image


    def change_profile_picture(self):
        """Open a file dialog to select and update the profile picture."""
        file_path = filedialog.askopenfilename(
            title="Select Profile Picture",
            filetypes=[("Image Files", "*.png;*.jpg;*.jpeg;*.bmp")]
        )
        if file_path:
            self.profile_image = self.load_circular_image(file_path)
            self.profile_button.configure(image=self.profile_image)  # Update the button with new image
