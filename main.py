from client_app import ClientApp
from database import init_database
from image_cache import ImageCache
import tkinter as tk

if __name__ == "__main__":
    # Initialize database
    conn = init_database()

    # Initialize image cache
    image_cache = ImageCache()  # Loads cache from disk (if exists)

    # Start app and pass in database connection
    app = ClientApp(conn, image_cache)

    # Start the main event loop
    app.mainloop()

    # Save cache before exiting
    image_cache.save_cache_to_disk()
    image_cache.save_thumbnail_cache()
