from tkinter import ttk
import customtkinter as ctk
from PIL import Image
from class_elements.profile_card import ProfileCard
from class_elements.treeview_styling_light import style_treeview_light
from class_elements.ctk_popup import ConfirmationPopup
import os
import shutil
from utils.path_utils import resource_path
import sqlite3


class ClientsPage:
    def __init__(self, parent, main_app, data_manager):
        self.parent = parent
        self.main_app = main_app
        self.client_id = None
        self.data_manager = data_manager

        # Frame for Search/Treeview
        main_frame = ctk.CTkFrame(parent)
        main_frame.pack(fill="both", expand=True, padx=10)

        # Frame for Search Bar
        search_frame = ctk.CTkFrame(main_frame, fg_color="#563A9C")
        search_frame.pack(fill="x", pady=(0, 10))

        # Search Label
        search_label = ctk.CTkLabel(search_frame, text="Search by Name:", font=("Helvetica", 14, "bold"), fg_color="transparent", text_color="#ebebeb")
        search_label.grid(row=0, column=0, sticky="w", padx=10)

        # Search Entry
        self.name_entry = ctk.CTkEntry(search_frame, width=300, placeholder_text="Enter client name")
        self.name_entry.grid(row=0, column=1, sticky="ew")

        # Add Client Button
        add_client_icon = ctk.CTkImage(light_image=Image.open(resource_path("icons/add_client.png")), size=(24, 24))
        add_client_button = ctk.CTkButton(
            search_frame,
            image=add_client_icon,
            text="Add Client",
            width=24,
            height=24,
            command=self.add_client_button
        )
        add_client_button.grid(row=0, column=2, padx=10)

        # Configure the columns in the search_frame
        search_frame.columnconfigure(1, weight=1)  # Make the entry box expand

        # Frame for Treeview
        table_frame = ctk.CTkFrame(main_frame)
        table_frame.pack(fill="both", expand=True, pady=(0, 10))

        # Apply Treeview Styling
        style_treeview_light("Clients.Treeview")

        # Treeview Widget
        columns = ("Name", "Gender", "Birthdate", "Primary #", "Email", "Address")
        self.client_list = ttk.Treeview(table_frame, selectmode="browse", columns=columns, show="headings", style="Clients.Treeview")
        self.client_list.tag_configure("odd", background="#b3b3b3")  # MID_GRAY
        self.client_list.tag_configure("even", background="#ebebeb")   # SOFT_WHITE

        # Define column headers
        self.client_list.heading("Name", text="Name")
        self.client_list.heading("Gender", text="Gender")
        self.client_list.heading("Birthdate", text="Birthdate")
        self.client_list.heading("Primary #", text="Primary #")
        self.client_list.heading("Email", text="Email")
        self.client_list.heading("Address", text="Address")

        # Bind all column headers to sorting function
        for col in columns:
            self.client_list.heading(col, text=col, command=lambda c=col: self.sort_treeview(c, False))

        # Set initial column widths
        self.set_column_widths()

        # Pack the Treeview
        self.client_list.pack(side="left", fill="both", expand=True)

        # Add vertical scrollbar
        scrollbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.client_list.yview, style="Vertical.TScrollbar")
        scrollbar.pack(side="right", fill="y")
        self.client_list.configure(yscrollcommand=scrollbar.set)

        # No Results label (initially hidden)
        self.no_results_label = ctk.CTkLabel(
            table_frame,
            text="",
            font=("Helvetica", 24),
            anchor="center",
            fg_color="#ebebeb"
        )
        self.no_results_label.place(relx=0.5, rely=0.5, anchor="center")
        self.no_results_label.lower()  # Hide the label by lowering it below the Treeview

        # Load data from the database
        self.load_clients()

        # Bind the Treeview's parent to a resize event
        self.client_list.bind("<Configure>", lambda event: self.set_column_widths())

        # Key "bind" configurations for quick functionality
        self.name_entry. bind("<KeyRelease>", lambda event: (self.search_client(), "break"))    # Prevent default behavior
        self.client_list.bind("<Return>", self.jump_to_appt_tab)                                # Pressing Enter in Treeview
        self.client_list.bind("<ButtonRelease-1>", self.on_client_select)                       # Update all client info w/ single click
        self.client_list.bind("<Double-1>", self.jump_to_appt_tab)                              # Double left-click
        self.client_list.bind_all("<Control-Return>", lambda event: self.add_client_button())   # Bind globally for Ctrl+Enter
        self.client_list.bind("<Delete>", self.confirm_delete_client)                           # Deletes client
        self.client_list.bind("<BackSpace>", self.confirm_delete_client)                        # Deletes client
            

    def set_column_widths(self):
        # Get the current width of the Treeview
        total_width = self.client_list.winfo_width()

        # Set column widths as percentages of the total width
        self.client_list.column("Name", width=int(total_width * 0.18), minwidth=120)
        self.client_list.column("Gender", width=int(total_width * 0.05), minwidth=120)
        self.client_list.column("Birthdate", width=int(total_width * 0.10), minwidth=60)
        self.client_list.column("Primary #", width=int(total_width * 0.13), minwidth=100)
        self.client_list.column("Email", width=int(total_width * 0.14), minwidth=350)
        self.client_list.column("Address", width=int(total_width * 0.40), minwidth=200)


    def update_alternating_colors(self):
        """Reassign even/odd row tags based on visual order."""
        for index, item in enumerate(self.client_list.get_children()):
            tag = "even" if index % 2 == 0 else "odd"
            self.client_list.item(item, tags=(tag,))


    def load_clients(self):
        """Load all clients from the database and insert them into the Treeview."""
        print("Reloading all clients...")  # Debugging

        self.client_list.delete(*self.client_list.get_children())  # Clear existing rows

        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, full_name, gender, birthdate, primary_phone, email, address1 || ' ' || address2 FROM clients
                """)
                results = cursor.fetchall()
        except Exception as e:
            print(f"Error loading clients: {e}")
            return

        if not results:
            print("⚠ No clients found in the database!")  # Debugging
            self.no_results_label.configure(text="No clients found in the database.")
            self.no_results_label.lift()  # Show the label if the DB is empty
            return
        
        for index, row in enumerate(results):
            client_id = row[0]
            client_values = row[1:]
            self.client_list.insert("", "end", iid=str(client_id), values=client_values)

        self.update_alternating_colors()

        print(f"Loaded {len(results)} clients.")  # Debugging
        self.no_results_label.lower()  # Hide "No Results" label


    def search_client(self):
        """Search for clients based on the name entered in the search box."""
        query = self.name_entry.get().strip()   # Get and trim the search query

        if query:
            self.client_list.delete(*self.client_list.get_children())  # Clear existing rows
            try:
                with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        SELECT id, full_name, gender, birthdate, primary_phone, email, address1 || ' ' || address2 
                        FROM clients 
                        WHERE full_name LIKE ?
                    """, (f"%{query}%",))
                    results = cursor.fetchall()
            except Exception as e:
                print(f"Error searching clients: {e}")
                return
            
            if results:
                for row in results:
                    client_id = row[0]  # Extract client_id
                    client_values = row[1:]  # Everything except client_id

                    # Insert using client_id as the TreeView iid
                    self.client_list.insert("", "end", iid=str(client_id), values=client_values)
                
                self.update_alternating_colors()
                self.no_results_label.lower()  # Hide the "No Results" label
            
            else:
                # Show "No Results" label
                self.no_results_label.configure(text=f"No results for '{query}'\n\nPress Ctrl + Enter to add.")
                self.no_results_label.lift()  # Bring the label to the front

        else:
            self.load_clients()  # Reload all clients if no search query is provided
            self.no_results_label.lower()  # Hide the "No Results" label


    def jump_to_appt_tab(self, event):
        """Switch to the Appointments tab when a client is selected."""
    
        # Check where the click happened
        region = self.client_list.identify_region(event.x, event.y)
        if region == "heading":  
            print("Double-clicked on a header. Ignoring.")
            return  # Do nothing if it's a column header

        # Ensure a valid row is selected
        selected_item = self.client_list.selection()
        if not selected_item:  
            print("No client selected. Ignoring.")
            return  # Ignore if no valid row is selected

        print(f"Switching to Info Tab for Client ID: {selected_item[0]}")
        self.main_app.switch_to_tab("Appointments")


    def on_client_select(self, event):
        selected = self.client_list.selection()
        if not selected:
            print("No item selected in the Treeview.")
            return
        
        client_id = int(selected[0])
        self.select_client_by_id(client_id)  # Reusable logic


    def select_client_by_id(self, client_id):
        """Update the profile card when a client is single-clicked in the treeview."""
        self.client_id = client_id       # Store the selected client ID
        self.client_list.see(client_id)  # Scroll to selected client
        
        # Update ProfileCard's client_id
        if hasattr(self.main_app, "profile_card"):
            self.main_app.profile_card.client_id = self.client_id  # Store client_id in ProfileCard
            print(f"ProfileCard client_id updated to: {self.client_id}")

        # Fetch full client data from Treeview
        item_data = self.client_list.item(client_id)
        client_data = item_data.get("values", [])
        
        if not client_data:
            print("⚠ No client data found in Treeview for ID:", client_id)  # Debugging
            return  

        full_name = client_data[0]      # Full name = column 0
        gender = client_data[1]         # Gender = column 1
        birthdate = client_data[2]      # Birthdate = column 2
        primary = client_data[3]        # Primary = column 3
        email = client_data[4]          # Email = column 4
        address = client_data[5]        # Address = column 5

        print(f"Retrieved Client Name:   {full_name}")
        print(f"Retrieved Gender:        {gender}") 
        print(f"Retrieved Birthdate:     {birthdate}") 
        print(f"Retrieved Primary #:     {primary}")
        print(f"Retrieved Email:         {email}") 
        print(f"Retrieved Address:       {address}")  # Debugging

        # Update Other Tabs
        print(f"\nPopulating Info & Appointments tabs for Client ID: {self.client_id}")
        self.main_app.tabs["Info"].populate_client_info(self.client_id)
        self.main_app.tabs["Appointments"].load_client_appointments(self.client_id)
        self.main_app.tabs["Photos"].refresh_photos_list(self.client_id)
        self.main_app.tabs["Prescriptions"].load_prescriptions_for_client(self.client_id)
        self.main_app.tabs["Alerts"].update_client_id(self.client_id)

        # Update Profile Card if it exists
        if hasattr(self.main_app, "profile_card"):
            print("Updating Profile Card for Client ID:", self.client_id)
            self.main_app.profile_card.load_client(self.client_id)
        else:
            print("ProfileCard instance not found.\n")


    def add_client_button(self):
        """Switch to the Info Tab, warn if a duplicate name exists, and populate the full name."""
        full_name = self.name_entry.get().strip()  # Get and trim the entered name

        if not full_name:
            print("No name entered. Cannot add new client.")
            return  # Prevent empty input

        # Check for duplicate name in the database
        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM clients WHERE LOWER(full_name) = LOWER(?)", (full_name,))
                existing_count = cursor.fetchone()[0]
        except Exception as e:
            print(f"Error checking for duplicate client: {e}")
            return

        if existing_count > 0:
             # Show the confirmation popup, calling `handle_duplicate_response` on Yes/No
            ConfirmationPopup(
                self.parent,
                "Duplicate Name Detected",
                f"A client named '{full_name}' already exists.\n\nDo you still want to add this client?",
                lambda response: self.handle_duplicate_response(response, full_name)  # Pass response & full_name
            )
        else:
            # No duplicate detected, proceed immediately
            self.proceed_with_new_client(full_name)

            # Ensure a valid client ID before selecting in TreeView
            if self.main_app.current_client_id != -1:
                print(f"🔄 Selecting Client ID: {self.main_app.current_client_id} in TreeView...")
                self.main_app.tabs["Clients"].client_list.selection_set(str(self.main_app.current_client_id))
                self.main_app.tabs["Clients"].client_list.see(str(self.main_app.current_client_id))  # Bring into view
            else:
                print("⚠ Skipping TreeView selection: Client ID is -1 (new client).")


    def handle_duplicate_response(self, response, full_name):
        """Handles user decision when adding a duplicate client."""
        if not response:
            print("User canceled adding duplicate client.")
            return  # Stop if user selects "No"

        # Proceed with adding the client
        self.proceed_with_new_client(full_name)


    def proceed_with_new_client(self, full_name):
        """Handles adding a new client after confirmation."""
        self.main_app.tabs["Info"].clear_info()
        self.main_app.tabs["Appointments"].clear_appointments()
        self.main_app.tabs["Photos"].clear_photos_list()
        self.main_app.tabs["Prescriptions"].clear_prescriptions_list()

        self.main_app.current_client_id = -1  # Placeholder for new clients

        # Populate the full name entry in the Info tab
        info_tab = self.main_app.tabs["Info"]
        info_tab.full_name_entry.insert(0, full_name)
        
        self.main_app.profile_card.client_id = -1  # Placeholder ID
        self.main_app.profile_card.full_name = full_name
        self.main_app.profile_card.name_label.configure(text=full_name)  # Update UI
        print(f"New Client Placeholder Set: {full_name} (ID: -1)")

        self.main_app.profile_card.set_default_profile_picture()

        # Switch to the Info tab
        self.main_app.switch_to_tab("Info")

        print(f"Proceeding to add a new client: {full_name}")


    def confirm_delete_client(self, event=None):
        """Ask for confirmation before deleting the selected client."""
        selected_client = self.client_list.selection()

        if not selected_client:
            print("⚠ No client selected for deletion.")
            return

        client_id = selected_client[0]  # Get the selected client's ID
        client_name = None

        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT full_name FROM clients WHERE id = ?", (client_id,))
                result = cursor.fetchone()
                if result:
                    client_name = result[0]
        except Exception as e:
            print(f"Error fetching client name: {e}")
            return

        if not client_name:
            print("ERROR: Client ID not found in database.")
            return

        # Create Confirmation Pop-up
        confirmation = ctk.CTkToplevel()
        confirmation.title("Confirm Deletion")
        confirmation.geometry("350x180")
        confirmation.resizable(False, False)
        
        # Make pop-up always on top and disable main window until closed
        confirmation.transient(self.main_app)
        confirmation.grab_set()  # Prevent interactions with main app until pop-up is closed
        confirmation.focus_force()  # Immediately focus the pop-up window

        # Main frame
        main_frame = ctk.CTkFrame(confirmation)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Confirmation Message
        ctk.CTkLabel(
            main_frame, 
            text=f"Are you sure you want to delete '{client_name}' and all associated data?\n\nThis action cannot be undone!",
            font=("Helvetica", 14), wraplength=300
        ).pack(pady=(25, 10))

        # Buttons Frame
        button_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        button_frame.pack(pady=10)

        # Cancel Button (Closes Pop-up)
        ctk.CTkButton(button_frame, text="Cancel", command=confirmation.destroy).pack(side="left", padx=5)

        # Delete Button (Executes Deletion)
        ctk.CTkButton(
            button_frame, text="Delete", fg_color="#FF4444", hover_color="#CC0000",
            command=lambda: self.delete_client(True, client_id, confirmation)
        ).pack(side="right", padx=5)


    def delete_client(self, response, client_id, confirmation_window):
        if not response:
            print("User canceled deletion.")
            confirmation_window.destroy()
            return

        print(f"🗑️ Attempting to delete client ID: {client_id}")

        try:
            with sqlite3.connect(self.main_app.data_manager.db_path) as conn:
                cursor = conn.cursor()

                # Fetch profile picture path
                cursor.execute("SELECT profile_picture FROM clients WHERE id = ?", (client_id,))
                result = cursor.fetchone()
                profile_picture_path = result[0] if result and result[0] else None

                if profile_picture_path and os.path.exists(profile_picture_path):
                    os.remove(profile_picture_path)
                    print("Profile picture deleted.")
                else:
                    print("Profile picture not found or already removed.")

                # Fetch full name to delete image folder
                cursor.execute("SELECT full_name FROM clients WHERE id = ?", (client_id,))
                name_result = cursor.fetchone()

                if name_result:
                    safe_name = name_result[0].replace(" ", "_")
                    self.delete_client_assets(safe_name, client_id)
                else:
                    print("Full name not found. Skipping asset folder deletion.")

                # Delete client from DB
                cursor.execute("DELETE FROM clients WHERE id = ?", (client_id,))
                conn.commit()
                print(f"Client ID {client_id} deleted from database.")

        except Exception as e:
            print(f"Error during client deletion: {e}")
        finally:
            # Always clean up the UI and close the confirmation window
            confirmation_window.destroy()

            # Reset app state
            try:
                self.load_clients()
                self.main_app.tabs["Info"].clear_info()
                self.main_app.tabs["Appointments"].clear_appointments()
                self.main_app.tabs["Photos"].clear_photos_list()
                self.main_app.tabs["Prescriptions"].clear_prescriptions_list()
                self.main_app.tabs["Alerts"].load_alerts()

                if hasattr(self.main_app, "profile_card"):
                    self.main_app.profile_card.load_client(None)

                if hasattr(self.main_app.tabs["Photos"], "preview_label"):
                    self.main_app.tabs["Photos"].preview_label.configure(image=None)
                    self.main_app.tabs["Photos"].preview_label.image = None

                print("UI reset completed after deletion.")

            except Exception as ui_err:
                print(f"UI cleanup issue: {ui_err}")


    def delete_client_assets(self, client_name, client_id):
        """Delete all assets associated with the client."""
        # Delete before/after images folder
        img_folder = self.main_app.data_manager.get_path("images", f"{client_name}_id_{client_id}")
        if os.path.exists(img_folder):
            print(f"Deleted image folder: {img_folder}")
            shutil.rmtree(img_folder)
        else:
            print(f"No image folder found at: {img_folder}")

        # Delete prescriptions PDFs folder
        prescriptions_dir = self.main_app.data_manager.get_path("prescriptions", f"{client_name}_{client_id}")
        if os.path.exists(prescriptions_dir):
            print(f"Deleted prescription folder: {prescriptions_dir}")
            shutil.rmtree(prescriptions_dir)
        else:
            print(f"No matching prescriptions found for {client_name}_{client_id} in {prescriptions_dir}")
        
        print(f"Deleted all assets associated with Client ID: {client_id}")
        

    def sort_treeview(self, column, reverse):
        """Sort the Treeview column when clicked."""
        # Get all rows from the treeview
        data = [(self.client_list.set(item, column), item) for item in self.client_list.get_children("")]

        # Detect if the column contains numbers or text
        try:
            data.sort(key=lambda x: float(x[0]) if x[0].isdigit() else x[0].lower(), reverse=reverse)
        except ValueError:
            data.sort(key=lambda x: x[0].lower(), reverse=reverse)

        # Rearrange items in sorted order
        for index, (val, item) in enumerate(data):
            self.client_list.move(item, "", index)

        self.update_alternating_colors()

        # Toggle sorting order on next click
        self.client_list.heading(column, command=lambda: self.sort_treeview(column, not reverse))
               

    def restore_placeholder(self):
        self.name_entry.delete(0, "end")
        self.name_entry.configure(placeholder_text="Enter client name")
