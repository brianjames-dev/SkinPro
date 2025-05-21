import threading
import queue
import time
from PIL import Image, ImageTk
import os

class ImageLoaderThread(threading.Thread):
    def __init__(self, image_cache, update_ui_callback):
        super().__init__(daemon=True)  # Daemon thread stops when the app closes
        self.image_cache = image_cache  # Reference to shared image cache
        self.update_ui_callback = update_ui_callback  # Function to update UI from the main thread
        self.task_queue = queue.Queue()  # Queue to hold image loading tasks
        self.running = True  # Control flag for stopping the thread


    def run(self):
        print("Image Loader Thread Started...")
        while self.running:
            try:
                # Get an image task from the queue (waits up to 1 second if empty)
                task = self.task_queue.get(timeout=1)
                file_path, photo_id = task
                print(f"Processing thumbnail for: {file_path}")

                if not self.running:  # Exit check
                    break

                # Load and process the image
                thumbnail = self.generate_thumbnail(file_path)

                # Send the processed thumbnail back to the UI thread
                if thumbnail:
                    self.update_ui_callback(photo_id, thumbnail)

            except queue.Empty:
                continue  # No tasks, loop again


    def generate_thumbnail(self, file_path, size=(100, 100)):
        """Generate and return a Tkinter-compatible PhotoImage thumbnail."""
        try:
            if not os.path.exists(file_path):
                print(f"File does not exist: {file_path}")
                return None

            img = Image.open(file_path)
            img = img.convert("RGB")

            # Crop to square center
            width, height = img.size
            min_side = min(width, height)
            left = (width - min_side) / 2
            top = (height - min_side) / 2
            right = (width + min_side) / 2
            bottom = (height + min_side) / 2
            img = img.crop((left, top, right, bottom))

            img = img.resize(size, Image.LANCZOS)

            # Convert to Tkinter-compatible PhotoImage for Treeview
            thumbnail = ImageTk.PhotoImage(img)  # Use PhotoImage instead of CTkImage

            if not isinstance(thumbnail, ImageTk.PhotoImage):
                print(f"Error: Thumbnail generation failed for {file_path}")
                return None

            # Store in the cache (image_cache.py)
            self.image_cache.add_thumbnail_to_cache(file_path, thumbnail)

            return thumbnail  # Now works correctly in ttk.Treeview

        except Exception as e:
            print(f"Error generating thumbnail for {file_path}: {e}")
            return None


    def add_task(self, file_path, photo_id):
        """Add an image processing task to the queue."""
        print(f"Queuing thumbnail generation for: {file_path}")
        self.task_queue.put((file_path, photo_id))


    def stop(self):
        """Stop the worker thread safely."""
        self.running = False
