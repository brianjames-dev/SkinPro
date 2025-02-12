import customtkinter as ctk
from tkinter import filedialog
from PIL import Image, ImageTk

class PhotosPage:
    def __init__(self, parent, conn):
        self.conn = conn
        self.cursor = conn.cursor()

        header = ctk.CTkLabel(parent, text="Photos", font=("Arial", 20))
        header.pack(pady=10)

        upload_button = ctk.CTkButton(parent, text="Upload Photo", command=self.upload_photo)
        upload_button.pack(pady=10)

        self.photo_label = ctk.CTkLabel(parent, text="No photo uploaded yet.")
        self.photo_label.pack(pady=10)

    def upload_photo(self):
        file_path = filedialog.askopenfilename(filetypes=[("Image Files", "*.png;*.jpg;*.jpeg")])
        if file_path:
            image = Image.open(file_path)
            image = image.resize((300, 300))  # Resize for display
            photo = ImageTk.PhotoImage(image)
            self.photo_label.configure(image=photo, text="")
            self.photo_label.image = photo
