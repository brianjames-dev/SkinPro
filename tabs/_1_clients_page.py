from tkinter import ttk
import customtkinter as ctk
from PIL import Image
from class_elements.profile_card import ProfileCard
from class_elements.treeview_styling import style_treeview
from class_elements.ctk_popup import ConfirmationPopup
import os

class ClientsPage:
    def __init__(self, parent, conn, main_app):
        self.parent = parent
        self.conn = conn
        self.main_app = main_app
        self.cursor = conn.cursor()

        # Frame for Search and Treeview
        main_frame = ctk.CTkFrame(parent)
        main_frame.pack(fill="both", expand=True, padx=10, pady=(0, 0))

        # Frame for Search Bar
        search_frame = ctk.CTkFrame(main_frame)
        search_frame.pack(fill="x", pady=(0, 10))

        # Search Label
        search_label = ctk.CTkLabel(search_frame, text="Search by Name:", font=("Arial", 14))
        search_label.grid(row=0, column=0, sticky="w", padx=10)

        # Search Entry
        self.name_entry = ctk.CTkEntry(search_frame, width=300, placeholder_text="Enter client name", border_width=0)
        self.name_entry.grid(row=0, column=1, sticky="ew", padx=0)

        # Add Client Button
        add_client_icon = ctk.CTkImage(light_image=Image.open("icons/add_client.png"), size=(24, 24))
        add_client_button = ctk.CTkButton(
            search_frame,
            image=add_client_icon,
            text="",
            width=24,
            height=24,
            fg_color="transparent",
            hover_color="#555555",
            command=self.add_client_button
        )
        add_client_button.grid(row=0, column=2, padx=5)

        # Configure the columns in the search_frame
        search_frame.columnconfigure(1, weight=1)  # Make the entry box expand

        # Frame for Treeview
        table_frame = ctk.CTkFrame(main_frame)
        table_frame.pack(fill="both", expand=True, pady=(0, 10))

        # Apply Treeview Styling
        style_treeview("Clients.Treeview")

        # Treeview Widget
        columns = ("Name", "Gender", "Birthdate", "Phone #", "Email", "Address")
        self.client_list = ttk.Treeview(table_frame, selectmode="browse", columns=columns, show="headings", style="Clients.Treeview")

        # Define column headers
        self.client_list.heading("Name", text="Name")
        self.client_list.heading("Gender", text="Gender")
        self.client_list.heading("Birthdate", text="Birthdate")
        self.client_list.heading("Phone #", text="Phone #")
        self.client_list.heading("Email", text="Email")
        self.client_list.heading("Address", text="Address")

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
            bg_color="#1E1E1E",
            font=("Arial", 24),
            text_color="white",
            anchor="center"
        )
        self.no_results_label.place(relx=0.5, rely=0.5, anchor="center")
        self.no_results_label.lower()  # Hide the label by lowering it below the Treeview

        # Load data from the database
        self.load_clients()

        # Bind the Treeview's parent to a resize event
        self.client_list.bind("<Configure>", lambda event: self.set_column_widths())

        # Key "bind" configurations for quick functionality
        self.name_entry. bind("<KeyRelease>", lambda event: (self.search_client(), "break"))    # Prevent default behavior
        self.client_list.bind("<Return>", self.jump_to_info_tab)                                # Pressing Enter in Treeview
        self.client_list.bind("<ButtonRelease-1>", self.update_profile_card)                    # Update profile card w/ single-click
        self.client_list.bind("<Double-1>", self.jump_to_info_tab)                              # Double left-click
        self.client_list.bind_all("<Control-Return>", lambda event: self.add_client_button())   # Bind globally for Ctrl+Enter
        self.client_list.bind("<Delete>", self.confirm_delete_client)                           # Deletes client
        self.client_list.bind("<BackSpace>", self.confirm_delete_client)                        # Deletes client
            
    def set_column_widths(self):
        # Get the current width of the Treeview
        total_width = self.client_list.winfo_width()

        # Set column widths as percentages of the total width
        self.client_list.column("Name", width=int(total_width * 0.20), minwidth=150)
        self.client_list.column("Gender", width=int(total_width * 0.05), minwidth=55)
        self.client_list.column("Birthdate", width=int(total_width * 0.10), minwidth=80)
        self.client_list.column("Phone #", width=int(total_width * 0.15), minwidth=100)
        self.client_list.column("Email", width=int(total_width * 0.10), minwidth=200)
        self.client_list.column("Address", width=int(total_width * 0.40), minwidth=200)

    def load_clients(self):
        """Load all clients from the database and insert them into the Treeview."""
        print("🔄 Reloading all clients...")  # Debugging

        self.client_list.delete(*self.client_list.get_children())  # Clear existing rows

        self.cursor.execute("""
            SELECT id, full_name, gender, birthdate, phone, email, address1 || ' ' || address2 FROM clients
        """)
        results = self.cursor.fetchall()

        if not results:
            print("⚠ No clients found in the database!")  # Debugging
            self.no_results_label.configure(text="No clients found in the database.")
            self.no_results_label.lift()  # Show the label if the DB is empty
            return
        
        for row in results:
            client_id = row[0]  # ✅ Extract client_id
            client_values = row[1:]  # ✅ Everything except client_id
            self.client_list.insert("", "end", iid=str(client_id), values=client_values)

        print(f"✅ Loaded {len(results)} clients.")  # Debugging
        self.no_results_label.lower()  # Hide "No Results" label

    def search_client(self):
        """Search for clients based on the name entered in the search box."""
        query = self.name_entry.get().strip()   # Get and trim the search query

        if query:
            self.client_list.delete(*self.client_list.get_children())  # Clear existing rows

            # ✅ Include client_id in the query (important for selection!)
            self.cursor.execute("""
                SELECT id, full_name, gender, birthdate, phone, email, address1 || ' ' || address2 
                FROM clients 
                WHERE full_name LIKE ?
            """, (f"%{query}%",))
            
            results = self.cursor.fetchall()
            if results:
                for row in results:
                    client_id = row[0]  # ✅ Extract client_id
                    client_values = row[1:]  # ✅ Everything except client_id

                    # ✅ Insert using client_id as the TreeView iid
                    self.client_list.insert("", "end", iid=str(client_id), values=client_values)
                
                self.no_results_label.lower()  # Hide the "No Results" label
            
            else:
                # Show "No Results" label
                self.no_results_label.configure(text=f"No results for '{query}'\n\nPress Ctrl + Enter to add.")
                self.no_results_label.lift()  # Bring the label to the front

        else:
            self.load_clients()  # Reload all clients if no search query is provided
            self.no_results_label.lower()  # Hide the "No Results" label

    def jump_to_info_tab(self, event):
        # Switch to the Info tab
        self.main_app.switch_to_tab("Info")

    def update_profile_card(self, event):
        """Update the profile card when a client is single-clicked in the treeview."""
        
        # ✅ 1. Ensure a client is selected
        selected_client = self.client_list.selection()
        if not selected_client:
            print("⚠ No item selected in the Treeview.")  # Debugging
            return  

        # ✅ 2. Get selected client's client_id from Treeview
        client_id = selected_client[0]  # Treeview 'iid' is now the correct client_id
        self.client_id = int(client_id)  # Store current client_id for future use
        print(f"\n🟢 Selected Client ID:      {self.client_id}")  # Debugging

        # ✅ 3. Update ProfileCard's client_id
        if hasattr(self.main_app, "profile_card"):
            self.main_app.profile_card.client_id = self.client_id  # 🔥 Store client_id in ProfileCard
            print(f"✅ ProfileCard client_id updated to: {self.client_id}")

        # ✅ 4. Fetch full client data from Treeview
        item_data = self.client_list.item(client_id)
        client_data = item_data.get("values", [])
        
        if not client_data:
            print("⚠ No client data found in Treeview for ID:", client_id)  # Debugging
            return  

        full_name = client_data[0]      # Full name = column 0
        gender = client_data[1]         # Gender = column 1
        birthdate = client_data[2]      # Birthdate = column 2
        phone = client_data[3]          # Phone = column 3
        email = client_data[4]          # Email = column 4
        address = client_data[5]        # Address = column 5

        print(f"🔹 Retrieved Client Name:   {full_name}")
        print(f"🔹 Retrieved Gender:        {gender}") 
        print(f"🔹 Retrieved Birthdate:     {birthdate}") 
        print(f"🔹 Retrieved Phone #:       {phone}")
        print(f"🔹 Retrieved Email:         {email}") 
        print(f"🔹 Retrieved Address:       {address}")  # Debugging

        # ✅ 5. Update Other Tabs
        print(f"\n🔄 Populating Info & Appointments tabs for Client ID: {self.client_id}")
        self.main_app.tabs["Info"].populate_client_info(self.client_id)
        self.main_app.tabs["Appointments"].load_client_appointments(self.client_id)

        # ✅ 6. Update Profile Card if it exists
        if hasattr(self.main_app, "profile_card"):
            print("🟢 Updating Profile Card for Client ID:", self.client_id)
            self.main_app.profile_card.load_client(self.client_id)
        else:
            print("⚠ ProfileCard instance not found.\n")


    def add_client_button(self):
        """Switch to the Info Tab, warn if a duplicate name exists, and populate the full name."""
        full_name = self.name_entry.get().strip()  # Get and trim the entered name

        if not full_name:
            print("⚠ No name entered. Cannot add new client.")
            return  # Prevent empty input

        # ✅ Step 1: Check for duplicate name in the database
        self.cursor.execute("SELECT COUNT(*) FROM clients WHERE LOWER(full_name) = LOWER(?)", (full_name,))
        existing_count = self.cursor.fetchone()[0]

        if existing_count > 0:
             # ✅ Step 2: Show the confirmation popup, calling `handle_duplicate_response` on Yes/No
            ConfirmationPopup(
                self.parent,
                "Duplicate Name Detected",
                f"A client named '{full_name}' already exists.\n\nDo you still want to add this client?",
                lambda response: self.handle_duplicate_response(response, full_name)  # Pass response & full_name
            )
        else:
            # ✅ No duplicate detected, proceed immediately
            self.proceed_with_new_client(full_name)

    def handle_duplicate_response(self, response, full_name):
        """Handles user decision when adding a duplicate client."""
        if not response:
            print("🔴 User canceled adding duplicate client.")
            return  # Stop if user selects "No"

        # ✅ Proceed with adding the client
        self.proceed_with_new_client(full_name)

    def proceed_with_new_client(self, full_name):
        """Handles adding a new client after confirmation."""
        self.main_app.tabs["Info"].clear_info()
        self.main_app.tabs["Appointments"].clear_appointments()
        self.main_app.current_client_id = -1  # Placeholder for new clients

        # ✅ Populate the full name entry in the Info tab
        info_tab = self.main_app.tabs["Info"]
        info_tab.full_name_entry.insert(0, full_name)
        
        # ✅ Update the Profile Card with the New Client Name
        if hasattr(self.main_app, "profile_card"):
            self.main_app.profile_card.client_id = -1  # Placeholder ID
            self.main_app.profile_card.full_name = full_name
            self.main_app.profile_card.name_label.configure(text=full_name)  # Update UI
            print(f"🆕 New Client Placeholder Set: {full_name} (ID: -1)")

        # ✅ Switch to the Info tab
        self.main_app.switch_to_tab("Info")

        print(f"🆕 Proceeding to add a new client: {full_name}")

    def confirm_delete_client(self, event=None):
        """Ask for confirmation before deleting the selected client."""
        selected_client = self.client_list.selection()

        if not selected_client:
            print("⚠ No client selected for deletion.")
            return

        client_id = selected_client[0]  # Get the selected client's ID
        self.cursor.execute("SELECT full_name FROM clients WHERE id = ?", (client_id,))
        client_name = self.cursor.fetchone()

        if not client_name:
            print("❌ ERROR: Client ID not found in database.")
            return

        client_name = client_name[0]  # Extract name from tuple

        # ✅ Show Confirmation Popup
        ConfirmationPopup(
            self.parent,
            "Confirm Deletion",
            f"Are you sure you want to delete '{client_name}' and all associated data?\nThis action cannot be undone!",
            lambda response: self.delete_client(response, client_id)
        )

    def delete_client(self, response, client_id):
        """Deletes the client, their profile picture, and all associated records if confirmed."""
        if not response:
            print("🔴 User canceled deletion.")
            return  # Stop if the user selects "No"

        try:
            print(f"🗑️ Deleting client ID: {client_id}")

            # ✅ Fetch the profile picture path before deletion
            self.cursor.execute("SELECT profile_picture FROM clients WHERE id = ?", (client_id,))
            result = self.cursor.fetchone()

            if result and result[0]:  # Ensure a valid path exists
                profile_picture_path = result[0]
                print(f"🖼️ Attempting to delete profile image: {profile_picture_path}")

                # ✅ Check if the file exists before attempting to delete
                if os.path.exists(profile_picture_path):
                    os.remove(profile_picture_path)
                    print("✅ Profile image successfully deleted.")
                else:
                    print("⚠ Profile image file not found, skipping deletion.")

            # ✅ Delete the client from the database (ON DELETE CASCADE removes linked data)
            self.cursor.execute("DELETE FROM clients WHERE id = ?", (client_id,))
            self.conn.commit()

            # ✅ Refresh UI after deletion
            self.load_clients()
            
            # ✅ Reset ProfileCard (Loads default state)
            if hasattr(self.main_app, "profile_card"):
                self.main_app.profile_card.load_client(None)  # Reset profile card

            # ✅ Reset Info Tab (Clear all fields)
            if "Info" in self.main_app.tabs:
                self.main_app.tabs["Info"].clear_info()

            print(f"✅ Successfully deleted Client ID: {client_id} and their profile image.")

        except Exception as e:
            print(f"❌ Database error during deletion: {e}")
            