from tkinter import ttk

def style_treeview_light(style_name="Corium.Treeview", rowheight=22, font=("Helvetica", 10)):
    """Applies a Corium-themed light mode to all ttk.Treeview widgets with purple highlights and cream backgrounds."""
    style = ttk.Style()
    style.theme_use("default")

    # === Color Constants (Corium Light Theme) ===
    TEXT_COLOR = "#000000"
    SOFT_WHITE = "#ebebeb"

    DARK_PURPLE = "#563A9C"

    SOFT_GRAY = "#dbdbdb"         
    MID_GRAY = "#b3b3b3"
    DARK_GRAY = "#979da2"
    DARKEST_GRAY = "#797e82"

    HOVER_PURPLE = "#251254"

    # === 🎨 Header (Column Titles) ===
    style.configure(f"{style_name}.Heading",
                    background=DARK_PURPLE,
                    foreground=SOFT_WHITE,
                    font=("Helvetica", 10, "bold"),
                    relief="flat",
                    borderwidth=0,
                    padding=(4, 4))

    style.map(f"{style_name}.Heading",
              background=[("active", HOVER_PURPLE)])

    # === 🎨 General Treeview Style ===
    style.configure(style_name,
                    background=SOFT_GRAY,
                    fieldbackground=SOFT_GRAY,
                    foreground=TEXT_COLOR,
                    bordercolor=HOVER_PURPLE,
                    font=font,
                    rowheight=rowheight,
                    borderwidth=1,
                    relief="flat")

    # Remove borders and separators
    style.layout(style_name, [
        ("Treeview.treearea", {"sticky": "nswe"})
    ])

    # === 🎨 Selected Row Highlight ===
    style.map(style_name,
              background=[("selected", DARK_PURPLE)],
              foreground=[("selected", SOFT_WHITE)])

    # === 🎨 Scrollbar Styling ===
    style.configure("Vertical.TScrollbar",
                    background=DARK_PURPLE,
                    troughcolor=MID_GRAY,
                    borderwidth=0,
                    arrowcolor=SOFT_WHITE,
                    relief="flat")

    style.map("Vertical.TScrollbar",
                    background=[
                        ("disabled", MID_GRAY),
                        ("active", HOVER_PURPLE),
                        ("pressed", HOVER_PURPLE)
                    ],
                    arrowcolor=[
                        ("!disabled", SOFT_WHITE),
                        ("active", SOFT_WHITE),
                        ("pressed", SOFT_WHITE)
                    ],
                    troughcolor=[
                        ("disabled", SOFT_GRAY),
                        ("active", SOFT_GRAY)
                    ])

    # Clean up borders for consistency
    style.configure("Treeview", borderwidth=0, relief="flat")
    style.configure("Treeview.Item", borderwidth=0, relief="flat")
    style.configure("Treeview.Column", borderwidth=0, relief="flat")
