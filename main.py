from client_app import ClientApp
from database import init_database
from image_cache import ImageCache
from loading_screen import LoadingScreen
import customtkinter as ctk

if __name__ == "__main__":
    # Initialize database
    conn = init_database()

    # Initialize image cache
    image_cache = ImageCache()  # Loads cache from disk (if exists)

    # Now start the main app
    app = ClientApp(conn, image_cache)
    app.mainloop()

    # Save cache before exiting
    image_cache.save_cache_to_disk()
    image_cache.save_thumbnail_cache()
