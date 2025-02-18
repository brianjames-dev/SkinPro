from tkinter import ttk

def style_treeview(style_name="Custom.Treeview"):
    """Applies a custom style to all ttk.Treeview widgets with no borders."""
    style = ttk.Style()
    style.theme_use("default")  # Use a modifiable theme

    # 🎨 Header (Column Titles)
    style.configure(f"{style_name}.Heading",
                    background="#444444",  # Header background
                    foreground="white",  # Header text color
                    font=("Arial", 10),
                    relief="flat",  # Flat header (no border)
                    borderwidth=0)  # Remove header border

    style.map(f"{style_name}.Heading",
              background=[("active", "#555555")])  # Highlight color on hover


    # 🎨 General Treeview Style
    style.configure(style_name,
                    background="#1E1E1E",  # Treeview background
                    fieldbackground="#222222",  # Cell background
                    foreground="white",  # Text color
                    font=("Arial", 10),
                    rowheight=22,  # Adjust row height for spacing
                    borderwidth=0,  # Remove outer border
                    relief="flat")  # Remove 3D effect

    # Remove column dividers and outer border
    style.layout(style_name, [
        ("Treeview.treearea", {"sticky": "nswe"})  # Removes borders and separators
    ])

    # 🎨 Selected Row (Highlight Color)
    style.map(style_name,
              background=[("selected", "#0080FF")],  # Selected row highlight
              foreground=[("selected", "white")])  # Selected text color

    # 🎨 Scrollbar Appearance
    style.configure("Vertical.TScrollbar",
                    background="#444444",    # Scrollbar background color
                    troughcolor="#222222",   # Track color
                    borderwidth=0,           # Remove border
                    arrowcolor="white",      # Arrow color
                    relief="flat")           # Remove 3D relief

    # 🎨 Remove Treeview Borders & Dividers
    style.configure("Treeview", borderwidth=0, relief="flat")  # No outer border
    style.configure("Treeview.Item", borderwidth=0, relief="flat")  # No row borders
    style.configure("Treeview.Column", borderwidth=0, relief="flat")  # No column dividers
