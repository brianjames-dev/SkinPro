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

        # Hide main window initially
        self.withdraw()

        self.title("SkinPro")
        self.geometry("936x702")
        ctk.set_appearance_mode("Dark")  # Options: "Light", "Dark", or "System"
        ctk.set_default_color_theme("blue")  # Options: "blue", "green", "dark-blue"

        self.conn = conn  # Save the database connection
        self.cursor = self.conn.cursor()
        self.image_cache = image_cache  # Store image cache reference
        self.selected_client_id = None  # Store selected client ID

        # Show splash screen while loading
        self.splash = SplashScreen(self)

        # Preload images & thumbnails in SplashScreen
        self.after(100, self.preload_assets)  # Delay slightly to ensure UI is drawn


    def preload_assets(self):
        """Load full images & thumbnails while updating splash screen progress."""
        full_images = list(self.image_cache.image_cache.keys())
        thumbnails = list(self.image_cache.thumbnail_cache.keys())
        total_items = len(full_images) + len(thumbnails)
        step = 1 / total_items if total_items > 0 else 1

        # Preload full-size images
        for i, file_path in enumerate(full_images):
            self.image_cache.get_image(file_path)
            self.splash.progress_label.configure(text=f"Loading images... ({i+1}/{total_items})")
            self.splash.progress_bar.set((i + 1) * step)
            self.splash.update_idletasks()

        # Preload thumbnails
        for i, file_path in enumerate(thumbnails):
            self.image_cache.get_thumbnail(file_path)
            self.splash.progress_label.configure(text=f"Loading thumbnails... ({len(full_images) + i+1}/{total_items})")
            self.splash.progress_bar.set((len(full_images) + i + 1) * step)
            self.splash.update_idletasks()

        # Close splash and show main window after loading
        self.after(500, self.finish_loading)


    def finish_loading(self):
        """Finalize UI setup and close the splash screen."""
        if self.splash and self.splash.winfo_exists():
            self.splash.close_splash()

        self.deiconify()  # Show the main UI properly
        self.init_ui()  # Initialize the UI components


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

