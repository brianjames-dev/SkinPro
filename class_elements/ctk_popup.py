import customtkinter as ctk

class ConfirmationPopup(ctk.CTkToplevel):
    def __init__(self, parent, title, message, on_confirm):
        super().__init__(parent)
        self.on_confirm = on_confirm

        self.title(title)
        self.geometry("400x200")
        self.resizable(False, False)
        self.transient(parent)  # Keep it on top
        self.grab_set()  # Make it modal

        # Message Label
        self.label = ctk.CTkLabel(self, text=message, wraplength=350, font=("Arial", 14))
        self.label.pack(pady=20)

        # Button Frame
        button_frame = ctk.CTkFrame(self)
        button_frame.pack(pady=10)

        # Yes Button
        self.yes_button = ctk.CTkButton(button_frame, text="Yes", command=self.confirm, fg_color="green")
        self.yes_button.pack(side="left", padx=10)

        # No Button
        self.no_button = ctk.CTkButton(button_frame, text="No", command=self.cancel, fg_color="red")
        self.no_button.pack(side="right", padx=10)

    def confirm(self):
        self.on_confirm(True)
        self.destroy()

    def cancel(self):
        self.on_confirm(False)
        self.destroy()
