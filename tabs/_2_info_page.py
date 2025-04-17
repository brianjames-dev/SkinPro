import customtkinter as ctk
from tkinter import ttk
from class_elements.profile_card import ProfileCard
import os
import re
from datetime import datetime
from utils.path_utils import resource_path


# Placeholder text phrases
full_name_placeholder           = "Enter full name (e.g., John Doe)"
birthdate_placeholder           = "MM/DD/YYYY"
address1_placeholder            = "Enter street address (e.g., 123 Main St.)"
address2_placeholder            = "(optional)"
city_placeholder                = "e.g., Santa Rosa"
zip_placeholder                 = ""
email_placeholder               = "john.doe@example.com"
primary_placeholder             = "e.g., 555-123-4567"
secondary_placeholder           = "e.g., 707-555-1234"
allergies_placeholder           = "List any known allergies (e.g., nuts, latex)"
health_conditions_placeholder   = "List known health conditions (e.g., diabetes, asthma)"
health_risks_placeholder        = "List known health rists (e.g., )"
medications_placeholder         = "List current medications (e.g., Ibuprofen)"
treatment_areas_placeholder     = "List desired treatment area(s) (e.g., face, legs)"
current_products_placeholder    = "List skincare products used (e.g., cleanser, moisturizer)"
skin_conditions_placeholder     = "Describe skin conditions (e.g., acne, rosacea)"
other_notes_placeholder         = "Add any relevant notes (Optional)"
desired_improvement_placeholder = "What improvement is the client seeking?"

