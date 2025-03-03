import customtkinter as ctk
from tkinter import ttk
from class_elements.profile_card import ProfileCard
from class_elements.treeview_styling import style_treeview  # Import the style function
from datetime import datetime


class AppointmentsPage:
    def __init__(self, parent, conn, main_app):
        self.conn = conn
        self.cursor = conn.cursor()
        self.main_app = main_app  # Reference to main app (to update ProfileCard & InfoPage)
        self.client_id = None  # Store selected client ID
        self.sort_orders = {}  # Store sort order (ascending/descending) for each column

        # Create Main frame (holds both Treeview and Details frame)
        main_frame = ctk.CTkFrame(parent)
        main_frame.pack(fill="both", expand=True, padx=10, pady=(0, 0))

        # Configure grid columns for proportional sizing
        main_frame.columnconfigure(0, weight=13)  # Treeview frame gets 3x the space
        main_frame.columnconfigure(1, weight=7)  # Details frame gets 1x the space
        main_frame.rowconfigure(1, weight=1)  # Allow frames to stretch vertically

        # ✅ Step 1: Create a Frame for the search box
        search_frame = ctk.CTkFrame(main_frame)
        search_frame.grid(row=0, column=0, columnspan=2, sticky="w", padx=5, pady=(0, 10))
        search_frame.columnconfigure(1, weight=1)  # Ensure the combobox expands properly

        # ✅ Step 2: Add a Search Label (Matches Info Page Styling)
        search_label = ctk.CTkLabel(search_frame, text="Select Client:", font=("Arial", 14))
        search_label.grid(row=0, column=0, sticky="w", padx=10)

        # ✅ Step 3: Update the Combobox to Match Styling
        self.client_var = ctk.StringVar()
        self.client_combobox = ctk.CTkComboBox(
            search_frame, variable=self.client_var, values=[], 
            command=self.on_client_selected, width=200
        )
        self.client_combobox.grid(row=0, column=1, sticky="w", padx=(10, 5))  # Stretch across grid

        # Create Treeview Frame
        treeview_frame = ctk.CTkFrame(main_frame)
        treeview_frame.grid(row=1, column=0, sticky="nsew", padx=(0, 5))

        # Apply treeview styling
        style_treeview("Appointments.Treeview")

        # Treeview widget for appointments
        columns = ("date", "time", "treatment", "price", "photo")
        self.appointments_table = ttk.Treeview(treeview_frame, selectmode="extended", columns=columns, show="headings", height=10, style="Appointments.Treeview")
        self.appointments_table.pack(side="left", fill="both", expand=True)

        # Create clickable column headers
        for col in columns:
            self.appointments_table.heading(col, text=col.capitalize(), command=lambda c=col: self.sort_appointments_treeview(c))

        # Add vertical scrollbar
        scrollbar_y = ttk.Scrollbar(treeview_frame, orient="vertical", command=self.appointments_table.yview)
        scrollbar_y.pack(side="right", fill="y")
        self.appointments_table.configure(yscrollcommand=scrollbar_y.set)

        # Set initial column widths
        self.set_column_widths()

        # Bind the Treeview to resize event
        self.appointments_table.bind("<Configure>", lambda event: self.set_column_widths())

        # Bind selection event to Treeview
        self.appointments_table.bind("<ButtonRelease-1>", self.on_appointment_select)

        # Create Details Frame
        details_frame = ctk.CTkFrame(main_frame)
        details_frame.grid(row=0, rowspan=2, column=1, sticky="nsew", padx=(5, 0))

        # Insert Label into Details Frame
        treatment_notes_label = ctk.CTkLabel(details_frame, text="Treatment Notes", font=("Arial", 16))
        treatment_notes_label.pack(anchor="w", padx=10, pady=(5, 5))

        # Insert Textbox into Details Frame
        self.details_textbox = ctk.CTkTextbox(details_frame, font=("Arial", 12), corner_radius=0, wrap="word", fg_color="#1E1E1E")
        self.details_textbox.pack(fill="both", expand=True)

        # ✅ Load clients into combobox
        self.load_clients_into_combobox()

    def load_clients_into_combobox(self):
        """Fetch all clients and add them to the combobox."""
        self.cursor.execute("SELECT id, full_name FROM clients ORDER BY full_name ASC")
        clients = self.cursor.fetchall()
        self.client_mapping = {client[1]: client[0] for client in clients}  # {Name: ID} dictionary

        # ✅ Populate combobox with client names
        self.client_combobox.configure(values=list(self.client_mapping.keys()))

        # ✅ Pre-select first client if available
        if clients:
            first_client = clients[0][1]  # Get first client name
            self.client_combobox.set(first_client)
            self.on_client_selected(first_client)

    def on_client_selected(self, selected_client):
        """Triggered when a client is selected from the combobox."""
        if selected_client in self.client_mapping:
            self.client_id = self.client_mapping[selected_client]
            print(f"🟢 Selected Client: {selected_client} (ID: {self.client_id})")

            # ✅ Step 1: Update Profile Card
            if hasattr(self.main_app, "profile_card"):
                self.main_app.profile_card.load_client(self.client_id)

            # ✅ Step 2: Update Info Tab
            if hasattr(self.main_app, "tabs") and "Info" in self.main_app.tabs:
                self.main_app.tabs["Info"].populate_client_info(self.client_id)

            # ✅ Step 3: Load Appointments for the Selected Client
            self.load_client_appointments(self.client_id)


    def set_column_widths(self):
        """Adjust column widths dynamically based on the current Treeview width."""
        total_width = self.appointments_table.winfo_width()

        # Set column widths as percentages of the total width
        self.appointments_table.column("date", width=int(total_width * 0.10), minwidth=80)
        self.appointments_table.column("time", width=int(total_width * 0.10), minwidth=75)
        self.appointments_table.column("treatment", width=int(total_width * 0.55), minwidth=200)
        self.appointments_table.column("price", width=int(total_width * 0.08), minwidth=70)
        self.appointments_table.column("photo", width=int(total_width * 0.07), minwidth=40)

    def load_client_appointments(self, client_id):
        """Load appointments for the selected client into the Treeview."""
        self.client_id = client_id  # Store the current client ID

        # Clear existing rows in the Treeview
        self.appointments_table.delete(*self.appointments_table.get_children())
        
        # Fetch appointments for the selected client
        self.cursor.execute("""
            SELECT id, date, time, treatment, price, photo_taken, treatment_notes 
            FROM appointments 
            WHERE client_id = ?
            ORDER BY date DESC
        """, (client_id,))

        # Convert fetched rows into a list of tuples
        appointments = self.cursor.fetchall()

        # **Sort appointments by date (latest first)**
        try:
            appointments.sort(key=lambda x: datetime.strptime(x[1], "%m/%d/%Y"), reverse=True)
        except ValueError:
            print("⚠ Date formatting issue detected in database. Ensure format is MM/DD/YYYY.")

        # Insert sorted appointments into the TreeView
        for row in appointments:
            appointment_id, date, time, treatment, price, photo_taken, treatment_notes = row
            self.appointments_table.insert(
                "", "end", values=(date, time, treatment, price, photo_taken), tags=(treatment_notes,)
            )

    def on_appointment_select(self, event):
        """Handle selection of an appointment and update the Treatment Notes textbox."""
        selected_item = self.appointments_table.selection()  # Get the selected Treeview item
        if not selected_item:
            return

        # Get treatment notes from the selected item
        treatment_notes = self.appointments_table.item(selected_item)["tags"][0]  # Fetch the stored tag
        self.details_textbox.delete("1.0", "end")  # Clear existing text
        self.details_textbox.insert("1.0", treatment_notes)  # Insert the treatment notes

    def clear_appointments(self):
        """Clear all rows in the appointments Treeview and treatment notes."""
        self.appointments_table.delete(*self.appointments_table.get_children())
        self.details_textbox.delete("1.0", "end")  # Clear the treatment notes text box

    def sort_appointments_treeview(self, column):
        """Sort the appointments TreeView by column."""
        data = [(self.appointments_table.set(item, column), item) for item in self.appointments_table.get_children()]

        # Toggle sort order (ascending/descending)
        reverse = self.sort_orders.get(column, False)
        self.sort_orders[column] = not reverse  # Flip the sorting order for next click

        try:
            if column == "date":
                data.sort(key=lambda x: datetime.strptime(x[0], "%m/%d/%Y"), reverse=reverse)
            elif column == "time":
                data.sort(key=lambda x: datetime.strptime(x[0], "%I:%M %p"), reverse=reverse)
            elif column == "price":
                data.sort(key=lambda x: float(x[0].replace("$", "")), reverse=reverse)
            else:
                data.sort(key=lambda x: x[0].lower(), reverse=reverse)  # Alphabetical sorting
        except ValueError:
            data.sort(key=lambda x: x[0], reverse=reverse)

        # Rearrange items in sorted order
        for index, (val, item) in enumerate(data):
            self.appointments_table.move(item, "", index)

        # Update the column heading to trigger sorting when clicked again
        self.appointments_table.heading(column, command=lambda c=column: self.sort_appointments_treeview(c))