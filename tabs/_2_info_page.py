import customtkinter as ctk
from tkinter import ttk
from class_elements.profile_card import ProfileCard


# Placeholder text phrases
full_name_placeholder           = "Enter full name (e.g., John Doe)"
birthdate_placeholder           = "MM/DD/YYYY"
address1_placeholder            = "Enter street address (e.g., 123 Main St.)"
address2_placeholder            = "(optional)"
city_placeholder                = "e.g., Santa Rosa"
zip_placeholder                 = "e.g., 95404"
email_placeholder               = "john.doe@example.com"
phone_placeholder               = "e.g., 555-123-4567"
allergies_placeholder           = "List any known allergies (e.g., nuts, latex)"
health_conditions_placeholder   = "List known health conditions (e.g., diabetes, asthma)"
medications_placeholder         = "List current medications (e.g., Ibuprofen)"
treatment_areas_placeholder     = "List desired treatment area(s) (e.g., face, legs)"
current_products_placeholder    = "List skincare products used (e.g., cleanser, moisturizer)"
skin_conditions_placeholder     = "Describe skin conditions (e.g., acne, rosacea)"
other_notes_placeholder         = "Add any relevant notes (Optional)"
desired_improvement_placeholder = "What improvement is the client seeking?"

class InfoPage:
    def __init__(self, parent, conn):
        self.conn = conn
        self.cursor = conn.cursor()
        self.client_id = None

        # Create a frame to hold all input fields
        form_frame = ctk.CTkFrame(parent)
        form_frame.pack(fill="both", expand=True, padx=10, pady=10)
        form_frame.columnconfigure(0, weight=0)
        form_frame.columnconfigure(1, weight=1)

        # Save button
        self.save_button = ctk.CTkButton(form_frame, text="Save", command=self.save_client_data)
        self.save_button.grid(row=15, column=0, columnspan=2, sticky="ne", padx=5, pady=5)

        # Frame for Full Name (entry), Gender, Birthdate
        name_frame = ctk.CTkFrame(form_frame, fg_color="transparent")
        name_frame.grid(row=0, column=1, sticky="ew", padx=5, pady=5)
        name_frame.columnconfigure(0, weight=2)  # Full Name entry box
        name_frame.columnconfigure(1, weight=0)  # Gender label
        name_frame.columnconfigure(2, weight=0)  # Gender combo box
        name_frame.columnconfigure(3, weight=0)  # Birthdate label
        name_frame.columnconfigure(4, weight=1)  # Birthdate entry box

        # Row 1: Full Name, Gender, Birthdate
        ctk.CTkLabel(form_frame, text="Full Name").grid(row=0, column=0, sticky="w", padx=5, pady=5)
        self.full_name_entry = ctk.CTkEntry(name_frame, border_width=0, placeholder_text=full_name_placeholder)
        self.full_name_entry.grid(row=0, column=0, sticky="ew")

        ctk.CTkLabel(name_frame, text="Gender").grid(row=0, column=1, sticky="w", padx=(20, 5))
        self.gender_entry = ctk.CTkComboBox(name_frame, values=["Female", "Male"], border_width=0)
        self.gender_entry.grid(row=0, column=2, sticky="ew")
        self.gender_entry.set("Select Gender")  # Assuming it should have a default value

        ctk.CTkLabel(name_frame, text="Birthdate").grid(row=0, column=3, sticky="w", padx=(20, 5))
        self.birthdate_entry = ctk.CTkEntry(name_frame, border_width=0, placeholder_text=birthdate_placeholder)
        self.birthdate_entry.grid(row=0, column=4, sticky="ew")

        # Row 2: Address 1
        ctk.CTkLabel(form_frame, text="Address 1").grid(row=1, column=0, sticky="w", padx=5, pady=5)
        self.address1_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text=address1_placeholder)
        self.address1_entry.grid(row=1, column=1, padx=5, pady=5, sticky="ew")

        # Row 3: Address 2
        ctk.CTkLabel(form_frame, text="Address 2").grid(row=2, column=0, sticky="w", padx=5, pady=5)
        self.address2_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text=address2_placeholder)
        self.address2_entry.grid(row=2, column=1, padx=5, pady=5, sticky="ew")

        # Frame for City, State, Zip
        address_tri_frame = ctk.CTkFrame(form_frame, fg_color="transparent")
        address_tri_frame.grid(row=3, column=1, sticky="ew", padx=5, pady=5)
        address_tri_frame.columnconfigure(0, weight=3)  # City entry box
        address_tri_frame.columnconfigure(1, weight=0)  # State label
        address_tri_frame.columnconfigure(2, weight=0)  # State combo box
        address_tri_frame.columnconfigure(3, weight=0)  # Zip label
        address_tri_frame.columnconfigure(4, weight=1)  # Zip entry box

        # Row 4: City, State, Zip
        ctk.CTkLabel(form_frame, text="City").grid(row=3, column=0, sticky="w", padx=5, pady=5)
        self.city_entry = ctk.CTkEntry(address_tri_frame, border_width=0, placeholder_text=city_placeholder)
        self.city_entry.grid(row=3, column=0, sticky="ew")

        ctk.CTkLabel(address_tri_frame, text="State").grid(row=3, column=1, sticky="w", padx=(20, 5))
        self.state_entry = ctk.CTkComboBox(address_tri_frame, border_width=0,
                                   values=["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", 
                                           "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", 
                                           "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", 
                                           "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", 
                                           "VT", "VA", "WA", "WV", "WI", "WY"])
        self.state_entry.grid(row=3, column=2, sticky="ew")
        self.state_entry.set("Select State")  # Assuming it should have a default value

        ctk.CTkLabel(address_tri_frame, text="Zip").grid(row=3, column=3, sticky="w", padx=(20, 5))
        self.zip_entry = ctk.CTkEntry(address_tri_frame, border_width=0, placeholder_text=zip_placeholder)
        self.zip_entry.grid(row=3, column=4, sticky="ew")

        # Frame for Email, Cell Phone, Referred by
        contacts_tri_frame = ctk.CTkFrame(form_frame, fg_color="transparent")
        contacts_tri_frame.grid(row=4, column=1, sticky="ew", padx=5, pady=5)
        contacts_tri_frame.columnconfigure(0, weight=1)  # Email entry box
        contacts_tri_frame.columnconfigure(1, weight=0)  # Cell Phone label
        contacts_tri_frame.columnconfigure(2, weight=1)  # Cell Phone entry box
        contacts_tri_frame.columnconfigure(3, weight=0)  # Referred by label
        contacts_tri_frame.columnconfigure(4, weight=1)  # Referred by entry box

        # Row 5: Email, Cell Phone, Referred by
        ctk.CTkLabel(form_frame, text="Email").grid(row=4, column=0, sticky="w", padx=5, pady=5)
        self.email_entry = ctk.CTkEntry(contacts_tri_frame, border_width=0, placeholder_text=email_placeholder)
        self.email_entry.grid(row=4, column=0, sticky="ew")
       
        ctk.CTkLabel(contacts_tri_frame, text="Phone #").grid(row=4, column=1, sticky="w", padx=(20, 5))
        self.phone_entry = ctk.CTkEntry(contacts_tri_frame, border_width=0, placeholder_text=phone_placeholder)
        self.phone_entry.grid(row=4, column=2, sticky="ew")

        ctk.CTkLabel(contacts_tri_frame, text="Referred by").grid(row=4, column=3, sticky="w", padx=(20, 5))
        self.referred_by_combobox = ctk.CTkComboBox(contacts_tri_frame, values=[], border_width=0)
        self.referred_by_combobox.grid(row=4, column=4, sticky="ew")
        self.referred_by_combobox.set("")
        self.referred_by_combobox.bind("<KeyRelease>", lambda event: self.update_referred_by_suggestions())

        # Separator
        separator = ttk.Separator(form_frame, orient="horizontal")
        separator.grid(row=5, column=0, columnspan=2, sticky="ew", padx=5, pady=10)

        # Row 6: Allergies
        ctk.CTkLabel(form_frame, text="Allergies").grid(row=6, column=0, sticky="w", padx=5, pady=5)
        self.allergies_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text=allergies_placeholder)
        self.allergies_entry.grid(row=6, column=1, padx=5, pady=5, sticky="ew")

        # Row 7: Health Conditions
        ctk.CTkLabel(form_frame, text="Health Conditions").grid(row=7, column=0, sticky="w", padx=5, pady=5)
        self.health_conditions_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text=health_conditions_placeholder)
        self.health_conditions_entry.grid(row=7, column=1, padx=5, pady=5, sticky="ew")

        # Row 8: Medications
        ctk.CTkLabel(form_frame, text="Medications").grid(row=8, column=0, sticky="w", padx=5, pady=5)
        self.medications_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text=medications_placeholder)
        self.medications_entry.grid(row=8, column=1, padx=5, pady=5, sticky="ew")

        # Row 9: Area to be Treated
        ctk.CTkLabel(form_frame, text="Area to be Treated").grid(row=9, column=0, sticky="w", padx=5, pady=5)
        self.treatment_areas_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text=treatment_areas_placeholder)
        self.treatment_areas_entry.grid(row=9, column=1, padx=5, pady=5, sticky="ew")

        # Row 10: Current Product Use
        ctk.CTkLabel(form_frame, text="Current Product Use").grid(row=10, column=0, sticky="w", padx=5, pady=5)
        self.current_products_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text=current_products_placeholder)
        self.current_products_entry.grid(row=10, column=1, padx=5, pady=5, sticky="ew")

        # Row 11: Skin Conditions
        ctk.CTkLabel(form_frame, text="Skin Conditions").grid(row=11, column=0, sticky="w", padx=5, pady=5)
        self.skin_conditions_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text=skin_conditions_placeholder)
        self.skin_conditions_entry.grid(row=11, column=1, padx=5, pady=5, sticky="ew")

        # Separator
        separator = ttk.Separator(form_frame, orient="horizontal")
        separator.grid(row=12, column=0, columnspan=2, sticky="ew", padx=5, pady=10)

        # Row 12: Other Notes
        ctk.CTkLabel(form_frame, text="Other Notes").grid(row=13, column=0, sticky="w", padx=5, pady=5)
        self.other_notes_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text=other_notes_placeholder)
        self.other_notes_entry.grid(row=13, column=1, padx=5, pady=5, sticky="ew")

        # Row 13: Desired Improvement
        ctk.CTkLabel(form_frame, text="Desired Improvement").grid(row=14, column=0, sticky="w", padx=5, pady=5)
        self.desired_improvement_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text=desired_improvement_placeholder)
        self.desired_improvement_entry.grid(row=14, column=1, padx=5, pady=5, sticky="ew")

        self.full_name_entry.          bind("<Return>", lambda event: self.focus_next_widget(event))
        self.birthdate_entry.          bind("<Return>", lambda event: self.focus_next_widget(event))
        self.address1_entry.           bind("<Return>", lambda event: self.focus_next_widget(event))
        self.address2_entry.           bind("<Return>", lambda event: self.focus_next_widget(event))
        self.city_entry.               bind("<Return>", lambda event: self.focus_next_widget(event))
        self.zip_entry.                bind("<Return>", lambda event: self.focus_next_widget(event))
        self.phone_entry.              bind("<Return>", lambda event: self.focus_next_widget(event))
        self.email_entry.              bind("<Return>", lambda event: self.focus_next_widget(event))
        self.allergies_entry.          bind("<Return>", lambda event: self.focus_next_widget(event))
        self.health_conditions_entry.  bind("<Return>", lambda event: self.focus_next_widget(event))
        self.medications_entry.        bind("<Return>", lambda event: self.focus_next_widget(event))
        self.treatment_areas_entry.    bind("<Return>", lambda event: self.focus_next_widget(event))
        self.current_products_entry.   bind("<Return>", lambda event: self.focus_next_widget(event))
        self.skin_conditions_entry.    bind("<Return>", lambda event: self.focus_next_widget(event))
        self.other_notes_entry.        bind("<Return>", lambda event: self.focus_next_widget(event))
        self.desired_improvement_entry.bind("<Return>", lambda event: self.focus_next_widget(event))

    def focus_next_widget(self, event):
        """Move focus to the next widget (mimic Tab behavior)."""
        event.widget.tk_focusNext().focus()
        return "break"  # Prevent default behavior

    def populate_full_name(self, full_name):
        """Populate the Full Name entry box with the given text."""
        self.full_name_entry.delete(0, "end")  # Clear the entry box
        self.full_name_entry.insert(0, full_name)  # Insert the new text

    def populate_client_info(self, client_id):
        """Fetch client data from the database and populate the fields, including health information."""
        # Fetch general client information
        self.cursor.execute("""
            SELECT 
                full_name, gender, birthdate, 
                address1, address2, city, 
                state, zip, phone, email 
            FROM clients 
            WHERE id = ?
        """, (client_id,))
        client_result = self.cursor.fetchone()

        # Fetch health-related client information
        self.cursor.execute("""
            SELECT 
                allergies, health_conditions, medications, 
                treatment_areas, current_products, skin_conditions, 
                other_notes, desired_improvement 
            FROM client_health_info 
            WHERE client_id = ?
        """, (client_id,))
        health_result = self.cursor.fetchone()

        if client_result:
            (
                full_name, gender, birthdate, 
                address1, address2, city, 
                state, zip, phone, email
            ) = client_result

            # Populate general client fields
            self.full_name_entry.delete(0, "end")
            self.full_name_entry.insert(0, full_name)

            self.gender_entry.set(gender)

            self.birthdate_entry.delete(0, "end")
            self.birthdate_entry.insert(0, birthdate)

            self.address1_entry.delete(0, "end")
            self.address1_entry.insert(0, address1)

            self.address2_entry.delete(0, "end")
            self.address2_entry.insert(0, address2)

            self.city_entry.delete(0, "end")
            self.city_entry.insert(0, city)

            self.state_entry.set(state)

            self.zip_entry.delete(0, "end")
            self.zip_entry.insert(0, zip)

            self.phone_entry.delete(0, "end")
            self.phone_entry.insert(0, phone)

            self.email_entry.delete(0, "end")
            self.email_entry.insert(0, email)

        if health_result:
            (
                allergies, health_conditions, medications, 
                treatment_areas, current_products, skin_conditions, 
                other_notes, desired_improvement
            ) = health_result

            # Populate health-related fields
            self.allergies_entry.delete(0, "end")
            self.allergies_entry.insert(0, allergies)

            self.health_conditions_entry.delete(0, "end")
            self.health_conditions_entry.insert(0, health_conditions)

            self.medications_entry.delete(0, "end")
            self.medications_entry.insert(0, medications)

            self.treatment_areas_entry.delete(0, "end")
            self.treatment_areas_entry.insert(0, treatment_areas)

            self.current_products_entry.delete(0, "end")
            self.current_products_entry.insert(0, current_products)

            self.skin_conditions_entry.delete(0, "end")
            self.skin_conditions_entry.insert(0, skin_conditions)

            self.other_notes_entry.delete(0, "end")
            self.other_notes_entry.insert(0, other_notes)

            self.desired_improvement_entry.delete(0, "end")
            self.desired_improvement_entry.insert(0, desired_improvement)

    def clear_info(self):
        """Clear all fields in the Info tab."""
        self.full_name_entry.delete(0, "end")
        self.gender_entry.set("")
        self.birthdate_entry.delete(0, "end")
        self.phone_entry.delete(0, "end")
        self.email_entry.delete(0, "end")
        self.address1_entry.delete(0, "end")
        self.address2_entry.delete(0, "end")
        self.city_entry.delete(0, "end")
        self.state_entry.set("")
        self.zip_entry.delete(0, "end")
        self.referred_by_combobox.set("")
        self.allergies_entry.delete(0, "end")
        self.health_conditions_entry.delete(0, "end")
        self.medications_entry.delete(0, "end")
        self.treatment_areas_entry.delete(0, "end")
        self.current_products_entry.delete(0, "end")
        self.skin_conditions_entry.delete(0, "end")
        self.other_notes_entry.delete(0, "end")
        self.desired_improvement_entry.delete(0, "end")

        # Restore placeholder text manually (if needed)
        self.full_name_entry.configure(placeholder_text=full_name_placeholder)
        self.birthdate_entry.configure(placeholder_text=birthdate_placeholder)
        self.phone_entry.configure(placeholder_text=phone_placeholder)
        self.email_entry.configure(placeholder_text=email_placeholder)
        self.address1_entry.configure(placeholder_text=address1_placeholder)
        self.address2_entry.configure(placeholder_text=address2_placeholder)
        self.city_entry.configure(placeholder_text=city_placeholder)
        self.zip_entry.configure(placeholder_text=zip_placeholder)
        self.allergies_entry.configure(placeholder_text=allergies_placeholder)
        self.health_conditions_entry.configure(placeholder_text=health_conditions_placeholder)
        self.medications_entry.configure(placeholder_text=medications_placeholder)
        self.treatment_areas_entry.configure(placeholder_text=treatment_areas_placeholder)
        self.current_products_entry.configure(placeholder_text=current_products_placeholder)
        self.skin_conditions_entry.configure(placeholder_text=skin_conditions_placeholder)
        self.other_notes_entry.configure(placeholder_text=other_notes_placeholder)
        self.desired_improvement_entry.configure(placeholder_text=desired_improvement_placeholder)

        # Reset dropdown menus (ComboBoxes)
        self.gender_entry.set("Select Gender")  # Assuming it should have a default value
        self.state_entry.set("Select State")  # Assuming it should have a default value
        self.referred_by_combobox.set("")  # Reset referred_by search box

    def update_referred_by_suggestions(self, event=None):
        """Update the dropdown suggestions in real-time based on user input."""
        query = self.referred_by_combobox.get().strip()  # Get the current text

        if query:  # Only search if there's input
            self.cursor.execute(
                "SELECT full_name FROM clients WHERE full_name LIKE ? LIMIT 10", (f"%{query}%",)
            )
            matches = [row[0] for row in self.cursor.fetchall()]

            if matches:
                self.referred_by_combobox.configure(values=matches)  # Update values dynamically
            else:
                self.referred_by_combobox.configure(values=["No matches found"])  # Indicate no matches
        else:
            self.referred_by_combobox.configure(values=[])  # Clear suggestions if input is empty

        self.referred_by_combobox.event_generate('<Down>')
        self.referred_by_combobox.focus()  # Ensure the combo box is focused

    def save_client_data(self):
        """Save or update client information in the database."""
        # Collect data from the form
        full_name = self.full_name_entry.get().strip()
        gender = self.gender_entry.get().strip()
        birthdate = self.birthdate_entry.get().strip()
        phone = self.phone_entry.get().strip()
        email = self.email_entry.get().strip()
        address1 = self.address1_entry.get().strip()
        address2 = self.address2_entry.get().strip()
        city = self.city_entry.get().strip()
        state = self.state_entry.get().strip()
        zip = self.zip_entry.get().strip()
        referred_by = self.referred_by_combobox.get().strip()

        # Health Info
        allergies = self.allergies_entry.get().strip()
        health_conditions = self.health_conditions_entry.get().strip()
        medications = self.medications_entry.get().strip()
        treatment_areas = self.treatment_areas_entry.get().strip()
        current_products = self.current_products_entry.get().strip()
        skin_conditions = self.skin_conditions_entry.get().strip()
        other_notes = self.other_notes_entry.get().strip()
        desired_improvement = self.desired_improvement_entry.get().strip()

        # Ensure a full name is provided
        if not full_name.strip():  
            print("Error: Full Name is required!")
            return

        try:
            if self.client_id:  # Update existing client
                self.cursor.execute("""
                    UPDATE clients 
                    SET full_name = ?, gender = ?, birthdate = ?, phone = ?, email = ?, 
                        address1 = ?, address2 = ?, city = ?, state = ?, zip = ?, referred_by = ? 
                    WHERE id = ?
                """, (full_name, gender, birthdate, phone, email, address1, address2, city, state, zip, referred_by, self.client_id))

                # Check if health info already exists
                self.cursor.execute("SELECT COUNT(*) FROM client_health_info WHERE client_id = ?", (self.client_id,))
                health_info_exists = self.cursor.fetchone()[0]

                if health_info_exists:
                    self.cursor.execute("""
                        UPDATE client_health_info 
                        SET allergies = ?, health_conditions = ?, medications = ?, treatment_areas = ?, 
                            current_products = ?, skin_conditions = ?, other_notes = ?, desired_improvement = ? 
                        WHERE client_id = ?
                    """, (allergies, health_conditions, medications, treatment_areas, current_products, skin_conditions, other_notes, desired_improvement, self.client_id))
                else:
                    self.cursor.execute("""
                        INSERT INTO client_health_info (client_id, allergies, health_conditions, medications, treatment_areas, 
                            current_products, skin_conditions, other_notes, desired_improvement) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (self.client_id, allergies, health_conditions, medications, treatment_areas, current_products, skin_conditions, other_notes, desired_improvement))

                print(f"Client '{full_name}' updated successfully.")

            else:  # Insert a new client
                self.cursor.execute("""
                    INSERT INTO clients (full_name, gender, birthdate, phone, email, address1, address2, city, state, zip, referred_by) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (full_name, gender, birthdate, phone, email, address1, address2, city, state, zip, referred_by))
                
                # Get the newly inserted client_id
                self.client_id = self.cursor.lastrowid

                # Insert health information
                self.cursor.execute("""
                    INSERT INTO client_health_info (client_id, allergies, health_conditions, medications, treatment_areas, 
                        current_products, skin_conditions, other_notes, desired_improvement) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (self.client_id, allergies, health_conditions, medications, treatment_areas, current_products, skin_conditions, other_notes, desired_improvement))

                print(f"New client '{full_name}' added successfully.")

            # Commit all changes after updates or inserts
            self.conn.commit()

        except Exception as e:
            print(f"Database error: {e}")
