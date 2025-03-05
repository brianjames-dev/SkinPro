import customtkinter as ctk
from tkinter import ttk
from class_elements.profile_card import ProfileCard
from class_elements.treeview_styling import style_treeview
from datetime import datetime
from PIL import Image
import re



class AppointmentsPage:
    def __init__(self, parent, conn, main_app):
        self.conn = conn
        self.cursor = conn.cursor()
        self.main_app = main_app  # Reference to main app (to update ProfileCard & InfoPage)
        self.client_id = None  # Store selected client ID
        self.sort_orders = {}  # Store sort order (ascending/descending) for each column

        # Create Main frame (holds both Treeview and Details frame)
        main_frame = ctk.CTkFrame(parent)
        main_frame.pack(fill="both", expand=True, padx=10)

        # Configure grid columns for proportional sizing
        main_frame.columnconfigure(0, weight=13)  # Treeview frame gets 13/20 the space
        main_frame.columnconfigure(1, weight=7)  # Details frame gets 7/20 of the space
        main_frame.rowconfigure(1, weight=1)  # Allow frames to stretch vertically

        # Create a Frame for the search box + buttons
        search_frame = ctk.CTkFrame(main_frame)
        search_frame.grid(row=0, column=0, columnspan=2, sticky="ew", padx=(0, 308), pady=(0, 10))
        search_frame.columnconfigure(1, weight=0)  # Ensure the combobox expands properly

        # Create search label
        search_label = ctk.CTkLabel(search_frame, text="Select Client:", font=("Arial", 14))
        search_label.grid(row=0, column=0, sticky="w", padx=10)

        # Update the Combobox to Match Styling
        self.client_var = ctk.StringVar(value="Select a client...")
        self.client_combobox = ctk.CTkComboBox(
            search_frame, 
            variable=self.client_var, 
            values=[], 
            command=self.on_client_selected, 
            width=200,
            border_width=0
        )
        self.client_combobox.grid(row=0, column=1, sticky="ew", padx=2, pady=2)  # Stretch across grid
        self.client_combobox.configure(text_color="#9a9a99")

        # Keybinds for combobox functionality
        self.client_combobox.bind("<KeyRelease>", self.filter_clients)
        self.client_combobox.bind("<FocusOut>", self.restore_placeholder)
        self.client_combobox.bind("<Button-1>", self.clear_placeholder)  # Click event
        self.client_combobox.bind("<FocusIn>", self.clear_placeholder)  # Keyboard focus

        # ✅ Create & Update Buttons (Pinned to Right)
        button_frame = ctk.CTkFrame(search_frame, fg_color="transparent")  # Small frame to hold buttons
        button_frame.grid(row=0, column=2, sticky="e", padx=(10, 0))  # Pin to right

        # Load images for buttons
        add_appt = ctk.CTkImage(Image.open("icons/add.png"), size=(24, 24))
        edit_appt = ctk.CTkImage(Image.open("icons/edit_appt.png"), size=(24, 24))

        self.create_button = ctk.CTkButton(button_frame, 
                                           text="",
                                           fg_color="transparent",
                                           hover_color="#555555",
                                           image=add_appt,
                                           command=self.create_appointment, 
                                           width=24)
        self.create_button.pack(side="right", padx=(0, 0))  # ✅ Align right

        self.update_button = ctk.CTkButton(button_frame, 
                                           text="",
                                           fg_color="transparent",
                                           hover_color="#555555",
                                           image=edit_appt, 
                                           command=self.update_appointment, 
                                           width=24)
        self.update_button.pack(side="right", padx=(170, 4))  # ✅ Align right

        # Create Treeview Frame
        treeview_frame = ctk.CTkFrame(main_frame)
        treeview_frame.grid(row=1, column=0, sticky="nsew", padx=(0, 5))

        # Apply treeview styling
        style_treeview("Appointments.Treeview")

        # Treeview widget for appointments
        columns = ("date", "time", "treatment", "price", "photo")
        self.appointments_table = ttk.Treeview(treeview_frame, selectmode="extended", columns=columns, show="headings", height=10, style="Appointments.Treeview")
        self.appointments_table.pack(side="left", fill="both", expand=True)
        self.appointments_table.bind("<ButtonRelease-1>", self.on_appointment_select)
        self.appointments_table.bind("<Double-1>", self.on_double_click_edit_appointment)

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

    def on_client_selected(self, selected_client):
        """Triggered when a client is selected from the combobox."""
        if not selected_client or selected_client == "No matches found":
            self.client_combobox.set("Select a client...")  # ✅ Restore placeholder
            return  # 🔥 Exit early, don't process selection

        self.cursor.execute("SELECT id FROM clients WHERE full_name = ?", (selected_client,))
        result = self.cursor.fetchone()

        if result:
            self.client_id = result[0]  # Store the client ID
            print(f"🟢 Selected Client: {selected_client} (ID: {self.client_id})")

            # ✅ Update Profile Card
            if hasattr(self.main_app, "profile_card"):
                self.main_app.profile_card.load_client(self.client_id)

            # ✅ Update Info Tab
            if hasattr(self.main_app, "tabs") and "Info" in self.main_app.tabs:
                self.main_app.tabs["Info"].populate_client_info(self.client_id)

            # ✅ Load Appointments for the Selected Client
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

    def filter_clients(self, event):
        """Dynamically update the client dropdown based on user input."""
        query = self.client_combobox.get().strip()  # Get the current text

        if query:  # Only search if there's input
            self.cursor.execute(
                "SELECT full_name FROM clients WHERE full_name LIKE ? LIMIT 10", (f"%{query}%",)
            )
            matches = [row[0] for row in self.cursor.fetchall()]

            if matches:
                self.client_combobox.configure(values=matches)  # Update dropdown with results
            else:
                self.client_combobox.configure(values=["No matches found"])  # Indicate no matches

        else:
            self.client_combobox.configure(values=[])  # Clear suggestions if input is empty

        self.client_combobox.focus()  # Ensure the combobox remains focused

    def restore_placeholder(self, event=None):
        """Restore the placeholder text if no valid client is selected when focus is lost."""
        current_text = self.client_var.get().strip()

        if not current_text or current_text == "No matches found":
            self.client_combobox.set("Select a client...")  # Reset placeholder
            self.client_combobox.configure(text_color="#9a9a99")

    def clear_placeholder(self, event=None):
        """Clear the placeholder text when the user clicks or focuses on the combobox."""
        if self.client_var.get() == "Select a client...":  # ✅ Only clear if it's the placeholder
            self.client_combobox.set("")  # ✅ Clear text to allow typing
            self.client_combobox.configure(text_color="white")

    def load_client_appointments(self, client_id):
        """Load appointments for the selected client into the Treeview."""
        # If client_id changed, reset the combobox to placeholder otherwise retain white text color
        if self.client_id != client_id:
            self.client_combobox.set("Select a client...")
            self.client_combobox.configure(text_color="#9a9a99")

        else:
            self.client_combobox.configure(text_color="white")

        # Store the current client ID
        self.client_id = client_id  

        # Clear existing rows in the Treeview
        self.appointments_table.delete(*self.appointments_table.get_children())
        self.details_textbox.delete("1.0", "end")
        
        try:
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

        except Exception as e:
            print(f"❌ Error loading appointments: {e}")

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

        # ✅ Reset Appointments ComboBox to Placeholder
        self.client_combobox.set("Select a client...")
        self.client_combobox.configure(text_color="gray")  # ✅ Ensure placeholder color

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

    def create_appointment(self):
        """Open a dialog to create a new appointment."""
        if not self.client_id:
            print("⚠ No client selected. Cannot create appointment.")
            return
        print("✅ Creating new appointment for Client ID:", self.client_id)
        
        self.appointment_window = ctk.CTkToplevel()
        self.appointment_window.title("Create Appointment")
        self.appointment_window.geometry("350x400")
        self.appointment_window.resizable(False, False)

        # ✅ Labels & Input Fields (Pre-fill with existing data)
        ctk.CTkLabel(self.appointment_window, text="Date").pack(pady=(10, 2))
        self.date_entry = ctk.CTkEntry(self.appointment_window)
        self.date_entry.pack()
        self.date_entry.bind("<Return>", lambda event: (self.format_date(), self.focus_next_widget(event)))
        self.date_entry.bind("<FocusOut>", lambda event: self.format_date())

        ctk.CTkLabel(self.appointment_window, text="Time").pack(pady=(10, 2))
        self.time_entry = ctk.CTkEntry(self.appointment_window)
        self.time_entry.pack()
        self.time_entry.bind("<Return>", lambda event: (self.format_time(), self.focus_next_widget(event)))
        self.time_entry.bind("<FocusOut>", lambda event: self.format_time())

        ctk.CTkLabel(self.appointment_window, text="Treatment").pack(pady=(10, 2))
        self.treatment_entry = ctk.CTkEntry(self.appointment_window)
        self.treatment_entry.pack()
        self.treatment_entry.bind("<Return>", lambda event: (self.focus_next_widget(event)))

        ctk.CTkLabel(self.appointment_window, text="Price").pack(pady=(10, 2))
        self.price_entry = ctk.CTkEntry(self.appointment_window)
        self.price_entry.pack()
        self.price_entry.bind("<Return>", lambda event: self.format_price())
        self.price_entry.bind("<FocusOut>", lambda event: self.format_price())

        # Save Button
        ctk.CTkButton(self.appointment_window, text="Save", command=self.save_new_appointment).pack(pady=15)

    def save_new_appointment(self):
        """Save the new appointment to the database."""
        # ✅ Apply formatting to all fields before saving
        self.format_date()
        self.format_time()
        self.format_price()

        date = self.date_entry.get().strip()
        time = self.time_entry.get().strip() or "00:00 AM"
        treatment = self.treatment_entry.get().strip()
        price = self.price_entry.get().strip()

        # ✅ Validate required fields
        if not date or not treatment or not price:
            print("⚠ All fields except time are required. Appointment not saved.")
            return

        print(f"🆕 Creating Appointment for Client ID {self.client_id}: {date}, {time}, {treatment}, {price}")

        try:
            # ✅ Insert into database
            self.cursor.execute("""
                INSERT INTO appointments (client_id, date, time, treatment, price, photo_taken, treatment_notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (self.client_id, date, time, treatment, price, "No", "No notes added to this appointment yet."))
            self.conn.commit()

            print(f"✅ New appointment created for Client ID {self.client_id} on {date} at {time}.")

            # ✅ Refresh the appointments list & close the window
            self.load_client_appointments(self.client_id)
            self.appointment_window.destroy()

        except Exception as e:
            print(f"❌ Error saving new appointment: {e}")


    def update_appointment(self):
        """Open a dialog to update an existing appointment."""
        selected_item = self.appointments_table.selection()
        if not selected_item:
            print("⚠ No appointment selected for update.")
            return

        # ✅ Fetch appointment data from TreeView
        item_data = self.appointments_table.item(selected_item[0], "values")
        appointment_id = self.get_selected_appointment_id(selected_item[0])

        if not appointment_id:
            print("⚠ Unable to determine appointment ID.")
            return

        date, time, treatment, price, photo_taken = item_data

        # ✅ Create update window
        self.appointment_window = ctk.CTkToplevel()
        self.appointment_window.title("Update Appointment")
        self.appointment_window.geometry("350x400")
        self.appointment_window.resizable(False, False)

        # ✅ Labels & Input Fields (Pre-fill with existing data)
        ctk.CTkLabel(self.appointment_window, text="Date").pack(pady=(10, 2))
        self.date_entry = ctk.CTkEntry(self.appointment_window)
        self.date_entry.insert(0, date)
        self.date_entry.pack()
        self.date_entry.bind("<Return>", lambda event: (self.format_date(), self.focus_next_widget(event)))
        self.date_entry.bind("<FocusOut>", lambda event: self.format_date())

        ctk.CTkLabel(self.appointment_window, text="Time").pack(pady=(10, 2))
        self.time_entry = ctk.CTkEntry(self.appointment_window)
        self.time_entry.insert(0, time)
        self.time_entry.pack()
        self.time_entry.bind("<Return>", lambda event: (self.format_time(), self.focus_next_widget(event)))
        self.time_entry.bind("<FocusOut>", lambda event: self.format_time())

        ctk.CTkLabel(self.appointment_window, text="Treatment").pack(pady=(10, 2))
        self.treatment_entry = ctk.CTkEntry(self.appointment_window)
        self.treatment_entry.insert(0, treatment)
        self.treatment_entry.pack()
        self.treatment_entry.bind("<Return>", lambda event: (self.focus_next_widget(event)))


        ctk.CTkLabel(self.appointment_window, text="Price").pack(pady=(10, 2))
        self.price_entry = ctk.CTkEntry(self.appointment_window)
        self.price_entry.insert(0, price)
        self.price_entry.pack()
        self.price_entry.bind("<Return>", lambda event: self.format_price())
        self.price_entry.bind("<FocusOut>", lambda event: self.format_price())

        # ✅ Save Button
        ctk.CTkButton(self.appointment_window, text="Update", command=lambda: self.save_updated_appointment(appointment_id)).pack(pady=15)

    def save_updated_appointment(self, appointment_id):
        """Save the updated appointment details."""
        # ✅ Apply formatting to all fields before saving
        self.format_date()
        self.format_time()
        self.format_price()

        date = self.date_entry.get().strip()
        time = self.time_entry.get().strip() or "00:00 AM"
        treatment = self.treatment_entry.get().strip()
        price = self.price_entry.get().strip()

        if not date or not treatment or not price:
            print("⚠ All fields except time are required. Update aborted.")
            return

        print(f"✏️ Updating Appointment ID {appointment_id}: {date}, {time}, {treatment}, {price}")

        try:
            # ✅ Update the database
            self.cursor.execute("""
                UPDATE appointments 
                SET date = ?, time = ?, treatment = ?, price = ?
                WHERE id = ?
            """, (date, time, treatment, price, appointment_id))
            self.conn.commit()
            print(f"✅ Appointment {appointment_id} updated successfully.")

            # ✅ Refresh the appointment list and close the window
            self.load_client_appointments(self.client_id)
            self.appointment_window.destroy()

        except Exception as e:
            print(f"❌ Database update failed: {e}")

    def get_selected_appointment_id(self, treeview_item):
        """Retrieve the appointment ID based on the TreeView selection."""
        try:
            selected_date = self.appointments_table.item(treeview_item)["values"][0]  # Date is the first column
            if not isinstance(selected_date, str):  # ✅ Ensure it's a string
                selected_date = str(selected_date)

            self.cursor.execute("SELECT id FROM appointments WHERE client_id = ? AND date = ?", 
                                (self.client_id, selected_date))
            result = self.cursor.fetchone()
                
            return result[0] if result else None
        except Exception as e:
            print(f"⚠ Error retrieving appointment ID: {e}")
            return None

    def get_treatment_notes(self, appointment_id):
        """Fetch treatment notes for an appointment."""
        self.cursor.execute("SELECT treatment_notes FROM appointments WHERE id = ?", (appointment_id,))
        result = self.cursor.fetchone()
        return result[0] if result else ""

    def format_date(self):
        """Format the date entry to MM/DD/YYYY upon hitting Enter or leaving the field."""
        raw_date = self.date_entry.get().strip()

        if not raw_date:  # ✅ Keep placeholder if empty
            self.date_entry.delete(0, "end")
            return

        # ✅ Remove non-numeric characters except slashes, dashes, and dots
        cleaned_date = re.sub(r"[^0-9/.-]", "", raw_date)

        # ✅ Prevent re-formatting if already in correct format
        if re.fullmatch(r"\d{2}/\d{2}/\d{4}", cleaned_date):  
            return  # ✅ Exit early if already MM/DD/YYYY

        formatted_date = None  # Initialize

        try:
            # ✅ Convert formats like 12101992 → 12/10/1992
            if len(re.sub(r"\D", "", cleaned_date)) == 8:
                formatted_date = f"{cleaned_date[:2]}/{cleaned_date[2:4]}/{cleaned_date[4:]}"
            
            else:
                # ✅ Attempt to parse multiple formats
                for fmt in ["%m-%d-%Y", "%m.%d.%Y", "%m/%d/%Y"]:
                    try:
                        parsed_date = datetime.strptime(cleaned_date, fmt)
                        formatted_date = parsed_date.strftime("%m/%d/%Y")
                        break  # ✅ Exit loop on success
                    except ValueError:
                        formatted_date = None  # Keep None if no format matches

            if not formatted_date:
                raise ValueError("Invalid date format")

        except ValueError:
            print("⚠ Invalid date entered. Resetting to placeholder.")
            self.date_entry.delete(0, "end")
            self.date_entry.insert(0, raw_date)  # ✅ Reset to prior date
            return

        # ✅ Insert the correctly formatted date
        self.date_entry.delete(0, "end")
        self.date_entry.insert(0, formatted_date)
        print(f"✅ Formatted Date: {formatted_date}")

    def format_time(self):
        """Format the time entry to HH:MM AM/PM upon hitting Enter or leaving the field."""
        raw_time = self.time_entry.get().strip()

        if not raw_time:  # ✅ Keep placeholder if empty
            self.time_entry.delete(0, "end")
            self.time_entry.insert(0, "00:00 AM")  # ✅ Default to placeholder
            return
    
        # ✅ Extract AM/PM indicator
        am_pm_match = re.search(r"(am|pm)", raw_time.lower())  # Extract "am" or "pm"
        am_pm = am_pm_match.group(0).upper() if am_pm_match else None  # Convert to uppercase AM/PM

        # ✅ Remove spaces and ensure lowercase
        cleaned_time = raw_time.lower().replace(" ", "").replace("-", "").replace(".", "")

        # ✅ Extract numeric values
        numbers_only = re.sub(r"\D", "", cleaned_time)

        formatted_time = None  # Initialize

        try:
            # ✅ Ensure we apply AM/PM if provided, otherwise default to AM
            if ":" in cleaned_time:  # Example: 3:15pm → 03:15 PM
                parsed_time = datetime.strptime(cleaned_time, "%I:%M%p" if am_pm else "%I:%M")
            elif len(numbers_only) == 4:  # Example: 0315 → 03:15
                parsed_time = datetime.strptime(numbers_only, "%I%M")
            elif len(numbers_only) == 3:  # Example: 315 → 03:15
                parsed_time = datetime.strptime(numbers_only.zfill(4), "%I%M")
            elif len(numbers_only) <= 2:  # Example: 8pm → 08:00 PM
                parsed_time = datetime.strptime(numbers_only.zfill(2), "%I")
            else:
                raise ValueError("Invalid time format")

            # ✅ Apply AM/PM if detected
            if am_pm:
                formatted_time = parsed_time.strftime(f"%I:%M {am_pm}")  # ✅ Correctly apply AM/PM
            else:
                formatted_time = parsed_time.strftime("%I:%M AM")  # ✅ Default to AM

        except ValueError:
            print("⚠ Invalid time entered. Resetting to placeholder.")
            self.time_entry.delete(0, "end")
            self.time_entry.insert(0, "00:00 AM")  # ✅ Reset to placeholder
            return

        # ✅ Prevent re-formatting if the new formatted time is the same as last time
        if hasattr(self, "last_formatted_time") and self.last_formatted_time == formatted_time:
            return
    
        # ✅ Store formatted time to prevent redundant formatting
        self.last_formatted_time = formatted_time  

        # ✅ Insert the correctly formatted time
        self.time_entry.delete(0, "end")
        self.time_entry.insert(0, formatted_time)
        print(f"✅ Formatted Time: {formatted_time}")

    def format_price(self, event=None):
        """Format the price entry to '$X.XX' upon hitting Enter or leaving the field."""
        raw_price = self.price_entry.get().strip()

        if not raw_price:  # ✅ Keep placeholder if empty
            self.price_entry.delete(0, "end")
            self.price_entry.insert(0, "$0.00")  # ✅ Default placeholder
            return

        # ✅ Prevent re-formatting if already formatted correctly
        if hasattr(self, "last_formatted_price") and self.last_formatted_price == raw_price:
            return

        # ✅ Extract numeric values (keep digits and decimal points)
        cleaned_price = re.sub(r"[^\d.]", "", raw_price)  # Remove non-numeric/non-decimal chars

        try:
            # ✅ Convert to float and format as '$ X.XX'
            formatted_price = f"${float(cleaned_price):.2f}"
        except ValueError:
            print("⚠ Invalid price entered. Resetting to placeholder.")
            self.price_entry.delete(0, "end")
            self.price_entry.insert(0, "$0.00")  # ✅ Reset to placeholder
            return

        # ✅ Store the formatted price to prevent redundant re-formatting
        self.last_formatted_price = formatted_price  

        # ✅ Insert the correctly formatted price
        self.price_entry.delete(0, "end")
        self.price_entry.insert(0, formatted_price)
        print(f"✅ Formatted Price: {formatted_price}")

    def focus_next_widget(self, event):
        """Move focus to the next widget when pressing Enter."""
        event.widget.tk_focusNext().focus()
        return "break"  # Prevents default behavior (e.g., inserting a newline in text fields)

    def on_double_click_edit_appointment(self, event):
        """Open the Edit Appointment window when an appointment is double-clicked."""
        
        selected_item = self.appointments_table.selection()
        
        if not selected_item:
            print("⚠ No appointment selected for editing.")
            return

        print("✏️ Double-click detected. Opening Edit Window...")

        # ✅ Call `update_appointment()` to open the edit window
        self.update_appointment()