import customtkinter as ctk
from tkinter import ttk
import tkinter as tk
from class_elements.profile_card import ProfileCard
from class_elements.treeview_styling import style_treeview
from datetime import datetime
from PIL import Image
import re
import tkinter.messagebox as messagebox


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
        main_frame.columnconfigure(0, weight=1) 
        main_frame.columnconfigure(1, weight=1)
        main_frame.columnconfigure(2, weight=1)  
        main_frame.columnconfigure(3, weight=5) # Details frame
        main_frame.rowconfigure(1, weight=1)    # Allow frames to stretch vertically

        # Create Frame for search box
        search_frame = ctk.CTkFrame(main_frame)
        search_frame.grid(row=0, column=0, sticky="nw", padx=(0, 0), pady=(0, 10))
        search_frame.columnconfigure(1, weight=1)  # Ensure the combobox expands properly

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
            width=250,
            border_width=0
        )
        self.client_combobox.grid(row=0, column=1, sticky="w", padx=2, pady=2)  # Stretch across grid
        self.client_combobox.configure(text_color="#9a9a99")

        # Keybinds for combobox functionality
        self.client_combobox.bind("<KeyRelease>", self.filter_clients)
        self.client_combobox.bind("<FocusOut>", self.restore_placeholder)
        self.client_combobox.bind("<Button-1>", self.clear_placeholder)  # Click event
        self.client_combobox.bind("<FocusIn>", self.clear_placeholder)  # Keyboard focus

        # Load images for buttons
        add_appt = ctk.CTkImage(Image.open("icons/add.png"), size=(24, 24))
        edit_appt = ctk.CTkImage(Image.open("icons/edit_appt.png"), size=(24, 24))
        delete_appt = ctk.CTkImage(Image.open("icons/delete.png"), size=(24, 24))

        create_frame = ctk.CTkFrame(main_frame)
        create_frame.grid(row=0, column=1, sticky="e", padx=(0, 5), pady=(0, 10))

        self.create_button = ctk.CTkButton(create_frame, 
                                           text="",
                                           fg_color="transparent",
                                           hover_color="#555555",
                                           image=add_appt,
                                           command=self.create_appointment, 
                                           width=24)
        self.create_button.pack(side="left", padx=(5, 5))  # ✅ Align right

        # ✅ Create & Update Buttons (Pinned to Right)
        button_frame = ctk.CTkFrame(main_frame)  # Small frame to hold buttons
        button_frame.grid(row=0, column=2, sticky="e", padx=(5, 5), pady=(0, 10))  # Pin to right

        self.update_button = ctk.CTkButton(button_frame, 
                                           text="",
                                           fg_color="transparent",
                                           hover_color="#555555",
                                           image=edit_appt, 
                                           command=self.update_appointment, 
                                           width=24)
        self.update_button.pack(side="left", padx=(5, 5))  # ✅ Align right

        self.delete_button = ctk.CTkButton(button_frame, 
                                        text="",
                                        fg_color="transparent",
                                        hover_color="#FF4444",  # Red hover color for delete
                                        image=delete_appt, 
                                        command=self.delete_appointment, 
                                        width=24)
        self.delete_button.pack(side="left", padx=(0, 5))  # ✅ Align right

        # Create Treeview Frame
        treeview_frame = ctk.CTkFrame(main_frame)
        treeview_frame.grid(row=1, column=0, columnspan=3, sticky="nsew", padx=(0, 5), pady=(0, 10))

        # Apply treeview styling
        style_treeview("Appointments.Treeview")

        # Treeview widget for appointments
        columns = ("date", "time", "treatment", "price", "photos")
        self.appointments_table = ttk.Treeview(treeview_frame, selectmode="extended", columns=columns, show="headings", height=10, style="Appointments.Treeview")
        self.appointments_table.pack(side="left", fill="both", expand=True)
        self.appointments_table.bind("<ButtonRelease-1>", self.on_appointment_select)
        self.appointments_table.bind("<Double-1>", self.on_double_click_edit_appointment)
        self.appointments_table.bind("<Delete>", self.delete_appointment)
        self.appointments_table.bind("<BackSpace>", self.delete_appointment)

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
        self.details_frame = ctk.CTkFrame(main_frame)
        self.details_frame.grid(row=0, rowspan=2, column=3, sticky="nsew", padx=(10, 0), pady=(0, 10))
        self.details_frame.grid_propagate(False)  # ✅ Prevent auto-expanding

        # Configure grid inside details_frame
        self.details_frame.columnconfigure(0, weight=1, minsize=50)  # Minimum width
        self.details_frame.columnconfigure(1, weight=0)  # No expansion beyond this
        self.details_frame.rowconfigure(1, weight=1)  # Allow the textboxes to expand vertically

        # Create Label/Textbox for "All Appointment Notes"
        self.notes_label = ctk.CTkLabel(self.details_frame, text="All Treatment Notes", font=("Arial", 16))
        self.notes_label.grid(row=0, column=0, sticky="w", padx=10, pady=5)
        self.all_notes_textbox = tk.Text(self.details_frame,  
                                         font=("Arial", 10), 
                                         wrap="word", 
                                         fg="white", 
                                         bg="#1E1E1E", 
                                         bd=0, 
                                         border=0, 
                                         borderwidth=0, 
                                         highlightthickness=0)
        self.all_notes_textbox.grid(row=1, column=0, columnspan=2, sticky="nsew")
        self.all_notes_textbox.configure(state="disabled")  # Disable editing

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
        self.appointments_table.column("photos", width=int(total_width * 0.07), minwidth=40)

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

        # STORE CURRENT CLIENT ID
        self.client_id = client_id  

        # CLEAR DATA --> Reset Treeview & Textboxes  
        self.appointments_table.delete(*self.appointments_table.get_children())
        self.all_notes_textbox.configure(state="normal")  # Enable Editing
        self.all_notes_textbox.delete("1.0", "end")
        self.all_notes_textbox.configure(state="disabled")  # Disable Again

        try:
            # FETCH APPT DATA --> Load appointments into selected client variable
            self.cursor.execute("""
                SELECT id, date, time, treatment, price, photos_taken, treatment_notes 
                FROM appointments 
                WHERE client_id = ?
                ORDER BY date DESC
            """, (client_id,))

            # Convert fetched rows into a list of tuples
            appointments = self.cursor.fetchall()

            # SORT APPTS --> Sort appointments by date (most recent first)
            try:
                appointments.sort(key=lambda x: datetime.strptime(x[1], "%m/%d/%Y"), reverse=True)
            except ValueError:
                print("⚠ Date formatting issue detected in database. Ensure format is MM/DD/YYYY.")

            # Insert sorted appointments into the TreeView
            for row in appointments:
                appointment_id, date, time, treatment, price, photos_taken, treatment_notes = row
                self.appointments_table.insert(
                    "", "end", values=(date, time, treatment, price, photos_taken), tags=(treatment_notes,)
                )

            # LOAD ALL NOTES --> Load compilation of treatment notes in "All Notes" view 
            self.load_all_treatment_notes()
                
        except Exception as e:
            print(f"❌ Error loading appointments: {e}")

    def on_appointment_select(self, event):
        """Handle selection of multiple appointments and update the All Notes textbox in real-time."""
        selected_items = self.appointments_table.selection()  # 🔥 Get ALL selected appointments
        if not selected_items:
            return

        # ✅ Configure Text Styles (Headers: 11px, Notes: 10px)
        self.all_notes_textbox.tag_configure("header", font=("Arial", 11, "bold"))
        self.all_notes_textbox.tag_configure("body", font=("Arial", 10))
        self.all_notes_textbox.tag_configure("divider", font=("Arial", 6))
        self.all_notes_textbox.tag_configure("highlight", background="#0080ff")  # ✅ Highlighted selection

        # ✅ Enable Editing & Clear Existing Notes
        self.all_notes_textbox.configure(state="normal")
        self.all_notes_textbox.delete("1.0", "end")

        jump_to_index = None  # ✅ Store the first occurrence for scrolling

        if len(selected_items) > 1:  # ✅ Multiple selection: Compile only the selected appointments' notes
            print("\n🆔 Multiple Appointments Selected:")

            for item in selected_items:
                appointment_id = self.get_selected_appointment_id(item)  
                appointment_data = self.appointments_table.item(item)["values"]

                if not appointment_data:
                    print(f"⚠ Skipping Appointment ID {appointment_id}: No data found.")
                    continue  

                # ✅ Extract fields
                date = appointment_data[0]
                time = appointment_data[1]
                treatment = appointment_data[2]
                price = appointment_data[3]
                photos_taken = appointment_data[4]

                # ✅ Debugging statements
                print(f"----------------------------")
                print(f"🆔 Appointment ID:     {appointment_id}")
                print(f"📅 Date:               {date}")
                print(f"⏰ Time:               {time}") 
                print(f"💆 Treatment:          {treatment}") 
                print(f"💰 Price:              {price}")
                print(f"📸 photos Taken?:       {photos_taken}")

                # ✅ Append notes for compilation
                treatment_notes = self.appointments_table.item(item).get("tags", [""])[0]  # ✅ Safe retrieval

                # 🔥 Dynamic Divider Logic (Match longest text)
                max_length = max(len(date), len(treatment) - 2)
                if max_length > 37:
                    max_length = 37
                divider_line = "━" * max_length

                # ✅ Insert formatted text with correct tags
                start_index = self.all_notes_textbox.index("end")  # ✅ Store where this note starts
                self.all_notes_textbox.insert("end", f"{divider_line}\n", "divider")  # Top Divider
                self.all_notes_textbox.insert("end", f"{treatment}\n", "header")  # Treatment (Header)
                self.all_notes_textbox.insert("end", f"{date}\n", "header")  # Date (Header)
                self.all_notes_textbox.insert("end", f"{divider_line}\n\n", "divider")  # Bottom Divider
                self.all_notes_textbox.insert("end", f"{treatment_notes}\n\n", "body")  # Notes (Body)

                # ✅ Store first match to jump to
                if jump_to_index is None:
                    jump_to_index = start_index

            print(f"----------------------------")

        else:  # ✅ Single selection: Display **ALL** of the client’s compiled appointment notes
            print("\n🆔 Single Appointment Selected: Loading ALL Notes for Client...")
            self.load_all_treatment_notes()

            # ✅ Get the selected appointment note to jump to
            selected_item = selected_items[0]
            selected_data = self.appointments_table.item(selected_item)["values"]
            if selected_data:
                selected_date = selected_data[0]
                selected_treatment = selected_data[2]

                # ✅ Find the first occurrence of the note
                search_text = f"{selected_treatment}\n{selected_date}"
                jump_to_index = self.all_notes_textbox.search(search_text, "1.0", stopindex="end", nocase=True)

                # ✅ Apply highlight **ONLY IF ONE APPOINTMENT IS SELECTED**
                if jump_to_index:
                    end_index = f"{jump_to_index.split('.')[0]}.end"
                    self.all_notes_textbox.tag_add("highlight", jump_to_index, end_index)
                    print(f"✅ Highlighted note at index: {jump_to_index}")

        # ✅ Scroll to first matching note (if found) & ensure it appears at the **top**
        if jump_to_index:
            print(f"{float(jump_to_index.split('.')[0])} / {float(self.all_notes_textbox.index('end').split('.')[0])} = {float(jump_to_index.split('.')[0]) / float(self.all_notes_textbox.index('end').split('.')[0])}")
            self.all_notes_textbox.yview_moveto((float(jump_to_index.split('.')[0]) - 2) / float(self.all_notes_textbox.index('end').split('.')[0]))
            print(f"✅ Jumped to note at index: {jump_to_index}")

        # ✅ Disable Editing Again
        self.all_notes_textbox.configure(state="disabled")

    def load_all_treatment_notes(self):
        """Load all treatment notes for the selected client, sorted by most recent appointment."""
        
        if not self.client_id:
            print("⚠ No client selected. Cannot load notes.")
            return

        self.cursor.execute("""
            SELECT date, treatment, treatment_notes 
            FROM appointments 
            WHERE client_id = ? 
            AND treatment_notes IS NOT NULL 
            AND treatment_notes != ''
            ORDER BY date DESC
        """, (self.client_id,))
        
        all_notes = self.cursor.fetchall()

        # ✅ Clear existing notes
        self.all_notes_textbox.configure(state="normal")  # Enable Editing
        self.all_notes_textbox.delete("1.0", "end")

        # ✅ Configure Text Styles (Headers: 14px, Notes: 12px)
        self.all_notes_textbox.tag_configure("header", font=("Arial", 11, "bold"))
        self.all_notes_textbox.tag_configure("body", font=("Arial", 10))
        self.all_notes_textbox.tag_configure("divider", font=("Arial", 6))

        # ✅ Compile formatted notes with dynamic dividers
        for date, treatment, notes in all_notes:
            max_length = max(len(date), len(treatment) - 2)  # 🔥 Choose longest text for dividers
            if max_length > 37:
                max_length = 37
            divider_line = "━" * max_length  # 🔥 Create dynamic length divider

            self.all_notes_textbox.insert("end", f"{divider_line}\n", "divider")  # Top Divider
            self.all_notes_textbox.insert("end", f"{treatment}\n", "header")  # Treatment (Header)
            self.all_notes_textbox.insert("end", f"{date}\n", "header")  # Date (Header)
            self.all_notes_textbox.insert("end", f"{divider_line}\n\n", "divider")  # Bottom Divider

            self.all_notes_textbox.insert("end", f"{notes}\n\n", "body")  # Notes (Body)

        if not all_notes:
            self.all_notes_textbox.insert("1.0", "No treatment notes available.", "body")

        self.all_notes_textbox.configure(state="disabled")  # Disable Again
        
    def clear_appointments(self):
        """Clear all rows in the appointments Treeview and treatment notes."""
        self.appointments_table.delete(*self.appointments_table.get_children())
        self.all_notes_textbox.configure(state="normal")  # Enable Editing
        self.all_notes_textbox.delete("1.0", "end")
        self.all_notes_textbox.configure(state="disabled")  # Disable Again

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
        
        # CREATE POP-UP WINDOW --> Create Appointment
        self.appointment_window = ctk.CTkToplevel()
        self.appointment_window.title("Create Appointment")
        self.appointment_window.geometry("500x380")
        self.appointment_window.resizable(True, True)

        # FORCE POP-UP AS TOP WINDOW & DISABLE MAIN WINDOW
        self.appointment_window.transient(self.main_app)  # Make it child of main app
        self.appointment_window.grab_set()  # Disable main window interaction
        self.appointment_window.focus_force()  # Force focus on the popup

        # Ensure proper window stretching
        self.appointment_window.grid_rowconfigure((0, 2), weight=1)
        self.appointment_window.grid_rowconfigure(1, weight=1)
        self.appointment_window.grid_columnconfigure(0, weight=1)

        # Row 0 [appt_window]: Create pop-up main frame
        self.pop_main_frame = ctk.CTkFrame(self.appointment_window)
        self.pop_main_frame.grid(row=0, column=0, sticky="nsew", padx=10, pady=(10, 5))

        ###########################################################
        ### ---------- POP_MAIN_FRAME CONTENTS BELOW ---------- ###
        ###########################################################

        # Ensure `pop_main_frame` expands properly
        self.pop_main_frame.columnconfigure((0, 2, 4), weight=1)  # Entry weights
        self.pop_main_frame.columnconfigure((1, 3, 5), weight=1)  # Label weights
        self.pop_main_frame.rowconfigure((0, 1, 2), weight=1)

        # Row 0 [pop_main_frame]: DATE Label/Entry
        ctk.CTkLabel(self.pop_main_frame, text="Date", anchor="w", width=70).grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.date_entry = ctk.CTkEntry(self.pop_main_frame)
        self.date_entry.grid(row=0, column=1, padx=5, pady=5, sticky="ew")
        self.date_entry.bind("<Return>", lambda event: (self.format_date(), self.focus_next_widget(event)))
        self.date_entry.bind("<FocusOut>", lambda event: self.format_date())

        # Row 0 [pop_main_frame]: TIME Label/Entry
        ctk.CTkLabel(self.pop_main_frame, text="Time", anchor="w", width=70).grid(row=0, column=2, padx=5, pady=5, sticky="w")
        self.time_entry = ctk.CTkEntry(self.pop_main_frame)
        self.time_entry.grid(row=0, column=3, padx=5, pady=5, sticky="ew")
        self.time_entry.bind("<Return>", lambda event: (self.format_time(), self.focus_next_widget(event)))
        self.time_entry.bind("<FocusOut>", lambda event: self.format_time())

        # Row 0 [pop_main_frame]: PRICE Label/Entry
        ctk.CTkLabel(self.pop_main_frame, text="Price", anchor="w", width=70).grid(row=0, column=4, padx=5, pady=5, sticky="w")
        self.price_entry = ctk.CTkEntry(self.pop_main_frame)
        self.price_entry.grid(row=0, column=5, padx=5, pady=5, sticky="ew")
        self.price_entry.bind("<Return>", lambda event: (self.format_price(), self.focus_next_widget(event)))
        self.price_entry.bind("<FocusOut>", lambda event: self.format_price())

        # Row 1 [pop_main_frame]: TREATMENT Label/Entry
        ctk.CTkLabel(self.pop_main_frame, text="Treatment", anchor="w", width=102).grid(row=1, column=0, padx=5, pady=5, sticky="w")
        self.treatment_entry = ctk.CTkEntry(self.pop_main_frame)
        self.treatment_entry.grid(row=1, column=1, columnspan=5, padx=5, pady=5, sticky="ew")

        ###########################################################
        ### ---------- POP_MAIN_FRAME CONTENTS ABOVE ---------- ###
        ###########################################################

        # Row 1 [appt_window]: Create NOTES Frame
        self.notes_frame = ctk.CTkFrame(self.appointment_window)
        self.notes_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=5)

       # Ensure the notes frame stretches properly
        self.notes_frame.grid_rowconfigure(0, weight=1)
        self.notes_frame.grid_columnconfigure(0, weight=1)

        # Row 1 [notes_frame]: NOTES Label/Textbox
        self.notes_label = ctk.CTkLabel(self.notes_frame, text="Notes").grid(row=0, column=0, sticky="w", padx=5)
        self.current_notes_textbox = ctk.CTkTextbox(self.notes_frame, corner_radius=0, wrap="word", fg_color="#1E1E1E")
        self.current_notes_textbox.grid(row=1, column=0, sticky="nsew")

        # Row 2 [appt_window]: Save Button
        self.save_button = ctk.CTkButton(self.appointment_window, text="Save", command=self.save_new_appointment)
        self.save_button.grid(row=2, column=0, pady=(5, 10))


    def save_new_appointment(self):
        """Save the new appointment to the database."""
        # EXTRACT --> PACK data from entry boxes into variables
        date = self.date_entry.get().strip()
        time = self.time_entry.get().strip()
        treatment = self.treatment_entry.get().strip()
        price = self.price_entry.get().strip()
        treatment_notes = self.current_notes_textbox.get("1.0", "end").strip()

        # VALIDATION CHECK --> Date, Treatment, and Price are REQUIRED
        missing_fields = []
        if not date:
            missing_fields.append("- Date")
        if not treatment:
            missing_fields.append("- Treatment")
        if not price:
            missing_fields.append("- Price")

        if missing_fields:
            # SHOW WARNING MESSAGE and return to popup window
            messagebox.showwarning("Missing Fields", f"Please fill out the following required fields:\n\n{chr(10).join(missing_fields)}")
            return

        # Apply CORRECT FORMATTING to all entry boxes before saving
        self.format_date()
        self.format_time()
        self.format_price()

        print(f"🆕 Creating Appointment for Client ID {self.client_id}: {date}, {time}, {treatment}, {price}, {treatment_notes}")

        try:
            # ✅ Insert into database
            self.cursor.execute("""
                INSERT INTO appointments (client_id, date, time, treatment, price, photos_taken, treatment_notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (self.client_id, date, time, treatment, price, "No", treatment_notes if treatment_notes else "<No notes added>"))
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

        date, time, treatment, price, photos_taken = item_data

        # Fetch treatment notes from the database
        self.cursor.execute("SELECT treatment_notes FROM appointments WHERE id = ?", (appointment_id,))
        treatment_notes_result = self.cursor.fetchone()
        treatment_notes = treatment_notes_result[0] if treatment_notes_result else ""

        # CREATE POP-UP WINDOW --> Update Appointment
        self.appointment_window = ctk.CTkToplevel()
        self.appointment_window.title("Update Appointment")
        self.appointment_window.geometry("500x380")
        self.appointment_window.resizable(True, True)

        # FORCE POP-UP AS TOP WINDOW & DISABLE MAIN WINDOW
        self.appointment_window.transient(self.main_app)  # Make it child of main app
        self.appointment_window.grab_set()  # Disable main window interaction
        self.appointment_window.focus_force()  # Force focus on the popup

        # Ensure proper window stretching
        self.appointment_window.grid_rowconfigure((0, 2), weight=1)
        self.appointment_window.grid_rowconfigure(1, weight=1)
        self.appointment_window.grid_columnconfigure(0, weight=1)

        # Row 0 [appt_window]: Create pop-up main frame
        self.pop_main_frame = ctk.CTkFrame(self.appointment_window)
        self.pop_main_frame.grid(row=0, column=0, sticky="nsew", padx=10, pady=(10, 5))

        ###########################################################
        ### ---------- POP_MAIN_FRAME CONTENTS BELOW ---------- ###
        ###########################################################

        # Ensure `pop_main_frame` expands properly
        self.pop_main_frame.columnconfigure((0, 2, 4), weight=1)  # Entry weights
        self.pop_main_frame.columnconfigure((1, 3, 5), weight=1)  # Label weights
        self.pop_main_frame.rowconfigure((0, 1, 2), weight=1)

        # Row 0 [pop_main_frame]: DATE Label/Entry
        ctk.CTkLabel(self.pop_main_frame, text="Date", anchor="w", width=70).grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.date_entry = ctk.CTkEntry(self.pop_main_frame)
        self.date_entry.insert(0, date)
        self.date_entry.grid(row=0, column=1, padx=5, pady=5, sticky="ew")
        self.date_entry.bind("<Return>", lambda event: (self.format_date(), self.focus_next_widget(event)))
        self.date_entry.bind("<FocusOut>", lambda event: self.format_date())

        # Row 0 [pop_main_frame]: TIME Label/Entry
        ctk.CTkLabel(self.pop_main_frame, text="Time", anchor="w", width=70).grid(row=0, column=2, padx=5, pady=5, sticky="w")
        self.time_entry = ctk.CTkEntry(self.pop_main_frame)
        self.time_entry.insert(0, time)
        self.time_entry.grid(row=0, column=3, padx=5, pady=5, sticky="ew")
        self.time_entry.bind("<Return>", lambda event: (self.format_time(), self.focus_next_widget(event)))
        self.time_entry.bind("<FocusOut>", lambda event: self.format_time())

        # Row 0 [pop_main_frame]: PRICE Label/Entry
        ctk.CTkLabel(self.pop_main_frame, text="Price", anchor="w", width=70).grid(row=0, column=4, padx=5, pady=5, sticky="w")
        self.price_entry = ctk.CTkEntry(self.pop_main_frame)
        self.price_entry.insert(0, price)
        self.price_entry.grid(row=0, column=5, padx=5, pady=5, sticky="ew")
        self.price_entry.bind("<Return>", lambda event: (self.format_price(), self.focus_next_widget(event)))
        self.price_entry.bind("<FocusOut>", lambda event: self.format_price())

        # Row 1 [pop_main_frame]: TREATMENT Label/Entry
        ctk.CTkLabel(self.pop_main_frame, text="Treatment", anchor="w", width=102).grid(row=1, column=0, padx=5, pady=5, sticky="w")
        self.treatment_entry = ctk.CTkEntry(self.pop_main_frame)
        self.treatment_entry.insert(0, treatment)
        self.treatment_entry.grid(row=1, column=1, columnspan=5, padx=5, pady=5, sticky="ew")

        ###########################################################
        ### ---------- POP_MAIN_FRAME CONTENTS ABOVE ---------- ###
        ###########################################################

        # Row 1 [appt_window]: Create NOTES Frame
        self.notes_frame = ctk.CTkFrame(self.appointment_window)
        self.notes_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=5)

       # Ensure the notes frame stretches properly
        self.notes_frame.grid_rowconfigure(0, weight=1)
        self.notes_frame.grid_columnconfigure(0, weight=1)

        # Row 1 [notes_frame]: NOTES Label/Textbox
        self.notes_label = ctk.CTkLabel(self.notes_frame, text="Notes").grid(row=0, column=0, sticky="w", padx=5)
        self.current_notes_textbox = ctk.CTkTextbox(self.notes_frame, corner_radius=0, wrap="word", fg_color="#1E1E1E")
        self.current_notes_textbox.insert("1.0", treatment_notes)
        self.current_notes_textbox.grid(row=1, column=0, sticky="nsew")

        # Row 2 [appt_window]: Save Button
        self.save_button = ctk.CTkButton(self.appointment_window, text="Update", command=lambda: self.save_updated_appointment(appointment_id))
        self.save_button.grid(row=2, column=0, pady=(5, 10))

    def save_updated_appointment(self, appointment_id):
        """Save the updated appointment details."""
        date = self.date_entry.get().strip()
        time = self.time_entry.get().strip()
        treatment = self.treatment_entry.get().strip()
        price = self.price_entry.get().strip()
        treatment_notes = self.current_notes_textbox.get("1.0", "end").strip()

        # ✅ Validation check for required fields
        missing_fields = []
        if not date:
            missing_fields.append("- Date")
        if not treatment:
            missing_fields.append("- Treatment Name")
        if not price:
            missing_fields.append("- Price")

        if missing_fields:
            # ✅ Show warning message and return
            messagebox.showwarning("Missing Fields", f"Please fill out the following required fields:\n\n{chr(10).join(missing_fields)}")
            return

        # ✅ Apply formatting to all fields before saving
        self.format_date()
        self.format_time()
        self.format_price()

        print(f"✏️ Updating Appointment ID {appointment_id}: {date}, {time}, {treatment}, {price}, {treatment_notes}")

        try:
            # ✅ Update the database
            self.cursor.execute("""
                UPDATE appointments 
                SET date = ?, time = ?, treatment = ?, price = ?, treatment_notes = ?
                WHERE id = ?
            """, (date, time, treatment, price, treatment_notes if treatment_notes else "<No notes added>", appointment_id))
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
        self.cursor.execute("""
                            SELECT treatment_notes 
                            FROM appointments 
                            WHERE id = ?
        """, (appointment_id,))
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

    def delete_appointment(self, event=None):
        """Delete the selected appointment from the database after user confirmation."""
        selected_item = self.appointments_table.selection()

        if not selected_item:
            print("⚠ No appointment selected for deletion.")
            return

        # ✅ Fetch appointment ID
        appointment_id = self.get_selected_appointment_id(selected_item[0])

        if not appointment_id:
            print("⚠ Unable to determine appointment ID. Deletion aborted.")
            return

        # ✅ Step 3: Create Confirmation Pop-up
        confirmation = ctk.CTkToplevel()
        confirmation.title("Confirm Deletion")
        confirmation.geometry("350x150")
        confirmation.resizable(False, False)
        
        # 🔥 Make pop-up **always on top** and disable main window until closed
        confirmation.transient(self.main_app)  # Link to main app window
        confirmation.grab_set()  # Prevent interactions with main app until pop-up is closed
        confirmation.focus_force()  # Immediately focus the pop-up window

        # ✅ Confirmation Message
        ctk.CTkLabel(
            confirmation, 
            text="Are you sure you want to delete this appointment?",
            font=("Arial", 14), wraplength=300
        ).pack(pady=10)

        # ✅ Buttons Frame
        button_frame = ctk.CTkFrame(confirmation, fg_color="transparent")
        button_frame.pack(pady=10)

        # ❌ Cancel Button (Closes Pop-up)
        ctk.CTkButton(button_frame, text="Cancel", command=confirmation.destroy).pack(side="left", padx=5)

        # 🗑️ Delete Button (Executes Deletion)
        ctk.CTkButton(
            button_frame, text="Delete", fg_color="#FF4444", hover_color="#CC0000",
            command=lambda: self._execute_delete_appointment(appointment_id, confirmation)
        ).pack(side="right", padx=5)

    def _execute_delete_appointment(self, appointment_id, confirmation_window):
        """Executes appointment deletion and closes the confirmation pop-up."""
        try:
            # ✅ Step 4: Delete the appointment
            self.cursor.execute("DELETE FROM appointments WHERE id = ?", (appointment_id,))
            self.conn.commit()
            print(f"🗑️ Appointment {appointment_id} deleted successfully.")

            # ✅ Refresh appointments list
            self.load_client_appointments(self.client_id)

        except Exception as e:
            print(f"❌ Error deleting appointment: {e}")

        finally:
            confirmation_window.destroy()  # Close confirmation window
