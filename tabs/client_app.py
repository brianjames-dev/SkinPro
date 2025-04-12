import customtkinter as ctk
from tabs._1_clients_page import ClientsPage
from tabs._2_info_page import InfoPage
from tabs._3_appointments_page import AppointmentsPage
from tabs._4_photos_page import PhotosPage
from tabs._5_prescriptions_page import PrescriptionsPage
from tabs._6_alerts_page import AlertsPage
from class_elements.profile_card import ProfileCard
from class_elements.splash_screen import SplashScreen
from class_elements.img_load_threading import ImageLoaderThread

class ClientApp(ctk.CTk):
    def __init__(self, conn, image_cache, image_loader):
        super().__init__()

        self.title("SkinPro")
        self.geometry("936x702")

        self.conn = conn  # Save the database connection
        self.cursor = self.conn.cursor()
        self.image_cache = image_cache  # Store image cache reference
        self.image_loader = image_loader  # Now `self.image_loader` exists in ClientApp
        self.selected_client_id = None  # Store selected client ID

        # Hide the UI until everything is preloaded
        self.withdraw()


    def preload_assets(self, splash_screen):
        """Load full images & thumbnails while updating splash screen progress."""
        splash_screen.update_progress(0, "Initializing UI...")

        # First, initialize the UI BEFORE loading images
        self.init_ui()

        # Now that the UI is set up, start loading cached images
        splash_screen.update_progress(0.00, "Loading cached images...")

        # Load image caches
        self.image_cache.load_image_cache(splash_screen)  # Load full-size images
        self.image_cache.load_thumbnail_cache()  # Load cached thumbnail paths

        # Prepare lists
        full_images = list(self.image_cache.image_cache.keys())
        thumbnails = list(self.image_cache.thumbnail_cache.keys())

        total_full_images = len(full_images)
        total_thumbnails = len(thumbnails)
        total_items = total_full_images + total_thumbnails

        if total_items == 0:
            print("⚠ Warning: No cached images or thumbnails found!")
            return self.finish_loading(splash_screen)

        # Allocate exact progress range:
        full_start = 0.05  # Start at 5%
        full_end = 0.50    # Full images end at 50%
        thumb_start = 0.50   # Thumbnails start at 50%
        thumb_end = 1.00     # End at 100%

        # Calculate step sizes based on counts
        step_full_images = (full_end - full_start) / total_full_images if total_full_images > 0 else 0
        step_thumbnails = (thumb_end - thumb_start) / total_thumbnails if total_thumbnails > 0 else 0

        # Process full-size images one by one asynchronously
        self.load_full_images(full_images, thumbnails, splash_screen, 0, step_full_images, step_thumbnails)


    def load_full_images(self, full_images, thumbnails, splash_screen, index, step_full, step_thumb):
        """Recursively load full-size images while updating the progress bar."""
        if index >= len(full_images):
            print("Finished loading full-size images, moving to thumbnails...")
            return self.after(10, lambda: self.load_thumbnails(thumbnails, splash_screen, 0.50, step_thumb))

        file_path = full_images[index]

        self.image_cache.get_image(file_path)  # Load image

        progress = 0.05 + (index + 1) * step_full  # Smoothly increments between 5% and 50%
        splash_screen.update_progress(progress, f"Loading images... ({index + 1}/{len(full_images)})")

        # Schedule the next image load asynchronously
        self.after(10, lambda: self.load_full_images(full_images, thumbnails, splash_screen, index + 1, step_full, step_thumb))


    def load_thumbnails(self, thumbnails, splash_screen, start_progress, step_thumb):
        """Load thumbnails while updating splash screen progress."""
        total_thumbnails = len(thumbnails)
        # print(f"⚠️ Skipping thumbnail generation during splash screen. Total: {len(thumbnails)}")
        # return self.finish_loading(splash_screen)

        if total_thumbnails == 0:
            print("⚠ Warning: No thumbnails found to load!")
            return self.finish_loading(splash_screen)  # Handle case where no thumbnails exist

        print(f"📂 Loading {total_thumbnails} thumbnails...")

        def process_thumbnail(i):
            if i >= total_thumbnails:
                return self.finish_loading(splash_screen)  # All thumbnails done → Finish loading

            file_path = thumbnails[i]
            print(f"🖼️ Loading thumbnail {i+1}/{total_thumbnails}: {file_path}")

            thumbnail = self.image_cache.get_thumbnail(file_path)  # Load thumbnail

            if thumbnail is None:
                # Add task to worker thread to generate the thumbnail asynchronously
                self.image_loader.add_task(file_path, i)  # Use `i` as temporary ID
            else:
                # Use cached thumbnail immediately in UI
                self.main_app.after(0, lambda: self.update_ui_with_thumbnail(i, thumbnail))

            progress = start_progress + ((i + 1) * step_thumb)
            splash_screen.update_progress(progress, f"Loading thumbnails... ({i+1}/{total_thumbnails})")
            
            # Schedule the next thumbnail to load asynchronously
            self.after(10, lambda: process_thumbnail(i + 1))

        process_thumbnail(0)  # Start thumbnail loading asynchronously


    def finish_loading(self, splash_screen):
        """Finalize UI setup and close the splash screen."""
        splash_screen.stop_timer()  # Stop the timer before destroying the screen
        splash_screen.destroy()  # Now it's safe to destroy
        self.deiconify()  # Show main application


    def init_ui(self):
        """Initialize the UI components after Tkinter is ready."""
        # Now it's safe to create UI components
        self.profile_card = ProfileCard(self, self.conn, self.cursor)  

        # Main Tab View
        self.tab_view = ctk.CTkTabview(self, anchor="nw")
        self.tab_view.pack(fill="both", expand=True, padx=(10, 10), pady=(0, 10))

        # Add Tabs
        self.tab_view.add("Alerts")
        self.tab_view.add("Clients")
        self.tab_view.add("Info")
        self.tab_view.add("Appointments")
        self.tab_view.add("Photos")
        self.tab_view.add("Prescriptions")


        # Tabs dictionary to store references
        self.tabs = {}

        # Add Content to Each Tab
        self.init_alerts_tab()
        self.init_clients_tab()
        self.init_info_tab()
        self.init_appointments_tab()
        self.init_photos_tab()
        self.init_prescriptions_tab()


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
        photos_page = PhotosPage(photos_tab, self.conn, self, self.image_cache, self.image_loader)
        self.tabs["Photos"] = photos_page

        self.image_loader.update_ui_callback = photos_page.update_ui_with_thumbnail
    
    def init_prescriptions_tab(self):
        prescriptions_tab = self.tab_view.tab("Prescriptions")
        self.tabs["Prescriptions"] = PrescriptionsPage(prescriptions_tab, self.conn, self)

    def init_alerts_tab(self):
        alerts_tab = self.tab_view.tab("Alerts")
        self.tabs["Alerts"] = AlertsPage(alerts_tab, self.conn, self)

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
