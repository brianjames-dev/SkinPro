import json
import os
from collections import OrderedDict
from PIL import Image, ImageTk
from customtkinter import CTkImage
from tkinter import PhotoImage
import threading

CACHE_FILE = "image_cache.json"

class ImageCache:
    def __init__(self, cache_size=500, thumbnail_cache_size=500, cache_file="image_cache.json"):
        self.cache_size = cache_size
        self.thumbnail_cache_size = thumbnail_cache_size
        self.cache_file = cache_file
        self.image_cache = OrderedDict()  # LRU Cache for full-size images
        self.thumbnail_cache = OrderedDict()  # LRU Cache for thumbnails

        print(f"✅ ImageCache initialized.")  # Debugging print


    #######################################
    ### --- Full-Size Image Caching --- ###
    #######################################
    def get_image(self, file_path):
        """Retrieve the cached image or process it if not cached."""
        if file_path in self.image_cache:
            # print(f"⚡ Instant Load: Using cached image for {file_path}")
            return self.image_cache[file_path]
        else:
            print(f"🛠️ Processing and caching new image → {file_path}")
            image = self.preload_image(file_path)
            self.add_image_to_cache(file_path, image)
            return image
        

    def add_image_to_cache(self, file_path, img):
        """Add an image to the cache, ensuring it doesn't exceed max size."""
        if not img:
            return  # Don't cache None values
        
        if file_path in self.image_cache:
            self.image_cache.move_to_end(file_path)  # Move to end (LRU priority)
        else:
            if len(self.image_cache) >= self.cache_size:
                self.image_cache.popitem(last=False)  # Remove least recently used item
            self.image_cache[file_path] = img  # Add new image properly


    #################################
    ### --- Thumbnail Caching --- ###
    #################################
    def get_thumbnail(self, file_path):
        """Retrieve the cached thumbnail as a Tkinter-compatible PhotoImage (non-blocking)."""
        if file_path in self.thumbnail_cache:
            thumbnail = self.thumbnail_cache[file_path]
            if isinstance(thumbnail, ImageTk.PhotoImage):  # Must be PhotoImage for ttk.Treeview
                print(f"⚡ Instant Load: Using cached thumbnail for {file_path}")
                return thumbnail
        
        # DO NOT generate the thumbnail here! Let the worker thread handle it!
        return None  # If it's not in the cache, return None and let the worker generate it


    def add_thumbnail_to_cache(self, file_path, thumbnail):
        """Add a thumbnail to the cache with LRU handling."""
        if not thumbnail or not isinstance(thumbnail, ImageTk.PhotoImage):  # ✅ Extra safeguard
            print(f"⚠ Warning: Not caching invalid thumbnail for {file_path}")
            return  

        if file_path in self.thumbnail_cache:
            self.thumbnail_cache.move_to_end(file_path)
        else:
            if len(self.thumbnail_cache) >= self.thumbnail_cache_size:
                removed = self.thumbnail_cache.popitem(last=False)
                print(f"🔄 LRU Removed Oldest Thumbnail: {removed[0]}")

            self.thumbnail_cache[file_path] = thumbnail
            print(f"✅ Cached Thumbnail: {file_path}")


    ########################################    
    ### --- Cache Saving and Loading --- ###
    ########################################
    def load_image_cache(self, splash_screen=None):
        """Load full-size image cache from disk and update splash screen dynamically."""
        print("🔍 Entering load_cache_from_disk()...")  # ✅ Debug: Confirm function entry

        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r") as f:
                    data = json.load(f)

                cached_paths = data.get("cached_paths", [])  # Get all cached paths
                total_images = len(cached_paths)
                print(f"📂 Loading {total_images} startup images...")  

                if splash_screen:
                    step = 0.5 / total_images if total_images > 0 else 1

                for i, file_path in enumerate(cached_paths):
                    print(f"🔄 Checking file {i+1}/{total_images}: {file_path}")  # ✅ Debug: Show progress

                    if os.path.exists(file_path):
                        # print(f"🟢 Preloading full-size image: {file_path}")  # ✅ Debug: Processing image
                        img = self.preload_image(file_path)  # Load image
                        self.image_cache[file_path] = img  # Store image in cache

                        if splash_screen:
                            progress = (i + 1) * step
                            splash_screen.update_progress(progress, f"Loading images... ({i+1}/{total_images})")
                            splash_screen.update_idletasks()  # 🔹 Force UI update
                            splash_screen.after(10)  # 🔹 Allow Tkinter to refresh
                    else:
                        print(f"❌ Warning: Image file does NOT exist - {file_path}")  # ✅ Debug: Missing file

                print("✅ Loaded all 25 startup images.")

            except Exception as e:
                print(f"⚠ Error loading full-size image cache: {e}")
        
        print("🔍 Exiting load_cache_from_disk()...")  # ✅ Debug: Ensure function fully executed


    def save_cache_to_disk(self):
        """Save only the most recent 25 images to disk on exit."""
        try:
            cache_data = list(self.image_cache.keys())[-25:]
            with open(self.cache_file, "w") as f:
                json.dump({"cached_paths": cache_data}, f, indent=4)
            print(f"💾 Saved {len(cache_data)} cached full-size images to disk.")
        except Exception as e:
            print(f"⚠ Error saving cache: {e}")


    def load_thumbnail_cache(self):
        """Load up to 25 thumbnails from disk, but allow cache to hold up to 500 thumbnails during runtime."""
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r") as f:
                    data = json.load(f)

                cached_paths = data.get("cached_paths", [])
                print(f"📂 Found {len(cached_paths)} cached thumbnails from disk.")  

                self.thumbnail_cache = OrderedDict((path, None) for path in cached_paths)

            except Exception as e:
                print(f"⚠ Error loading thumbnail cache: {e}")


    def save_thumbnail_cache(self):
        """Save up to 100 thumbnails to disk."""
        try:
            cache_data = list(self.thumbnail_cache.keys())[-25:]
            with open(CACHE_FILE, "w") as f:
                json.dump({"cached_paths": cache_data}, f, indent=4)
            print(f"💾 Saved {len(cache_data)} cached thumbnails to disk.")
        except Exception as e:
            print(f"⚠ Error saving thumbnail cache: {e}")


    ########################################    
    ### --- Cache Loading on Startup --- ###
    ########################################
    def preload_image(self, file_paths):
        """Preload multiple images into cache, handling both single and multiple file paths."""
        if isinstance(file_paths, str):
            file_paths = [file_paths]  # Convert single string to list
        
        if not isinstance(file_paths, list):
            print(f"⚠ Unexpected input type: {type(file_paths)}. Expected a list or a string.")
            return

        for file_path in file_paths:
            if not isinstance(file_path, str):
                print(f"⚠ Skipping invalid file path: {file_path}")
                continue

            if file_path in self.image_cache:
                print(f"⚡ Skipping {file_path}, already cached.")
                continue

            if os.path.exists(file_path):
                print(f"🟢 Preloading {file_path} into cache...")
                self.image_cache[file_path] = self.crop_image(file_path)
            else:
                print(f"❌ Skipping {file_path}, file does not exist.")


    def crop_image(self, file_path):
        """Load and resize a single image for caching."""
        try:
            img = Image.open(file_path)
            img = img.convert("RGB")  # Ensure consistent color mode

            # Resize for display
            fixed_width, fixed_height = 279, 372
            img_ratio = img.width / img.height
            target_ratio = fixed_width / fixed_height

            if img_ratio > target_ratio:
                new_width = fixed_width
                new_height = int(fixed_width / img_ratio)
            else:
                new_height = fixed_height
                new_width = int(fixed_height * img_ratio)

            img = img.resize((new_width, new_height), Image.LANCZOS)

            return CTkImage(img, size=(fixed_width, fixed_height))

        except Exception as e:
            print(f"⚠ Error preloading image {file_path}: {e}")
            return None
