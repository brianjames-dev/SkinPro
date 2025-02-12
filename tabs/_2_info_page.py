import customtkinter as ctk
from tkinter import ttk

"""
Form Layout:
"Client Consultation Information"
-------------------------------------------------------------------------------------------
"Full Name"            -> Entry Box || "Gender"  -> Combobox  || "Birthdate"   -> Entry Box
"Address 1"            -> Entry Box
"Address 2 (optional)" -> Entry Box
"City"                 -> Entry Box || "State"   -> Combobox  || "Zip"         -> Entry Box
"Email"                -> Entry Box || "Phone #" -> Entry Box || "Referred by" -> Entry Box
-------------------------------------------------------------------------------------------
"Allergies"            -> Entry Box
"Health Conditions"    -> Entry Box
"Medications"          -> Entry Box
"Area to be Treated"   -> Entry Box
"Current Product Use"  -> Entry Box
"Skin Conditions"      -> Entry Box
-----------------------------------
"Other Notes"          -> Entry Box
"Desired Improvement"  -> Entry Box
"""

class InfoPage:
    def __init__(self, parent, conn):
        self.conn = conn
        self.cursor = conn.cursor()
        
        # Header
        header = ctk.CTkLabel(parent, text="Client Consultation Information", font=("Arial", 20), anchor="w")
        header.pack(fill="both", padx=15, pady=10)

        # Create a frame to hold all input fields
        form_frame = ctk.CTkFrame(parent)
        form_frame.pack(fill="both", expand=True, padx=10, pady=10)
        form_frame.columnconfigure(0, weight=0)
        form_frame.columnconfigure(1, weight=1)

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
        self.full_name_entry = ctk.CTkEntry(name_frame, border_width=0, placeholder_text="Enter full name (e.g., John Doe)")
        self.full_name_entry.grid(row=0, column=0, sticky="ew")

        ctk.CTkLabel(name_frame, text="Gender").grid(row=0, column=1, sticky="w", padx=(20, 5))
        self.gender_entry = ctk.CTkComboBox(name_frame, values=["Female", "Male"], border_width=0)
        self.gender_entry.grid(row=0, column=2, sticky="ew")

        ctk.CTkLabel(name_frame, text="Birthdate").grid(row=0, column=3, sticky="w", padx=(20, 5))
        self.birthdate_entry = ctk.CTkEntry(name_frame, border_width=0, placeholder_text="MM/DD/YYYY")
        self.birthdate_entry.grid(row=0, column=4, sticky="ew")

        # Row 2: Address 1
        ctk.CTkLabel(form_frame, text="Address 1").grid(row=1, column=0, sticky="w", padx=5, pady=5)
        self.address1_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text="Enter street address (e.g., 123 Main St.)")
        self.address1_entry.grid(row=1, column=1, padx=5, pady=5, sticky="ew")

        # Row 3: Address 2
        ctk.CTkLabel(form_frame, text="Address 2").grid(row=2, column=0, sticky="w", padx=5, pady=5)
        self.address2_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text="(optional)")
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
        self.city_entry = ctk.CTkEntry(address_tri_frame, border_width=0, placeholder_text="e.g., Santa Rosa")
        self.city_entry.grid(row=3, column=0, sticky="ew")

        ctk.CTkLabel(address_tri_frame, text="State").grid(row=3, column=1, sticky="w", padx=(20, 5))
        self.state_entry = ctk.CTkComboBox(address_tri_frame, border_width=0,
                                           values=["California", "Alabama", "Alaska", "Arizona", "Arkansas", "Colorado", 
                                                                      "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", 
                                                                      "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", 
                                                                      "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", 
                                                                      "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", 
                                                                      "New Hampshire", "New Jersey", "New Mexico", "New York", 
                                                                      "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", 
                                                                      "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", 
                                                                      "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", 
                                                                      "West Virginia", "Wisconsin", "Wyoming"])
        self.state_entry.grid(row=3, column=2, sticky="ew")

        ctk.CTkLabel(address_tri_frame, text="Zip").grid(row=3, column=3, sticky="w", padx=(20, 5))
        self.zip_entry = ctk.CTkEntry(address_tri_frame, border_width=0, placeholder_text="e.g., 95404")
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
        self.email_entry = ctk.CTkEntry(contacts_tri_frame, border_width=0, placeholder_text="john.doe@example.com")
        self.email_entry.grid(row=4, column=0, sticky="ew")
       
        ctk.CTkLabel(contacts_tri_frame, text="Phone #").grid(row=4, column=1, sticky="w", padx=(20, 5))
        self.phone_entry = ctk.CTkEntry(contacts_tri_frame, border_width=0, placeholder_text="e.g., 555-123-4567")
        self.phone_entry.grid(row=4, column=2, sticky="ew")

        ctk.CTkLabel(contacts_tri_frame, text="Referred by").grid(row=4, column=3, sticky="w", padx=(20, 5))
        self.referred_by_entry = ctk.CTkEntry(contacts_tri_frame, border_width=0, placeholder_text="(optional)")
        self.referred_by_entry.grid(row=4, column=4, sticky="ew")

        # Separator
        separator = ttk.Separator(form_frame, orient="horizontal")
        separator.grid(row=5, column=0, columnspan=2, sticky="ew", padx=5, pady=10)

        # Row 6: Allergies
        ctk.CTkLabel(form_frame, text="Allergies").grid(row=6, column=0, sticky="w", padx=5, pady=5)
        self.allergies_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text="List any known allergies (e.g., nuts, latex)")
        self.allergies_entry.grid(row=6, column=1, padx=5, pady=5, sticky="ew")

        # Row 7: Health Conditions
        ctk.CTkLabel(form_frame, text="Health Conditions").grid(row=7, column=0, sticky="w", padx=5, pady=5)
        self.health_conditions_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text="List known health conditions (e.g., diabetes, asthma)")
        self.health_conditions_entry.grid(row=7, column=1, padx=5, pady=5, sticky="ew")

        # Row 8: Medications
        ctk.CTkLabel(form_frame, text="Medications").grid(row=8, column=0, sticky="w", padx=5, pady=5)
        self.medications_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text="List current medications (e.g., Ibuprofen)")
        self.medications_entry.grid(row=8, column=1, padx=5, pady=5, sticky="ew")

        # Row 9: Area to be Treated
        ctk.CTkLabel(form_frame, text="Area to be Treated").grid(row=9, column=0, sticky="w", padx=5, pady=5)
        self.treatment_areas_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text="List desired treatment area(s) (e.g., face, legs)")
        self.treatment_areas_entry.grid(row=9, column=1, padx=5, pady=5, sticky="ew")

        # Row 10: Current Product Use
        ctk.CTkLabel(form_frame, text="Current Product Use").grid(row=10, column=0, sticky="w", padx=5, pady=5)
        self.current_products_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text="List skincare products used (e.g., cleanser, moisturizer)")
        self.current_products_entry.grid(row=10, column=1, padx=5, pady=5, sticky="ew")

        # Row 11: Skin Conditions
        ctk.CTkLabel(form_frame, text="Skin Conditions").grid(row=11, column=0, sticky="w", padx=5, pady=5)
        self.skin_conditions_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text="Describe skin conditions (e.g., acne, rosacea)")
        self.skin_conditions_entry.grid(row=11, column=1, padx=5, pady=5, sticky="ew")

        # Separator
        separator = ttk.Separator(form_frame, orient="horizontal")
        separator.grid(row=12, column=0, columnspan=2, sticky="ew", padx=5, pady=10)

        # Row 12: Other Notes
        ctk.CTkLabel(form_frame, text="Other Notes").grid(row=13, column=0, sticky="w", padx=5, pady=5)
        self.other_notes_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text="Add any relevant notes (Optional)")
        self.other_notes_entry.grid(row=13, column=1, padx=5, pady=5, sticky="ew")

        # Row 13: Desired Improvement
        ctk.CTkLabel(form_frame, text="Desired Improvement").grid(row=14, column=0, sticky="w", padx=5, pady=5)
        self.desired_improvement_entry = ctk.CTkEntry(form_frame, border_width=0, placeholder_text="What improvement is the client seeking?")
        self.desired_improvement_entry.grid(row=14, column=1, padx=5, pady=5, sticky="ew")

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
                state, zip_code, phone, email
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
            self.zip_entry.insert(0, zip_code)

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
        self.referred_by_entry.delete(0, "end")
        self.allergies_entry.delete(0, "end")
        self.health_conditions_entry.delete(0, "end")
        self.medications_entry.delete(0, "end")
        self.treatment_areas_entry.delete(0, "end")
        self.current_products_entry.delete(0, "end")
        self.skin_conditions_entry.delete(0, "end")
        self.other_notes_entry.delete(0, "end")
        self.desired_improvement_entry.delete(0, "end")

