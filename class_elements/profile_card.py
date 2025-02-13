import customtkinter as ctk
from PIL import Image, ImageTk, ImageOps, ImageDraw

class ProfileCard:
    def __init__(self, parent):
        # Frame to hold the profile picture and name
        self.profile_frame = ctk.CTkFrame(parent, fg_color="transparent")
        self.profile_frame.pack(side="top", anchor="w", padx=15, pady=(10, 0))

        # Create a canvas for the circular profile picture
        self.canvas = ctk.CTkCanvas(self.profile_frame, width=50, height=50, highlightthickness=1)
        self.canvas.grid(row=0, column=0, padx=(0, 10))

        # Placeholder image for profile picture
        placeholder_image = Image.open("icons/add_photo.png").resize((50, 50))
        self.profile_picture = ImageTk.PhotoImage(self.create_circular_image(placeholder_image))
        self.canvas.create_image(25, 25, image=self.profile_picture)

        # Label for the client's name
        self.name_label = ctk.CTkLabel(self.profile_frame, text="No Client Selected", font=("Arial", 16), anchor="w")
        self.name_label.grid(row=0, column=1, sticky="w")

    def create_circular_image(self, image):
        """Convert an image to a circular format."""
        mask = Image.new("L", image.size, 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0) + image.size, fill=255)
        circular_image = ImageOps.fit(image, mask.size, centering=(0.5, 0.5))
        circular_image.putalpha(mask)
        return circular_image

    def update_profile(self, image_path, name):
        """Update the profile picture and name."""
        # Update profile picture
        new_image = Image.open(image_path).resize((24, 24))
        self.profile_picture = ImageTk.PhotoImage(self.create_circular_image(new_image))
        self.canvas.create_image(25, 25, image=self.profile_picture)

        # Update name label
        self.name_label.configure(text=name)
