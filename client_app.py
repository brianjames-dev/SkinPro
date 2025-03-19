import customtkinter as ctk
from tabs._1_clients_page import ClientsPage
from tabs._2_info_page import InfoPage
from tabs._3_appointments_page import AppointmentsPage
from tabs._4_photos_page import PhotosPage
from class_elements.profile_card import ProfileCard
from splash_screen import SplashScreen

class ClientApp(ctk.CTk):
    def __init__(self, conn, image_cache):
        super().__init__()

        self.title("SkinPro")
        self.geometry("936x702")

        self.conn = conn  # Save the database connection
        self.cursor = self.conn.cursor()
        self.image_cache = image_cache  # Store image cache reference
        self.selected_client_id = None  # Store selected client ID

        # Hide the UI until everything is preloaded
        self.withdraw()


    def preload_assets(self, splash_screen):
        """Load full images & thumbnails while updating splash screen progress."""
        splash_screen.update_progress(0, "Initializing UI...")

        # 🔹 First, initialize the UI BEFORE loading images
        self.init_ui()

        # 🔹 Now that the UI is set up, start loading cached images
        splash_screen.update_progress(0.1, "Loading cached images...")

        self.image_cache.load_cache_from_disk(splash_screen)  # ✅ Loads full-size images
        self.image_cache.load_thumbnail_cache()  # ✅ Loads cached thumbnail file paths
        self.image_cache.preload_thumbnails(splash_screen, index=0)  # ✅ Convert paths into actual thumbnails

        full_images = list(self.image_cache.image_cache.keys())
        thumbnails = list(self.image_cache.thumbnail_cache.keys())  # ✅ Now should contain valid paths

        total_items = len(full_images) + len(thumbnails)
        step = 0.4 / total_items if total_items > 0 else 1  # Allocate 40% of progress to thumbnails

        # 🔹 Process full-size images one at a time asynchronously
        self.load_full_images(full_images, thumbnails, splash_screen, 0, step, total_items)


    def load_full_images(self, full_images, thumbnails, splash_screen, index, step, total_items):
        """Recursively load full-size images while updating the progress bar."""
        if index >= len(full_images):
            print("✅ Finished loading full-size images, moving to thumbnails...")
            return self.after(10, lambda: self.load_thumbnails(thumbnails, splash_screen, 0.55, step))

        file_path = full_images[index]
        print(f"🟢 Loading {index+1}/{len(full_images)}: {file_path}")

        self.image_cache.get_image(file_path)  # Load image

        splash_screen.update_progress(
            0.1 + (index + 1) * step, f"Loading images... ({index + 1}/{total_items})"
        )

        # ✅ Schedule the next image to load asynchronously
        self.after(10, lambda: self.load_full_images(full_images, thumbnails, splash_screen, index + 1, step, total_items))


    def load_thumbnails(self, thumbnails, splash_screen, start_progress, step):
        """Load thumbnails while updating splash screen progress."""
        total_thumbnails = len(thumbnails)

        if total_thumbnails == 0:
            print("⚠ Warning: No thumbnails found to load!")
            return self.finish_loading(splash_screen)  # ✅ Handle case where no thumbnails exist

        print(f"📂 Loading {total_thumbnails} thumbnails...")

        def process_thumbnail(i):
            if i >= total_thumbnails:
                return self.finish_loading(splash_screen)  # ✅ All thumbnails done → Finish loading

            file_path = thumbnails[i]
            print(f"🖼️ Loading thumbnail {i+1}/{total_thumbnails}: {file_path}")

            self.image_cache.get_thumbnail(file_path)  # Load thumbnail
            progress = start_progress + ((i + 1) * step)
            splash_screen.update_progress(progress, f"Loading thumbnails... ({i+1}/{total_thumbnails})")

            # ✅ Schedule the next thumbnail to load asynchronously
            self.after(10, lambda: process_thumbnail(i + 1))

        process_thumbnail(0)  # ✅ Start thumbnail loading asynchronously


    def finish_loading(self, splash_screen):
        """Finalize UI setup and close the splash screen."""
        print("✅ Finished preloading assets. Closing splash screen and starting app...")
        
        self.after(500, splash_screen.destroy)  # ✅ Destroy splash screen after a short delay
        self.deiconify()  # ✅ Show the main app


    def init_ui(self):
        """Initialize the UI components after Tkinter is ready."""
        # Now it's safe to create UI components
        self.profile_card = ProfileCard(self, self.conn, self.cursor)  

        # Main Tab View
        self.tab_view = ctk.CTkTabview(self, anchor="nw")
        self.tab_view.pack(fill="both", expand=True, padx=(10, 10), pady=(0, 10))

        # Add Tabs
        self.tab_view.add("Clients")
        self.tab_view.add("Info")
        self.tab_view.add("Appointments")
        self.tab_view.add("Photos")

        # Tabs dictionary to store references
        self.tabs = {}

        # Add Content to Each Tab
        self.init_clients_tab()
        self.init_info_tab()
        self.init_appointments_tab()
        self.init_photos_tab()


    def init_clients_tab(self):
        clients_tab = self.tab_view.tab("Clients")
        self.tabs["Clients"] = ClientsPage(clients_tab, self.conn, self)  

    def init_info_tab(self):
        info_tab = self.tab_view.tab("Info")
        self.tabs["Info"] = InfoPage(info_tab, self.conn, self)  

    def init_appointments_tab(self):
        appointments_tab = self.tab_view.tab("Appointments")
        self.tabs["Appointments"] = AppointmentsPage(appointments_tab, self.conn, self)  

    def init_photos_tab(self):
        photos_tab = self.tab_view.tab("Photos")
        self.tabs["Photos"] = PhotosPage(photos_tab, self.conn, self, self.image_cache)  


    def switch_to_tab(self, tab_name, data=None):
        """Switch to the specified tab by name."""
        try:
            self.tab_view.set(tab_name)  # Switch to the specified tab
            if data and tab_name == "Info":
                self.tabs["Info"].populate_full_name(data)  # Call method in Info tab to populate data
        except Exception as e:
            print(f"Error switching to tab '{tab_name}': {e}")
    

    def set_selected_client(self, client_id):
        """Set the currently selected client and update relevant tabs."""
        self.selected_client_id = client_id
        self.update_info_tab()
        self.update_appointments_tab()


    def update_info_tab(self):
        """Update the Info Tab with data for the selected client."""
        if self.selected_client_id:
            self.tabs["Info"].load_client_data(self.selected_client_id)


    def update_appointments_tab(self):
        """Update the Appointments Tab with data for the selected client."""
        if self.selected_client_id:
            self.tabs["Appointments"].load_client_appointments(self.selected_client_id)

