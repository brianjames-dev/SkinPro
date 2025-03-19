import json
import os
from collections import OrderedDict
from PIL import Image, ImageTk
from customtkinter import CTkImage
from tkinter import PhotoImage


CACHE_FILE = "image_cache.json"

class ImageCache:
    def __init__(self, cache_size=3000, cache_file="image_cache.json"):
        self.cache_size = cache_size
        self.cache_file = cache_file
        self.image_cache = OrderedDict()  # LRU Cache for full-size images
        self.thumbnail_cache = OrderedDict()  # LRU Cache for thumbnails

        # Load cache immediately at startup
        self.load_cache_from_disk()
        self.load_thumbnail_cache()


    #######################################
    ### --- Full-Size Image Caching --- ###
    #######################################
    def get_image(self, file_path):
        """Retrieve the cached image or process it if not cached."""
        if file_path in self.image_cache:
            print(f"⚡ Instant Load: Using cached image for {file_path}")
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
        """Retrieve the cached thumbnail as a Tkinter-compatible PhotoImage."""
        if file_path in self.thumbnail_cache:
            thumbnail = self.thumbnail_cache[file_path]
            if isinstance(thumbnail, ImageTk.PhotoImage):  # Must be PhotoImage for ttk.Treeview
                print(f"⚡ Instant Load: Using cached thumbnail for {file_path}")
                return thumbnail
            else:
                print(f"Regenerating cached thumbnail for {file_path} on startup.")

        # Generate and cache if missing
        print(f"🖼️ Generating new thumbnail → {file_path}")
        thumbnail = self.generate_thumbnail(file_path)
        self.thumbnail_cache[file_path] = thumbnail  # Cache properly
        return thumbnail


    def add_thumbnail_to_cache(self, file_path, thumbnail):
        """Add a thumbnail to the cache with LRU handling."""
        if not thumbnail:
            return  
        if file_path in self.thumbnail_cache:
            self.thumbnail_cache.move_to_end(file_path)
        else:
            if len(self.thumbnail_cache) >= self.cache_size:
                self.thumbnail_cache.popitem(last=False)
            self.thumbnail_cache[file_path] = thumbnail


    def generate_thumbnail(self, file_path, size=(50, 50)):
        """Generate and return a Tkinter-compatible PhotoImage thumbnail."""
        try:
            if not os.path.exists(file_path):
                print(f"❌ File does not exist: {file_path}")
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
                print(f"⚠ Error: Thumbnail generation failed for {file_path}")
                return None

            return thumbnail  # Now works correctly in ttk.Treeview

        except Exception as e:
            print(f"⚠ Error generating thumbnail for {file_path}: {e}")
            return None


    ########################################    
    ### --- Cache Saving and Loading --- ###
    ########################################
    def load_cache_from_disk(self):
        """Load full-size image cache from disk and convert to Tkinter images."""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r") as f:
                    data = json.load(f)

                cached_paths = data.get("cached_paths", [])
                print(f"📂 Loading {len(cached_paths)} cached full-size images from disk...")

                for file_path in cached_paths:
                    if os.path.exists(file_path):
                        print(f"🟢 Preloading full-size image: {file_path}")
                        self.image_cache[file_path] = self.preload_image(file_path)  # Now loads full image immediately

                print(f"✅ Preloaded {len(self.image_cache)} full-size images into memory.")

            except Exception as e:
                print(f"⚠ Error loading full-size image cache: {e}")


    def save_cache_to_disk(self):
        """Save only file paths of full-size images to disk."""
        try:
            with open(self.cache_file, "w") as f:
                json.dump({"cached_paths": list(self.image_cache.keys())}, f, indent=4)
            print(f"💾 Saved {len(self.image_cache)} cached full-size images to disk.")
        except Exception as e:
            print(f"⚠ Error saving cache: {e}")


    def load_thumbnail_cache(self):
        """Load thumbnail cache from disk but defer creating Tkinter images until the UI is ready."""
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r") as f:
                    data = json.load(f)

                cached_paths = data.get("cached_paths", [])
                print(f"📂 Loading {len(cached_paths)} cached thumbnails from disk...")

                # Store file paths only (not Tkinter objects)
                self.thumbnail_cache = {path: None for path in cached_paths}

            except Exception as e:
                print(f"⚠ Error loading thumbnail cache: {e}")


    def save_thumbnail_cache(self):
        """Save only file paths of thumbnails to disk."""
        try:
            with open(CACHE_FILE, "w") as f:
                json.dump({"cached_paths": list(self.thumbnail_cache.keys())}, f, indent=4)
            print(f"💾 Saved {len(self.thumbnail_cache)} cached thumbnails to disk.")
        except Exception as e:
            print(f"⚠ Error saving thumbnail cache: {e}")


    def preload_image(self, file_path):
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


    def preload_images(self, file_paths):
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
                self.image_cache[file_path] = self.preload_image(file_path)
            else:
                print(f"❌ Skipping {file_path}, file does not exist.")


    def preload_thumbnails(self):
        """Create Tkinter-compatible thumbnails only after Tkinter is fully initialized."""
        print("🟢 Creating Tkinter-compatible thumbnails...")

        for file_path in self.thumbnail_cache.keys():
            if self.thumbnail_cache[file_path] is None:  # Only process uncached ones
                print(f"🖼️ Processing thumbnail: {file_path}")
                self.thumbnail_cache[file_path] = self.generate_thumbnail(file_path)

        print(f"✅ Loaded {len(self.thumbnail_cache)} thumbnails into memory.")
