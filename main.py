import customtkinter as ctk
from tabs.client_app import ClientApp
from class_elements.database import init_database
from class_elements.image_cache import ImageCache
from class_elements.splash_screen import SplashScreen
from class_elements.img_load_threading import ImageLoaderThread
from utils.data_manager import DataDirectoryManager
from utils.path_utils import resource_path
import sys
import threading
from upload_server import server
import os


# Store server thread globally for health checks or shutdown logic
flask_thread = None

def start_server_in_thread():
    global flask_thread
    if flask_thread is None or not flask_thread.is_alive():
        # Daemon thread so it won't block process exit when closing the app
        flask_thread = threading.Thread(
            target=server.start_flask_server,
            daemon=True,
            name="FlaskUploadServer",
        )
        flask_thread.start()
        sys._flask_server_started = True
        print("Flask server launched from main.py")

if __name__ == "__main__":
    ctk.set_appearance_mode("Light")
    ctk.set_default_color_theme(resource_path("class_elements/corium_theme.json"))

    # Initialize Data Folder Manager
    data_manager = DataDirectoryManager()
    start_server_in_thread()
    
    # Initialize database & image cache
    conn = init_database(data_manager.db_path, data_manager.backups_dir)
    image_cache = ImageCache(data_manager)

    # Define a temporary function that will be overridden
    def update_ui_stub(photo_id, thumbnail):
        print(f"⚠ Warning: `update_ui_with_thumbnail` called before UI initialized. Skipping update.")

    # Start Image Loader Thread once at startup
    image_loader = ImageLoaderThread(image_cache, update_ui_stub)
    image_loader.start()

    # Create the main application but keep it hidden
    app = ClientApp(image_cache, image_loader, data_manager)
    app.update_idletasks()
    app.withdraw()  # Hide main UI until everything is loaded

    # Show splash screen FIRST before loading anything
    splash_screen = SplashScreen(app)  # Attach to main UI
    splash_screen.update_idletasks()

    # 🔹 Start loading assets **after** splash screen is drawn
    splash_screen.after(2000, lambda: app.preload_assets(splash_screen))

    def on_close():
        print("🔻 App is closing — attempting to clean up...")
        try:
            app.quit()
        except:
            pass
        sys.exit(0)  # Clean exit
    app.protocol("WM_DELETE_WINDOW", on_close)

    # 🔹 Start Tkinter main loop for splash screen (ensures it's visible)
    splash_screen.mainloop()

    # 🔹 Save caches before exit
    image_cache.save_cache_to_disk()
    image_cache.save_thumbnail_cache()
