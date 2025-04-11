import customtkinter as ctk
from tkinter import ttk
import tkinter as tk
from PIL import Image
from tkinter import messagebox
from tkinter import filedialog
from class_elements.treeview_styling_light import style_treeview_light
from datetime import datetime, timedelta
import re


class AlertsPage:
    def __init__(self, parent, conn, main_app):
        self.parent = parent
        self.conn = conn
        self.main_app = main_app
        self.cursor = conn.cursor()
        self.client_id = None

        # Main frame
        main_frame = ctk.CTkFrame(parent)
        main_frame.pack(fill="both", expand=True, padx=10)
        main_frame.grid_rowconfigure(0, weight=0)
        main_frame.grid_rowconfigure(1, weight=1)
        main_frame.grid_columnconfigure(0, weight=1)
        main_frame.grid_columnconfigure(1, weight=8)

        # Set Deadline Frame
        set_deadline_frame = ctk.CTkFrame(main_frame, fg_color="#563A9C")
        set_deadline_frame.grid(row=0, column=0, padx=(0, 10), pady=(0, 10), sticky="ew")
        set_deadline_frame.grid_columnconfigure(1, weight=1)

        # Deadline Label
        deadline_label = ctk.CTkLabel(set_deadline_frame, text="Enter Deadline:", font=("Helvetica", 14, "bold"), fg_color="transparent", text_color="#ebebeb")
        deadline_label.grid(row=0, column=0, sticky="w", padx=10)

        # Deadline Entry
        self.deadline_entry = ctk.CTkEntry(set_deadline_frame, placeholder_text="MM/DD/YYYY", placeholder_text_color="#797e82", width=100)
        self.deadline_entry.grid(row=0, column=1, sticky="ew", padx=(0, 10), pady=2)
        self.deadline_entry.bind("<FocusOut>", lambda e: self.format_date())
        self.deadline_entry.bind("<Return>", lambda e: self.format_date())

        # Set Notes Frame
        set_notes_frame = ctk.CTkFrame(main_frame, fg_color="#563A9C")
        set_notes_frame.grid(row=0, column=1, pady=(0, 10), sticky="ew")
        set_notes_frame.grid_columnconfigure(1, weight=8)

        # Notes Label
        self.notes_label = ctk.CTkLabel(set_notes_frame, text="Enter Notes:", font=("Helvetica", 14, "bold"), fg_color="transparent", text_color="#ebebeb")
        self.notes_label.grid(row=0, column=0, sticky="w", padx=10)

        # Notes Entry
        self.notes_entry = ctk.CTkEntry(set_notes_frame, placeholder_text="Send progress pictures, call client, etc.", placeholder_text_color="#797e82")
        self.notes_entry.grid(row=0, column=1, sticky="ew")
        self.notes_entry.bind("<FocusOut>", lambda e: self.format_date())
        self.notes_entry.bind("<Return>", lambda e: self.format_date())

        # Set Alert Button
        alert_img = ctk.CTkImage(light_image=Image.open("icons/alert.png"), size=(24, 24))
        self.set_alert_button = ctk.CTkButton(set_notes_frame, text="Set Alert", command=self.set_alert, image=alert_img, width=100)
        self.set_alert_button.grid(row=0, column=2, padx=10)

        style_treeview_light("Alerts.Treeview")

        # Container frame for Treeview and Scrollbar
        treeview_frame = ctk.CTkFrame(main_frame)
        treeview_frame.grid(row=1, column=0, columnspan=2, sticky="nsew")
        treeview_frame.grid_rowconfigure(0, weight=1)

        # Style and Treeview
        columns = ("Name", "Status", "Deadline", "Phone Number", "Notes")
        self.alerts_list = ttk.Treeview(treeview_frame, selectmode="browse", columns=columns, show="headings", style="Alerts.Treeview")
        self.alerts_list.heading("Name", text="Name")
        self.alerts_list.heading("Status", text="Status")
        self.alerts_list.heading("Deadline", text="Deadline")
        self.alerts_list.heading("Phone Number", text="Phone #")
        self.alerts_list.heading("Notes", text="Notes")

        # Vertical Scrollbar
        vsb = ttk.Scrollbar(treeview_frame, orient="vertical", command=self.alerts_list.yview)
        vsb.pack(side="right", fill="y")

        # Link scrollbar activation to the treeview
        self.alerts_list.configure(yscrollcommand=vsb.set)
        self.alerts_list.pack(fill="both", expand=True)

        # Set column widths as percentages of the total width
        self.alerts_list.column("Name", width=80)
        self.alerts_list.column("Status", width=65)
        self.alerts_list.column("Deadline", width=15)
        self.alerts_list.column("Phone Number", width=30)
        self.alerts_list.column("Notes", width=320)

        # Bind keybind events to edit/delete alert(s)
        self.alerts_list.bind("<Double-1>", self.edit_alert)
        self.alerts_list.bind("<Delete>", self.delete_selected_alert)
        self.alerts_list.bind("<BackSpace>", self.delete_selected_alert)

        self.load_alerts()


    def update_client_id(self, client_id):
        """Update the client ID when a client is selected."""
        self.client_id = client_id
        self.restore_placeholder()


    def restore_placeholder(self, event=None):
        """Restore the placeholder text in the entry fields."""
        self.deadline_entry.delete(0, "end")
        self.deadline_entry.configure(placeholder_text="MM/DD/YYYY")
        self.notes_entry.delete(0, "end")
        self.notes_entry.configure(placeholder_text="Send progress pictures, call client, etc.")


    def load_alerts(self):
        """Load all alerts from the database and populate the Treeview."""
        try:
            # Clear the existing entries in the Treeview
            for item in self.alerts_list.get_children():
                self.alerts_list.delete(item)

            # Query the database for all alerts with client details
            query = """
            SELECT a.id, a.client_id, c.full_name, c.phone, a.deadline, a.notes
            FROM alerts a
            JOIN clients c ON a.client_id = c.id
            ORDER BY a.deadline ASC
            """
            self.cursor.execute(query)
            alerts = self.cursor.fetchall()

            # Populate the Treeview with the alerts
            for alert in alerts:
                alert_id, client_id, client_name, phone_number, deadline, notes = alert
                status = self.calculate_status(deadline)  # Calculate status based on the deadline
                self.alerts_list.insert("", "end", iid=str(alert_id), values=(client_name, status, deadline, phone_number, notes))
            
            # Update the alert colors based on their status
            self.update_alert_colors()

        except Exception as e:
            print(f"Error loading alerts from database: {e}")
            messagebox.showerror("Database Error", "Failed to load alerts from database.")

        self.restore_placeholder()


    def edit_alert(self, event=None):
        selected_item = self.alerts_list.selection()
        if not selected_item:
            print("⚠ No alert selected for editing.")
            return

        alert_id = selected_item[0]

        self.cursor.execute("SELECT deadline, notes FROM alerts WHERE id = ?", (alert_id,))
        alert_data = self.cursor.fetchone()

        if not alert_data:
            print("⚠ Alert not found in database.")
            return

        deadline, notes = alert_data

        # === Create Pop-up ===
        self.alert_window = ctk.CTkToplevel()
        self.alert_window.title("Edit Alert")
        self.alert_window.geometry("400x280")
        self.alert_window.transient(self.main_app)
        self.alert_window.grab_set()
        self.alert_window.focus_force()

        frame = ctk.CTkFrame(self.alert_window)
        frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Deadline
        ctk.CTkLabel(frame, text="Deadline", anchor="w").pack(anchor="w", padx=5, pady=(10, 2))
        self.popup_deadline_entry = ctk.CTkEntry(frame, placeholder_text="MM/DD/YYYY")
        self.popup_deadline_entry.insert(0, deadline)
        self.popup_deadline_entry.pack(fill="x", padx=5)
        self.popup_deadline_entry.bind("<FocusOut>", lambda e: self.format_date_popup())
        self.popup_deadline_entry.bind("<Return>", lambda e: self.format_date_popup())

        # Notes Label
        ctk.CTkLabel(frame, text="Notes", anchor="w").pack(anchor="w", padx=5, pady=(10, 2))

        # Outer frame acting as the border
        border_frame = ctk.CTkFrame(frame, fg_color="#563A9C", corner_radius=8)
        border_frame.pack(fill="x", padx=5, pady=(0, 10))

        # Inner frame to control height and prevent expansion
        notes_frame = ctk.CTkFrame(border_frame, fg_color="#dbdbdb")  # Match border color for consistency
        notes_frame.configure(height=100)
        notes_frame.pack(fill="x", padx=1, pady=1)  # Padding inside the border frame
        notes_frame.pack_propagate(False)

        # Textbox inside the height-limited frame
        self.notes_textbox = ctk.CTkTextbox(notes_frame, wrap="word", fg_color="#ebebeb")
        self.notes_textbox.insert("1.0", notes or "")
        self.notes_textbox.pack(fill="both", expand=True)

        # Save Button
        ctk.CTkButton(
            frame, text="Save",
            command=lambda: self.update_alert(alert_id)
        ).pack(pady=5)


    def update_alert(self, alert_id):
        self.format_date_popup()
        new_deadline = self.popup_deadline_entry.get().strip()
        new_notes = self.notes_textbox.get("1.0", "end").strip()

        if not new_deadline:
            print("⚠ Deadline cannot be empty.")
            return

        try:
            self.cursor.execute("""
                UPDATE alerts SET deadline = ?, notes = ? WHERE id = ?
            """, (new_deadline, new_notes, alert_id))
            self.conn.commit()
            print(f"✅ Alert {alert_id} updated.")

            self.load_alerts()
            self.alert_window.destroy()

        except Exception as e:
            print(f"❌ Failed to update alert: {e}")


    def delete_selected_alert(self, event=None):
        """Prompt the user to confirm deletion of the selected alert."""
        selected_item = self.alerts_list.selection()
        if not selected_item:
            print("⚠ No alert selected for deletion.")
            return

        alert_id = selected_item[0]

        # Confirm deletion
        confirmation = ctk.CTkToplevel()
        confirmation.title("Confirm Deletion")
        confirmation.geometry("350x150")
        confirmation.resizable(False, False)

        confirmation.transient(self.main_app)
        confirmation.grab_set()
        confirmation.focus_force()

        # Main frame
        main_frame = ctk.CTkFrame(confirmation)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        ctk.CTkLabel(
            main_frame,
            text="Are you sure you want to delete this alert?",
            font=("Helvetica", 14), wraplength=300
        ).pack(pady=(25, 10))

        # Buttons
        button_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        button_frame.pack(pady=10)

        ctk.CTkButton(button_frame, text="Cancel", command=confirmation.destroy).pack(side="left", padx=5)

        ctk.CTkButton(
            button_frame, text="Delete", fg_color="#FF4444", hover_color="#CC0000",
            command=lambda: self._execute_delete_alert(alert_id, confirmation)
        ).pack(side="right", padx=5)


    def _execute_delete_alert(self, alert_id, popup):
        """Delete the alert from the database and refresh the view."""
        try:
            self.cursor.execute("DELETE FROM alerts WHERE id = ?", (alert_id,))
            self.conn.commit()
            print(f"🗑️ Deleted alert ID: {alert_id}")
            self.load_alerts()  # Refresh the list
        except Exception as e:
            print(f"❌ Error deleting alert: {e}")
        finally:
            popup.destroy()


    def set_alert(self):
        self.format_date()
        client_id = self.client_id
        if client_id is None:
            messagebox.showwarning("Warning", "Please select a client first.")
            return

        client_name, client_phone = self.get_client_details(client_id)

        missing_fields = []
        if not client_name:
            missing_fields.append("- Name")
        if not client_phone:
            missing_fields.append("- Phone Number")

        if missing_fields:
            messagebox.showerror("Error", f"Client profile is missing:\n\n" + "\n".join(missing_fields))
            return

        deadline = self.deadline_entry.get()
        notes = self.notes_entry.get()

        self.restore_placeholder()

        try:
            # Validate the deadline format
            datetime.strptime(deadline, "%m/%d/%Y")  # US format
            status = self.calculate_status(deadline)
            alert_id = self.save_alert_to_database(client_id, deadline, notes)
            if alert_id:
                self.alerts_list.insert(
                    "", "end", iid=str(alert_id),
                    values=(client_name, status, deadline, client_phone, notes)
                )
                self.sort_treeview()
                messagebox.showinfo("Success", "Alert saved to database successfully.")

        except ValueError:
            messagebox.showerror("Error", "Invalid date format. Please use MM/DD/YYYY.")
    

    def create_proxy_alert(self, client_id):
        """Open popup to create a new alert for the selected client (from another tab)."""
        if client_id is None:
            messagebox.showwarning("Warning", "No client is selected.")
            return

        self.alert_window = ctk.CTkToplevel()
        self.alert_window.title("Set Alert")
        self.alert_window.geometry("400x280")
        self.alert_window.transient(self.main_app)
        self.alert_window.grab_set()
        self.alert_window.focus_force()

        frame = ctk.CTkFrame(self.alert_window)
        frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Deadline
        ctk.CTkLabel(frame, text="Deadline", anchor="w").pack(anchor="w", padx=5, pady=(10, 2))
        self.popup_deadline_entry = ctk.CTkEntry(frame, placeholder_text="MM/DD/YYYY")
        self.popup_deadline_entry.pack(fill="x", padx=5)
        self.popup_deadline_entry.bind("<FocusOut>", lambda e: self.format_date_popup())
        self.popup_deadline_entry.bind("<Return>", lambda e: self.format_date_popup())

        # Notes Label
        ctk.CTkLabel(frame, text="Notes", anchor="w").pack(anchor="w", padx=5, pady=(10, 2))

        # Outer frame acting as the border
        border_frame = ctk.CTkFrame(frame, fg_color="#563A9C", corner_radius=8)
        border_frame.pack(fill="x", padx=5, pady=(0, 10))

        # Notes frame
        notes_frame = ctk.CTkFrame(border_frame, fg_color="#dbdbdb")
        notes_frame.configure(height=100)
        notes_frame.pack(fill="x", padx=1, pady=1)
        notes_frame.pack_propagate(False)

        # Notes textbox
        self.notes_textbox = ctk.CTkTextbox(notes_frame, wrap="word", fg_color="#ebebeb")
        self.notes_textbox.pack(fill="both", expand=True)

        # Save Button
        ctk.CTkButton(
            frame, text="Save",
            command=lambda: self.save_proxy_alert(client_id)
        ).pack(pady=5)


    def save_proxy_alert(self, client_id):
        self.format_date_popup()
        deadline = self.popup_deadline_entry.get().strip()
        notes = self.notes_textbox.get("1.0", "end").strip()

        if not deadline:
            messagebox.showwarning("Missing Field", "Please enter a deadline.")
            return

        # Try to save to DB and get alert_id
        alert_id = self.save_alert_to_database(client_id, deadline, notes)
        if alert_id:
            # Pull client name/phone for the treeview
            client_name, client_phone = self.get_client_details(client_id)
            status = self.calculate_status(deadline)

            # Insert with correct iid so it can be edited right after
            self.alerts_list.insert(
                "", "end", iid=str(alert_id),
                values=(client_name, status, deadline, client_phone, notes)
            )

            self.sort_treeview()
            self.alert_window.destroy()


    def sort_treeview(self):
        items = [(self.alerts_list.item(iid, 'values'), iid) for iid in self.alerts_list.get_children()]

        # Sort items based on the deadline (third value in the tuple)
        items.sort(key=lambda item: datetime.strptime(item[0][2], "%m/%d/%Y"))

        # Clear the existing entries in the Treeview
        self.alerts_list.delete(*self.alerts_list.get_children())

        # Reinsert items into the Treeview
        for item, iid in items:
            self.alerts_list.insert("", "end", iid=iid, values=item)
        
        # Update the alert colors after sorting
        self.update_alert_colors()


    def calculate_status(self, deadline):
        """Calculate the status based on the deadline, including the exact number of days in the status."""
        deadline_date = datetime.strptime(deadline, "%m/%d/%Y").date()  # Convert to date to avoid time part
        today = datetime.now().date()  # Already a date object, no time part
        days_difference = (deadline_date - today).days

        if days_difference > 3:
            status = f"{days_difference} days"  # More than 3 days ahead
        elif days_difference == 3:
            status = "3 days - Upcoming"  # 3 days ahead
        elif days_difference == 2:
            status = "2 days - Upcoming"  # 2 days ahead
        elif days_difference == 1:
            status = "1 day - Due Tomorrow"
        elif days_difference == 0:
            status = "Due Today"
        else:
            status = f"{abs(days_difference)} day{'s' if abs(days_difference) > 1 else ''} - Overdue"  # Past the deadline

        return status


    def get_client_details(self, client_id):
        try:
            self.cursor.execute("SELECT full_name, phone FROM clients WHERE id = ?", (client_id,))
            client_details = self.cursor.fetchone()
            if client_details:
                return client_details[0], client_details[1]  # Return full_name and phone #
            else:
                return None, None
        except Exception as e:
            print(f"Error fetching client details: {e}")
            return None, None


    def save_alert_to_database(self, client_id, deadline, notes):
        query = """
        INSERT INTO alerts (client_id, deadline, notes)
        VALUES (?, ?, ?)
        """
        try:
            self.cursor.execute(query, (client_id, deadline, notes))
            self.conn.commit()
            alert_id = self.cursor.lastrowid  # Get the ID of the inserted row
            return alert_id
        
        except Exception as e:
            print(f"Error saving to database: {e}")
            messagebox.showerror("Database Error", "Failed to save alert.")
            return None

    def update_alert_colors(self):
        for item in self.alerts_list.get_children():
            alert_data = self.alerts_list.item(item, 'values')
            deadline = alert_data[2]  # Assuming this is where the deadline date is stored
            status = self.calculate_status(deadline)
            
            # Determine the color based on the status string
            if "Overdue" in status:
                color = 'red'
            elif "Due Today" in status:
                color = 'orange'
            elif "Due Tomorrow" in status:
                color = 'yellow'
            elif "Upcoming" in status:
                color = 'yellow'
            else:
                color = 'green'

            # Set the tag for this item with the appropriate color
            self.alerts_list.item(item, tags=(color,))
            self.alerts_list.tag_configure('green', background='#90EE90')  # Light green
            self.alerts_list.tag_configure('yellow', background='#FFFF99')  # Light yellow
            self.alerts_list.tag_configure('orange', background='#ff9900')  # Orange
            self.alerts_list.tag_configure('red', background='#FF6347')  # Tomato red


    def format_date(self):
        """Format the date entry to MM/DD/YYYY upon hitting Enter or leaving the field."""
        raw_date = self.deadline_entry.get().strip()

        if not raw_date:
            self.deadline_entry.delete(0, "end")
            return

        cleaned_date = re.sub(r"[^0-9/.-]", "", raw_date)

        if re.fullmatch(r"\d{2}/\d{2}/\d{4}", cleaned_date):
            return  # Already valid

        formatted_date = None

        try:
            if len(re.sub(r"\D", "", cleaned_date)) == 8:
                formatted_date = f"{cleaned_date[:2]}/{cleaned_date[2:4]}/{cleaned_date[4:]}"
            else:
                for fmt in ["%m-%d-%Y", "%m.%d.%Y", "%m/%d/%Y"]:
                    try:
                        parsed_date = datetime.strptime(cleaned_date, fmt)
                        formatted_date = parsed_date.strftime("%m/%d/%Y")
                        break
                    except ValueError:
                        formatted_date = None

            if not formatted_date:
                raise ValueError("Invalid date format")

        except ValueError:
            print("⚠ Invalid date entered. Resetting to placeholder.")
            self.deadline_entry.delete(0, "end")
            self.deadline_entry.insert(0, raw_date)
            return

        self.deadline_entry.delete(0, "end")
        self.deadline_entry.insert(0, formatted_date)
        print(f"✅ Formatted Date: {formatted_date}")


    def format_date_popup(self):
        """Format the date entry to MM/DD/YYYY upon hitting Enter or leaving the field."""
        raw_date = self.popup_deadline_entry.get().strip()

        if not raw_date:
            self.popup_deadline_entry.delete(0, "end")
            return

        cleaned_date = re.sub(r"[^0-9/.-]", "", raw_date)

        if re.fullmatch(r"\d{2}/\d{2}/\d{4}", cleaned_date):
            return  # Already valid

        formatted_date = None

        try:
            if len(re.sub(r"\D", "", cleaned_date)) == 8:
                formatted_date = f"{cleaned_date[:2]}/{cleaned_date[2:4]}/{cleaned_date[4:]}"
            else:
                for fmt in ["%m-%d-%Y", "%m.%d.%Y", "%m/%d/%Y"]:
                    try:
                        parsed_date = datetime.strptime(cleaned_date, fmt)
                        formatted_date = parsed_date.strftime("%m/%d/%Y")
                        break
                    except ValueError:
                        formatted_date = None

            if not formatted_date:
                raise ValueError("Invalid date format")

        except ValueError:
            print("⚠ Invalid date entered. Resetting to placeholder.")
            self.popup_deadline_entry.delete(0, "end")
            self.popup_deadline_entry.insert(0, raw_date)
            return

        self.popup_deadline_entry.delete(0, "end")
        self.popup_deadline_entry.insert(0, formatted_date)
        print(f"✅ Formatted Date: {formatted_date}")