class InfoPage:
    def __init__(self, parent, conn, main_app):
        self.conn = conn
        self.cursor = conn.cursor()
        self.main_app = main_app
        self.client_id = None

        # Create a frame to hold all input fields
        form_frame = ctk.CTkFrame(parent)
        form_frame.pack(fill="both", expand=True, padx=10, pady=10)
        form_frame.columnconfigure(0, weight=0)
        form_frame.columnconfigure(1, weight=1)

        # Frame for Full Name (entry), Gender, Birthdate
        name_frame = ctk.CTkFrame(form_frame)
        name_frame.grid(row=0, column=1, sticky="ew", padx=5, pady=5)
        name_frame.columnconfigure(0, weight=0)  # Full Name entry box
        name_frame.columnconfigure(1, weight=0)  # Gender label
        name_frame.columnconfigure(2, weight=0)  # Gender combo box
        name_frame.columnconfigure(3, weight=0)  # Birthdate label
        name_frame.columnconfigure(4, weight=1)  # Birthdate entry box

        # Fram for Address 1, Address 2
        address_frame = ctk.CTkFrame(form_frame)
        address_frame.grid(row=1, column=1, sticky="ew", padx=5, pady=5)
        address_frame.columnconfigure(0, weight=0)  # Address 1 entry box
        address_frame.columnconfigure(1, weight=0)  # Address 2 label
        address_frame.columnconfigure(2, weight=1)  # Address 2 entry box

        # Define tracking variables
        self.gender_var = ctk.StringVar()
        self.state_var = ctk.StringVar()
        self.referred_var = ctk.StringVar()

        # Attach tracking function
        self.setup_combobox_tracking()

        # Row 1: Full Name, Gender, Birthdate
        ctk.CTkLabel(form_frame, text="Full Name").grid(row=0, column=0, sticky="w", padx=5, pady=5)
        self.full_name_entry = ctk.CTkEntry(name_frame, placeholder_text=full_name_placeholder, width=293)
        self.full_name_entry.grid(row=0, column=0, sticky="ew")

        ctk.CTkLabel(name_frame, text="Gender").grid(row=0, column=1, sticky="w", padx=(20, 5))
        self.gender_entry = ctk.CTkComboBox(name_frame, values=["Female", "Male"], width=120)
        self.gender_entry.grid(row=0, column=2, sticky="ew")
        self.gender_entry.configure(variable=self.gender_var, text_color="#797e82")
        self.gender_entry.set("Select Gender")  # Assuming it should have a default value

        ctk.CTkLabel(name_frame, text="Birthdate").grid(row=0, column=3, sticky="w", padx=(20, 25))
        self.birthdate_entry = ctk.CTkEntry(name_frame, placeholder_text=birthdate_placeholder)
        self.birthdate_entry.grid(row=0, column=4, sticky="ew")

        # Row 2: Address 1
        ctk.CTkLabel(form_frame, text="Address 1").grid(row=1, column=0, sticky="w", padx=5, pady=5)
        self.address1_entry = ctk.CTkEntry(address_frame, placeholder_text=address1_placeholder, width=479)
        self.address1_entry.grid(row=0, column=0, sticky="ew")

        # Row 3: Address 2
        ctk.CTkLabel(address_frame, text="Address 2").grid(row=0, column=1, sticky="w", padx=(20, 18))
        self.address2_entry = ctk.CTkEntry(address_frame, placeholder_text=address2_placeholder)
        self.address2_entry.grid(row=0, column=2, sticky="ew")

        # Frame for City, State, Zip, Referred by
        address_tri_frame = ctk.CTkFrame(form_frame)
        address_tri_frame.grid(row=3, column=1, sticky="ew", padx=5, pady=5)
        address_tri_frame.columnconfigure((0, 1, 2, 3, 4, 5), weight=0)  # We'll use explicit widths
        address_tri_frame.columnconfigure(6, weight=1)  # Referred by entry box

        # Row 4: City, State, Zip, Referred by
        ctk.CTkLabel(form_frame, text="City").grid(row=3, column=0, sticky="w", padx=5, pady=5)
        self.city_entry = ctk.CTkEntry(address_tri_frame, placeholder_text=city_placeholder, width=242)
        self.city_entry.grid(row=3, column=0, sticky="w")

        ctk.CTkLabel(address_tri_frame, text="State").grid(row=3, column=1, sticky="w", padx=(20, 29))
        self.state_entry = ctk.CTkComboBox(address_tri_frame, 
                                           values=["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", 
                                                   "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", 
                                                   "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", 
                                                   "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", 
                                                   "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"],
                                           width=60)
        self.state_entry.grid(row=3, column=2, sticky="w")
        self.state_entry.configure(variable=self.state_var, text_color="#797e82")
        self.state_entry.set("")

        ctk.CTkLabel(address_tri_frame, text="Zip").grid(row=3, column=3, sticky="w", padx=(20, 5))
        self.zip_entry = ctk.CTkEntry(address_tri_frame, placeholder_text=zip_placeholder, width=58)
        self.zip_entry.grid(row=3, column=4, sticky="w")

        ctk.CTkLabel(address_tri_frame, text="Referred by").grid(row=3, column=5, sticky="w", padx=(20, 11))
        self.referred_by_combobox = ctk.CTkComboBox(address_tri_frame, values=[], width=200)
        self.referred_by_combobox.grid(row=3, column=6, sticky="ew")
        self.referred_by_combobox.configure(text_color="#797e82")
        self.referred_by_combobox.set("Referred by...")
        self.referred_by_combobox.bind("<KeyRelease>", lambda event: self.update_referred_by_suggestions())
        self.referred_by_combobox.bind("<FocusIn>", self.clear_referred_placeholder)
        self.referred_by_combobox.bind("<FocusOut>", self.restore_referred_placeholder)

        # Frame for Email, Primary/Secondary Phone #'s
        contacts_tri_frame = ctk.CTkFrame(form_frame)
        contacts_tri_frame.grid(row=4, column=1, sticky="ew", padx=5, pady=5)
        contacts_tri_frame.columnconfigure(0, weight=0)  # Email entry box
        contacts_tri_frame.columnconfigure(1, weight=0)  # Primary label
        contacts_tri_frame.columnconfigure(2, weight=0)  # Primary entry box
        contacts_tri_frame.columnconfigure(3, weight=0)  # Secondary label
        contacts_tri_frame.columnconfigure(4, weight=1)  # Secondary entry box

        # Row 5: Email, Primary/Secondary Phone #'s
        ctk.CTkLabel(form_frame, text="Email").grid(row=4, column=0, sticky="w", padx=5, pady=5)
        self.email_entry = ctk.CTkEntry(contacts_tri_frame, placeholder_text=email_placeholder, width=242)
        self.email_entry.grid(row=4, column=0, sticky="ew")
       
        ctk.CTkLabel(contacts_tri_frame, text="Primary #").grid(row=4, column=1, sticky="w", padx=(20, 5))
        self.primary_entry = ctk.CTkEntry(contacts_tri_frame, placeholder_text=primary_placeholder, width=160)
        self.primary_entry.grid(row=4, column=2, sticky="ew")

        ctk.CTkLabel(contacts_tri_frame, text="Secondary #").grid(row=4, column=3, sticky="w", padx=(20, 6))
        self.secondary_entry = ctk.CTkEntry(contacts_tri_frame, placeholder_text=secondary_placeholder)
        self.secondary_entry.grid(row=4, column=4, sticky="ew")

        # Separator
        separator = ttk.Separator(form_frame, orient="horizontal")
        separator.grid(row=5, column=0, columnspan=2, sticky="ew", padx=5, pady=10)

        # Row 6: Allergies
        ctk.CTkLabel(form_frame, text="Allergies").grid(row=6, column=0, sticky="w", padx=5, pady=5)
        self.allergies_entry = ctk.CTkEntry(form_frame, placeholder_text=allergies_placeholder)
        self.allergies_entry.grid(row=6, column=1, padx=5, pady=5, sticky="ew")

        # Row 7: Health Conditions
        ctk.CTkLabel(form_frame, text="Health Conditions").grid(row=7, column=0, sticky="w", padx=5, pady=5)
        self.health_conditions_entry = ctk.CTkEntry(form_frame, placeholder_text=health_conditions_placeholder)
        self.health_conditions_entry.grid(row=7, column=1, padx=5, pady=5, sticky="ew")

        # Row 8: Health Risks
        ctk.CTkLabel(form_frame, text="Health Risks").grid(row=8, column=0, sticky="w", padx=5, pady=5)
        self.health_risks_entry = ctk.CTkEntry(form_frame, placeholder_text=health_risks_placeholder, fg_color="#FFF536")
        self.health_risks_entry.grid(row=8, column=1, padx=5, pady=5, sticky="ew")

        # Row 9: Medications
        ctk.CTkLabel(form_frame, text="Medications").grid(row=9, column=0, sticky="w", padx=5, pady=5)
        self.medications_entry = ctk.CTkEntry(form_frame, placeholder_text=medications_placeholder)
        self.medications_entry.grid(row=9, column=1, padx=5, pady=5, sticky="ew")

        # Row 10: Area to be Treated
        ctk.CTkLabel(form_frame, text="Area to be Treated").grid(row=10, column=0, sticky="w", padx=5, pady=5)
        self.treatment_areas_entry = ctk.CTkEntry(form_frame, placeholder_text=treatment_areas_placeholder)
        self.treatment_areas_entry.grid(row=10, column=1, padx=5, pady=5, sticky="ew")

        # Row 11: Current Product Use
        ctk.CTkLabel(form_frame, text="Current Product Use").grid(row=11, column=0, sticky="w", padx=5, pady=5)
        self.current_products_entry = ctk.CTkEntry(form_frame, placeholder_text=current_products_placeholder)
        self.current_products_entry.grid(row=11, column=1, padx=5, pady=5, sticky="ew")

        # Row 12: Skin Conditions
        ctk.CTkLabel(form_frame, text="Skin Conditions").grid(row=12, column=0, sticky="w", padx=5, pady=5)
        self.skin_conditions_entry = ctk.CTkEntry(form_frame, placeholder_text=skin_conditions_placeholder)
        self.skin_conditions_entry.grid(row=12, column=1, padx=5, pady=5, sticky="ew")

        # Row 13: Separator
        separator = ttk.Separator(form_frame, orient="horizontal")
        separator.grid(row=13, column=0, columnspan=2, sticky="ew", padx=5, pady=10)

        # Row 14: Other Notes
        ctk.CTkLabel(form_frame, text="Other Notes").grid(row=14, column=0, sticky="w", padx=5, pady=5)
        self.other_notes_entry = ctk.CTkEntry(form_frame, placeholder_text=other_notes_placeholder)
        self.other_notes_entry.grid(row=14, column=1, padx=5, pady=5, sticky="ew")

        # Row 15: Desired Improvement + Save
        final_frame = ctk.CTkFrame(form_frame, fg_color="transparent")
        final_frame.grid(row=15, column=0, columnspan=2, sticky="ew", pady=5)

        final_frame.columnconfigure(1, weight=1)  # Entry box will now expand

        ctk.CTkLabel(final_frame, text="Desired Improvement").grid(row=0, column=0, sticky="w", padx=5, pady=5)

        self.desired_improvement_entry = ctk.CTkEntry(final_frame, placeholder_text=desired_improvement_placeholder)
        self.desired_improvement_entry.grid(row=0, column=1, padx=5, pady=5, sticky="ew")  # Ensure it expands

        self.save_button = ctk.CTkButton(
            final_frame, text="Save",
            command=self.save_client_data,
            fg_color="#696969",
            text_color="#ebebeb",
            state="disabled"
        )
        self.save_button.grid(row=0, column=2, padx=5, pady=5, sticky="ne")

        # Bind tracing to handle both save button enabling & text color updates
        self.gender_var.trace_add("write", lambda *args: self.handle_combobox_change(self.gender_entry))
        self.state_var.trace_add("write", lambda *args: self.handle_combobox_change(self.state_entry))
        self.referred_var.trace_add("write", lambda *args: self.handle_combobox_change(self.referred_by_combobox))

        # Mimic Tab behavior for all entry fields
        self.full_name_entry.          bind("<Return>", lambda event: self.focus_next_widget(event))
        self.gender_entry.             bind("<Return>", lambda event: self.focus_next_widget(event))
        self.birthdate_entry.          bind("<Return>", lambda event: (self.format_birthdate(), self.focus_next_widget(event)))
        self.birthdate_entry.          bind("<FocusOut>", lambda event: self.format_birthdate())
        self.address1_entry.           bind("<Return>", lambda event: self.focus_next_widget(event))
        self.address2_entry.           bind("<Return>", lambda event: self.focus_next_widget(event))
        self.city_entry.               bind("<Return>", lambda event: self.focus_next_widget(event))
        self.state_entry.              bind("<Return>", lambda event: self.focus_next_widget(event))
        self.zip_entry.                bind("<Return>", lambda event: self.focus_next_widget(event))
        self.primary_entry.            bind("<Return>", lambda event: self.focus_next_widget(event))
        self.primary_entry.            bind("<FocusOut>", lambda event: self.format_phone_number(event))
        self.secondary_entry.          bind("<Return>", lambda event: self.focus_next_widget(event))
        self.secondary_entry.          bind("<FocusOut>", lambda event: self.format_phone_number(event))
        self.email_entry.              bind("<Return>", lambda event: self.focus_next_widget(event))
        self.referred_by_combobox.     bind("<Return>", lambda event: self.focus_next_widget(event))
        self.allergies_entry.          bind("<Return>", lambda event: self.focus_next_widget(event))
        self.health_conditions_entry.  bind("<Return>", lambda event: self.focus_next_widget(event))
        self.health_risks_entry.       bind("<Return>", lambda event: self.focus_next_widget(event))
        self.medications_entry.        bind("<Return>", lambda event: self.focus_next_widget(event))
        self.treatment_areas_entry.    bind("<Return>", lambda event: self.focus_next_widget(event))
        self.current_products_entry.   bind("<Return>", lambda event: self.focus_next_widget(event))
        self.skin_conditions_entry.    bind("<Return>", lambda event: self.focus_next_widget(event))
        self.other_notes_entry.        bind("<Return>", lambda event: self.focus_next_widget(event))
        self.desired_improvement_entry.bind("<Return>", lambda event: self.focus_next_widget(event))

        # Enable Save button when any entry is changed
        self.full_name_entry.bind("<KeyRelease>", self.enable_save_button)
        self.gender_entry.bind("<<ComboboxSelected>>", self.enable_save_button)
        self.birthdate_entry.bind("<KeyRelease>", self.enable_save_button)
        self.primary_entry.bind("<KeyRelease>", self.enable_save_button)
        self.secondary_entry.bind("<KeyRelease>", self.enable_save_button)
        self.email_entry.bind("<KeyRelease>", self.enable_save_button)
        self.address1_entry.bind("<KeyRelease>", self.enable_save_button)
        self.address2_entry.bind("<KeyRelease>", self.enable_save_button)
        self.city_entry.bind("<KeyRelease>", self.enable_save_button)
        self.state_entry.bind("<<ComboboxSelected>>", self.enable_save_button)
        self.zip_entry.bind("<KeyRelease>", self.enable_save_button)
        self.referred_by_combobox.bind("<<ComboboxSelected>>", self.enable_save_button)
        self.allergies_entry.bind("<KeyRelease>", self.enable_save_button)
        self.health_conditions_entry.bind("<KeyRelease>", self.enable_save_button)
        self.health_risks_entry.bind("<KeyRelease>", self.enable_save_button)
        self.medications_entry.bind("<KeyRelease>", self.enable_save_button)
        self.treatment_areas_entry.bind("<KeyRelease>", self.enable_save_button)
        self.current_products_entry.bind("<KeyRelease>", self.enable_save_button)
        self.skin_conditions_entry.bind("<KeyRelease>", self.enable_save_button)
        self.other_notes_entry.bind("<KeyRelease>", self.enable_save_button)
        self.desired_improvement_entry.bind("<KeyRelease>", self.enable_save_button)

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

        # Step 1: Remove Existing Traces
        try:
            if self.gender_var.trace_info():
                self.gender_var.trace_remove("write", self.gender_var.trace_info()[0][1])
            if self.state_var.trace_info():
                self.state_var.trace_remove("write", self.state_var.trace_info()[0][1])
            if self.referred_var.trace_info():
                self.referred_var.trace_remove("write", self.referred_var.trace_info()[0][1])
        except IndexError:
            pass  # In case no trace exists yet  

        # Fetch general client information
        self.cursor.execute("""
            SELECT 
                full_name, gender, birthdate, 
                address1, address2, city, 
                state, zip, primary_phone, secondary_phone, email, referred_by
            FROM clients 
            WHERE id = ?
        """, (client_id,))
        client_result = self.cursor.fetchone()

        # Fetch health-related client information
        self.cursor.execute("""
            SELECT 
                allergies, health_conditions, health_risks, medications, 
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
                state, zip, primary, secondary, email, referred_by
            ) = client_result            

            # Populate general client fields
            self.full_name_entry.delete(0, "end")
            if full_name:
                self.full_name_entry.insert(0, full_name)
            else:
                self.full_name_entry.configure(placeholder_text=full_name_placeholder)

            self.gender_entry.set(gender if gender else "Select Gender")
            self.gender_entry.configure(text_color="#000000" if gender else "#797e82")

            self.birthdate_entry.delete(0, "end")
            if birthdate:
                self.birthdate_entry.insert(0, birthdate)
            else:
                self.birthdate_entry.configure(placeholder_text=birthdate_placeholder)

            self.address1_entry.delete(0, "end")
            if address1:
                self.address1_entry.insert(0, address1)
            else:
                self.address1_entry.configure(placeholder_text=address1_placeholder)

            self.address2_entry.delete(0, "end")
            if address2:
                self.address2_entry.insert(0, address2)
            else:
                self.address2_entry.configure(placeholder_text=address2_placeholder)

            self.city_entry.delete(0, "end")
            if city:
                self.city_entry.insert(0, city)
            else:
                self.city_entry.configure(placeholder_text=city_placeholder)

            self.state_entry.set(state if state else "")
            self.state_entry.configure(text_color="#000000" if state else "#797e82")

            self.zip_entry.delete(0, "end")
            if zip:
                self.zip_entry.insert(0, zip)
            else:
                self.zip_entry.configure(placeholder_text=zip_placeholder)

            self.primary_entry.delete(0, "end")
            if primary:
                self.primary_entry.insert(0, primary)
            else:
                self.primary_entry.configure(placeholder_text=primary_placeholder)

            self.secondary_entry.delete(0, "end")
            if secondary:
                self.secondary_entry.insert(0, secondary)
            else:
                self.secondary_entry.configure(placeholder_text=secondary_placeholder)

            self.email_entry.delete(0, "end")
            if email:
                self.email_entry.insert(0, email)
            else:
                self.email_entry.configure(placeholder_text=email_placeholder)

            if referred_by:
                self.referred_by_combobox.set(referred_by)
                self.referred_by_combobox.configure(text_color="#000000")
            else:
                self.referred_by_combobox.set("Referred by...")
                self.referred_by_combobox.configure(text_color="#797e82")
                
        if health_result:
            (
                allergies, health_conditions, health_risks, medications, 
                treatment_areas, current_products, skin_conditions, 
                other_notes, desired_improvement
            ) = health_result

            # Populate health-related fields
            self.allergies_entry.delete(0, "end")
            if allergies:
                self.allergies_entry.insert(0, allergies)
            else:
                self.allergies_entry.configure(placeholder_text=allergies_placeholder)

            self.health_conditions_entry.delete(0, "end")
            if health_conditions:
                self.health_conditions_entry.insert(0, health_conditions)
            else:
                self.health_conditions_entry.configure(placeholder_text=health_conditions_placeholder)

            self.health_risks_entry.delete(0, "end")
            if health_risks:
                self.health_risks_entry.insert(0, health_risks)
            else:
                self.health_risks_entry.configure(placeholder_text=health_risks_placeholder)

            self.medications_entry.delete(0, "end")
            if medications:
                self.medications_entry.insert(0, medications)
            else:
                self.medications_entry.configure(placeholder_text=medications_placeholder)

            self.treatment_areas_entry.delete(0, "end")
            if treatment_areas:
                self.treatment_areas_entry.insert(0, treatment_areas)
            else:
                self.treatment_areas_entry.configure(placeholder_text=treatment_areas_placeholder)

            self.current_products_entry.delete(0, "end")
            if current_products:
                self.current_products_entry.insert(0, current_products)
            else:
                self.current_products_entry.configure(placeholder_text=current_products_placeholder)

            self.skin_conditions_entry.delete(0, "end")
            if skin_conditions:
                self.skin_conditions_entry.insert(0, skin_conditions)
            else:
                self.skin_conditions_entry.configure(placeholder_text=skin_conditions_placeholder)

            self.other_notes_entry.delete(0, "end")
            if other_notes:
                self.other_notes_entry.insert(0, other_notes)
            else:
                self.other_notes_entry.configure(placeholder_text=other_notes_placeholder)

            self.desired_improvement_entry.delete(0, "end")
            if desired_improvement:
                self.desired_improvement_entry.insert(0, desired_improvement)
            else:
                self.desired_improvement_entry.configure(placeholder_text=desired_improvement_placeholder)
        
            # Step 3: Set Combobox Values (Without Triggering Save Button)
            self.gender_var.set(gender if gender else "Select Gender")
            self.state_var.set(state if state else "Select State")
            # self.referred_var.set(referred if referred_by else "Unknown")

        # Step 4: Manually Reattach Tracing (Fix for Traces Not Triggering)
        self.gender_var.trace_add("write", lambda *args: self.handle_combobox_change(self.gender_entry))
        self.state_var.trace_add("write", lambda *args: self.handle_combobox_change(self.state_entry))
        self.referred_var.trace_add("write", lambda *args: self.handle_combobox_change(self.referred_by_combobox))

        # Step 5: Disable Save Button (No edits have been made yet)
        self.save_button.configure(state="disabled", text="Save", fg_color="#696969")

    def clear_info(self):
        """Clear all fields in the Info tab."""
        self.client_id = None  # Reset client_id
        
        self.full_name_entry.delete(0, "end")
        self.gender_entry.set("")
        self.birthdate_entry.delete(0, "end")
        self.primary_entry.delete(0, "end")
        self.secondary_entry.delete(0, "end")
        self.email_entry.delete(0, "end")
        self.address1_entry.delete(0, "end")
        self.address2_entry.delete(0, "end")
        self.city_entry.delete(0, "end")
        self.state_entry.set("")
        self.zip_entry.delete(0, "end")
        self.referred_by_combobox.set("")
        self.allergies_entry.delete(0, "end")
        self.health_conditions_entry.delete(0, "end")
        self.health_risks_entry.delete(0, "end")
        self.medications_entry.delete(0, "end")
        self.treatment_areas_entry.delete(0, "end")
        self.current_products_entry.delete(0, "end")
        self.skin_conditions_entry.delete(0, "end")
        self.other_notes_entry.delete(0, "end")
        self.desired_improvement_entry.delete(0, "end")

        # Restore placeholder text manually (if needed)
        self.full_name_entry.configure(placeholder_text=full_name_placeholder)
        self.birthdate_entry.configure(placeholder_text=birthdate_placeholder)
        self.primary_entry.configure(placeholder_text=primary_placeholder)
        self.secondary_entry.configure(placeholder_text=secondary_placeholder)
        self.email_entry.configure(placeholder_text=email_placeholder)
        self.address1_entry.configure(placeholder_text=address1_placeholder)
        self.address2_entry.configure(placeholder_text=address2_placeholder)
        self.city_entry.configure(placeholder_text=city_placeholder)
        self.zip_entry.configure(placeholder_text=zip_placeholder)
        self.allergies_entry.configure(placeholder_text=allergies_placeholder)
        self.health_conditions_entry.configure(placeholder_text=health_conditions_placeholder)
        self.health_risks_entry.configure(placeholder_text=health_risks_placeholder)
        self.medications_entry.configure(placeholder_text=medications_placeholder)
        self.treatment_areas_entry.configure(placeholder_text=treatment_areas_placeholder)
        self.current_products_entry.configure(placeholder_text=current_products_placeholder)
        self.skin_conditions_entry.configure(placeholder_text=skin_conditions_placeholder)
        self.other_notes_entry.configure(placeholder_text=other_notes_placeholder)
        self.desired_improvement_entry.configure(placeholder_text=desired_improvement_placeholder)

        # Reset dropdown menus (ComboBoxes)
        self.gender_entry.set("Select Gender")  # Assuming it should have a default value
        self.state_entry.set("")  # Assuming it should have a default value
        self.referred_by_combobox.set("Referred by...")  # Reset referred_by search box

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

        self.referred_by_combobox.focus()  # Ensure the combo box is focused

    def setup_combobox_tracking(self):
        """Attach variable tracking to enable the save button when combobox changes."""
        self.gender_var.trace_add("write", lambda *args: self.enable_save_button())
        self.state_var.trace_add("write", lambda *args: self.enable_save_button())
        self.referred_var.trace_add("write", lambda *args: self.enable_save_button())

    def enable_save_button(self, event=None):
        """Enable the save button when an entry is changed."""
        if hasattr(self, "save_button") and self.save_button:
            if self.save_button.cget("state") == "normal":
                return  # Prevent duplicate triggers
    
            print(f"🔄 Save button enabled")  # Debugging output
            self.save_button.configure(state="normal", text="Save", fg_color="#563A9C")  # Re-enable

    def save_client_data(self):
        """Save or update client information in the database."""
        # Step 1: Get client_id from ProfileCard
        if hasattr(self.main_app, "profile_card"):
            self.client_id = self.main_app.profile_card.client_id  # Use the stored client_id

        print(f"\n🔎 DEBUG: Checking client_id before saving: {self.client_id}")

        # Step 2: Collect data from the form
        full_name = self.full_name_entry.get().strip()
        gender = self.gender_entry.get().strip()
        birthdate = self.birthdate_entry.get().strip()
        primary = self.primary_entry.get().strip()
        secondary = self.secondary_entry.get().strip()
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
        health_risks = self.health_risks_entry.get().strip()
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
            if self.client_id == -1:  # If it's a new client
                print(f"🆕 Inserting new client: {full_name}")

                # Insert the new client into the `clients` table
                self.cursor.execute("""
                    INSERT INTO clients (full_name, gender, birthdate, primary_phone, secondary_phone, email, address1, address2, city, state, zip, referred_by) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (full_name, gender, birthdate, primary, secondary, email, address1, address2, city, state, zip, referred_by))

                # Get the newly inserted client_id
                self.client_id = self.cursor.lastrowid
                print(f"🆕 Assigned new client_id: {self.client_id}")

                # Insert new Health Info
                self.cursor.execute("""
                    INSERT INTO client_health_info (client_id, allergies, health_conditions, health_risks, medications, treatment_areas, 
                        current_products, skin_conditions, other_notes, desired_improvement) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (self.client_id, allergies, health_conditions, health_risks, medications, treatment_areas, current_products, skin_conditions, other_notes, desired_improvement))

            else:  # If updating an existing client
                print(f"✏️ Updating client ID: {self.client_id} ({full_name}) in the database...")
                
                # Update client info in the `clients` table
                self.cursor.execute("""
                    UPDATE clients 
                    SET full_name = ?, gender = ?, birthdate = ?, primary_phone = ?, secondary_phone = ?, email = ?, 
                        address1 = ?, address2 = ?, city = ?, state = ?, zip = ?, referred_by = ? 
                    WHERE id = ?
                """, (full_name, gender, birthdate, primary, secondary, email, address1, address2, city, state, zip, referred_by, self.client_id))

                # Check if health info exists for this client
                self.cursor.execute("SELECT COUNT(*) FROM client_health_info WHERE client_id = ?", (self.client_id,))
                health_info_exists = self.cursor.fetchone()[0]

                if health_info_exists:
                    # Update existing Health Info
                    self.cursor.execute("""
                        UPDATE client_health_info 
                        SET allergies = ?, health_conditions = ?, health_risks = ?, medications = ?, treatment_areas = ?, 
                            current_products = ?, skin_conditions = ?, other_notes = ?, desired_improvement = ? 
                        WHERE client_id = ?
                    """, (allergies, health_conditions, health_risks, medications, treatment_areas, current_products, skin_conditions, other_notes, desired_improvement, self.client_id))
                else:
                    # Insert new Health Info (if missing)
                    self.cursor.execute("""
                        INSERT INTO client_health_info (client_id, allergies, health_conditions, health_risks, medications, treatment_areas, 
                            current_products, skin_conditions, other_notes, desired_improvement) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (self.client_id, allergies, health_conditions, health_risks, medications, treatment_areas, current_products, skin_conditions, other_notes, desired_improvement))

            # Step 4: Commit changes
            self.conn.commit()
            print(f"💾 Changes committed to the database.")

            # Step 5: Refresh TreeView in ClientsPage and select the updated/new client
            if hasattr(self.main_app, "tabs") and "Clients" in self.main_app.tabs:
                print("🔄 Refreshing Client List in TreeView...")
                self.main_app.tabs["Clients"].load_clients()  # Reload all clients in TreeView

                # Select and bring the client into view
                self.main_app.tabs["Clients"].client_list.selection_set(str(self.client_id))
                self.main_app.tabs["Clients"].client_list.see(str(self.client_id))  # Jump to selected client
                self.main_app.tabs["Clients"].restore_placeholder()

            # Step 6: Finalize Temporary Profile Picture
            temp_profile_path = "images/clients/temp_profile.png"
            final_profile_path = f"images/clients/{full_name.replace(' ', '_')}.png"

            if os.path.exists(temp_profile_path):
                os.rename(temp_profile_path, final_profile_path)
                print(f"📁 Moved temporary profile picture to {final_profile_path}")

                self.cursor.execute("""
                    UPDATE clients SET profile_picture = ? WHERE id = ?""",
                    (final_profile_path, self.client_id))
                self.conn.commit()

            # Step 6: Refresh ProfileCard Full Name
            if hasattr(self.main_app, "profile_card"):
                print("🔄 Updating ProfileCard Name...")
                self.main_app.profile_card.client_id = self.client_id
                self.main_app.profile_card.full_name = full_name
                self.main_app.profile_card.name_label.configure(text=full_name)

            # Force set self.client_id's in other tabs
            if hasattr(self.main_app, "tabs") and "Appointments" in self.main_app.tabs:
                self.main_app.tabs["Appointments"].client_id = self.client_id
                print(f"✅ Force-set Appointments tab client_id = {self.client_id}")
            
            if hasattr(self.main_app, "tabs") and "Alerts" in self.main_app.tabs:
                self.main_app.tabs["Alerts"].client_id = self.client_id
                print(f"✅ Force-set Alerts tab client_id = {self.client_id}")

            # Step 7: Disable save button and change label after successful save
            self.save_button.configure(state="disabled", text="Saved!", fg_color="#696969", text_color="#ebebeb")

        except Exception as e:
            print(f"❌ Database error: {e}")
        

    def format_birthdate(self, event=None):
        """Format the birthdate entry to MM/DD/YYYY when the user presses Enter or clicks away."""
        raw_date = self.birthdate_entry.get().strip()

        if not raw_date:  # ✅ Keep placeholder if empty
            self.birthdate_entry.delete(0, "end")
            self.birthdate_entry.configure(placeholder_text=birthdate_placeholder)
            return

        # Prevent formatting an already formatted date
        if re.fullmatch(r"\d{2}/\d{2}/\d{4}", raw_date):  
            return  # ✅ Exit early if it's already in MM/DD/YYYY format

        # Remove any non-numeric characters (e.g., dashes, dots, spaces)
        cleaned_date = re.sub(r"\D", "", raw_date)  

        # Convert formats like 12101992 to 12/10/1992
        if len(cleaned_date) == 8:
            formatted_date = f"{cleaned_date[:2]}/{cleaned_date[2:4]}/{cleaned_date[4:]}"
        
        else:
            # Try parsing various formats
            for fmt in ["%m-%d-%Y", "%m.%d.%Y", "%m/%d/%Y"]:
                try:
                    parsed_date = datetime.strptime(raw_date, fmt)
                    formatted_date = parsed_date.strftime("%m/%d/%Y")
                    break  # Exit loop on success
                except ValueError:
                    formatted_date = None  # Keep None if no format matches

            if not formatted_date:
                print("⚠ Invalid date entered. Resetting to placeholder.")
                self.birthdate_entry.delete(0, "end")
                self.birthdate_entry.configure(placeholder_text=birthdate_placeholder)
                return

        # Insert formatted date
        self.birthdate_entry.delete(0, "end")
        self.birthdate_entry.insert(0, formatted_date)
        print(f"✅ Formatted Birthdate: {formatted_date}")
    

    def format_phone_number(self, event=None):
        """Format phone number as (XXX) XXX-XXXX, preserving country code if entered with '+'. 
        If only 7 digits are entered, format as XXX-XXXX.
        """

        widget = event.widget  # The Entry widget that triggered the event
        raw_input = widget.get().strip()

        if not raw_input:
            return  # Don't format if the input is empty

        country_code = ""
        phone_number = raw_input

        # Detect country code only if `+` is present
        if raw_input.startswith("+"):
            match = re.match(r"(\+\d+)\s*(\d+)", raw_input)
            if match:
                country_code = match.group(1)  # Extract country code (e.g., +1, +44, etc.)
                phone_number = match.group(2)  # Extract the rest of the number

        # Remove all non-digit characters (except `+` in the country code)
        digits = re.sub(r"\D", "", phone_number)

        formatted_number = raw_input  # Default to input if no formatting is applied

        # If exactly 7 digits, format as XXX-XXXX
        if len(digits) == 7:
            formatted_number = f"{digits[:3]}-{digits[3:]}"

        # If at least 10 digits, format as (XXX) XXX-XXXX
        elif len(digits) >= 10:
            formatted_number = f"({digits[:3]}) {digits[3:6]}-{digits[6:10]}"

            # If extra digits exist (extensions, etc.), append them
            if len(digits) > 10:
                formatted_number += f" {digits[10:]}"

            # Prepend country code if present
            formatted_number = f"{country_code} {formatted_number}".strip()

        # Prevent triggering reformat on already formatted text
        if widget.get() != formatted_number:
            widget.delete(0, "end")
            widget.insert(0, formatted_number)

        print(f"📞 Formatted Phone Number: {formatted_number}")


    def clear_referred_placeholder(self, event=None):
        """Clear the placeholder text when the user clicks inside the combobox."""
        if self.referred_by_combobox.get() == "Referred by...":
            self.referred_by_combobox.set("")  # Clear placeholder text
            self.referred_by_combobox.configure(text_color="#000000")  # Change to normal text color


    def restore_referred_placeholder(self, event=None):
        """Restore the 'Referred by...' placeholder if no valid selection is made."""
        current_text = self.referred_by_combobox.get().strip()

        if not current_text or current_text == "No matches found":
            self.referred_by_combobox.set("Referred by...")  # Restore placeholder text
            self.referred_by_combobox.configure(text_color="#797e82")  # Restore gray color


    def update_combobox_color(self, widget):
        """Ensure the selected combobox value appears in white text."""
        selected_value = widget.get().strip()

        # Ensure white text when an actual selection is made
        if selected_value and selected_value not in ["Select Gender", "Select State", "Referred by..."]:
            widget.configure(text_color="#000000")  # Make text black


    def handle_combobox_change(self, widget):
        """Update text color and enable save button when a combobox value is selected."""
        self.enable_save_button()  # Enable the save button
        self.update_combobox_color(widget)  # Update text color
