from client_app import ClientApp
from database import init_database
from image_cache import ImageCache
from loading_screen import LoadingScreen
import customtkinter as ctk

if __name__ == "__main__":
    ctk.set_appearance_mode("Dark")
    ctk.set_default_color_theme("blue")

    # Initialize database
    conn = init_database()

    # Initialize image cache
    image_cache = ImageCache()  # Loads cache from disk (if exists)

    # Create the splash screen
    splash_root = ctk.CTk()
    splash_screen = LoadingScreen(splash_root, image_cache)
    splash_root.update_idletasks()  # Force UI update before loading starts

    # Preload images *before* launching main app
    cached_files = list(image_cache.image_cache.keys()) + list(image_cache.thumbnail_cache.keys())

    for index, file_path in enumerate(cached_files):
        if file_path in image_cache.image_cache:
            image_cache.get_image(file_path)  # Load full-size image
        elif file_path in image_cache.thumbnail_cache:
            image_cache.get_thumbnail(file_path)  # Load thumbnail image

        splash_screen.update_progress(index + 1, len(cached_files))  # Update progress bar

    # Ensure Tkinter doesn't try to call `.after()` on a destroyed window
    splash_root.after(200, splash_root.destroy)  # Gracefully close splash screen

    # Wait for splash screen to close before launching the main UI
    splash_root.wait_window()

    # Now start the main app
    app = ClientApp(conn, image_cache)
    app.mainloop()

    # Save cache before exiting
    image_cache.save_cache_to_disk()
    image_cache.save_thumbnail_cache()
