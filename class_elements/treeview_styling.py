from tkinter import ttk

def style_treeview(style_name="Custom.Treeview", rowheight=22):
    """Applies a custom style to all ttk.Treeview widgets with no borders and a dark-themed scrollbar."""
    style = ttk.Style()
    style.theme_use("default")  # Use a modifiable theme

    # 🎨 Header (Column Titles)
    style.configure(f"{style_name}.Heading",
                    background="#444444",   # Header background
                    foreground="white",     # Header text color
                    font=("Arial", 10),     # Font + size
                    relief="flat",          # Flat header (no border)
                    borderwidth=0,          # Remove header border
                    padding=(0, 2))         # Adds some spacing

    style.map(f"{style_name}.Heading",
              background=[("active", "#555555")])  # Highlight color on hover

    # 🎨 General Treeview Style
    style.configure(style_name,
                    background="#1E1E1E",       # Treeview background
                    fieldbackground="#222222",  # Cell background
                    foreground="white",         # Text color
                    font=("Arial", 10),         # Font + size
                    rowheight=rowheight,        # Adjust row height for spacing
                    borderwidth=0,              # Remove outer border
                    relief="flat")              # Remove 3D effect

    # Remove column dividers and outer border
    style.layout(style_name, [
        ("Treeview.treearea", {"sticky": "nswe"})  # Removes borders and separators
    ])

    # 🎨 Selected Row (Highlight Color)
    style.map(style_name,
              background=[("selected", "#0080FF")],  # Selected row highlight
              foreground=[("selected", "white")])    # Selected text color

    # 🎨 Scrollbar Styling (ACTIVE & DISABLED STATES)
    style.configure("Vertical.TScrollbar",
                    background="#444444",    # Scrollbar background
                    troughcolor="#222222",   # Track color
                    borderwidth=0,           # Remove border
                    arrowcolor="white",      # Arrow color
                    relief="flat")           # Consistent width

    # 🔹 **Fix Disabled (Inactive) Scrollbar Color**
    style.map("Vertical.TScrollbar",
              background=[("disabled", "#333333"), ("active", "#666666"), ("pressed", "#777777")],   # Darker when inactive
              troughcolor=[("disabled", "#222222"), ("active", "#2A2A2A")],                          # Track color when disabled
              arrowcolor=[("disabled", "#666666"), ("active", "white"), ("pressed", "#CCCCCC")])     # Dimmed arrows

    # 🎨 Remove Treeview Borders & Dividers
    style.configure("Treeview", borderwidth=0, relief="flat")           # No outer border
    style.configure("Treeview.Item", borderwidth=0, relief="flat")      # No row borders
    style.configure("Treeview.Column", borderwidth=0, relief="flat")    # No column dividers
