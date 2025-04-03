import customtkinter as ctk
from client_app import ClientApp
from database import init_database
from image_cache import ImageCache
from splash_screen import SplashScreen
from img_load_threading import ImageLoaderThread

if __name__ == "__main__":
    # ctk.set_appearance_mode("dark")
    # ctk.set_default_color_theme("blue")
    ctk.set_appearance_mode("Light")
    ctk.set_default_color_theme("class_elements/corium_theme.json")


    # 🔹 Initialize database & image cache (NO IMAGE LOADING YET)
    conn = init_database()
    image_cache = ImageCache()

    # Define a temporary function that will be overridden
    def update_ui_stub(photo_id, thumbnail):
        print(f"⚠ Warning: `update_ui_with_thumbnail` called before UI initialized. Skipping update.")

    # Start Image Loader Thread once at startup
    image_loader = ImageLoaderThread(image_cache, update_ui_stub)
    image_loader.start()

    # 🔹 Create the main application but keep it hidden
    app = ClientApp(conn, image_cache, image_loader)
    app.update_idletasks()
    app.withdraw()  # Hide main UI until everything is loaded

    # 🔹 Show splash screen FIRST before loading anything
    splash_screen = SplashScreen(app)  # Attach to main UI
    splash_screen.update_idletasks()

    # 🔹 Start loading assets **after** splash screen is drawn
    splash_screen.after(2000, lambda: app.preload_assets(splash_screen))

    # 🔹 Start Tkinter main loop for splash screen (ensures it's visible)
    splash_screen.mainloop()

    # 🔹 Save caches before exit
    image_cache.save_cache_to_disk()
    image_cache.save_thumbnail_cache()
