import json
import os

# Save theme.json right next to this script
output_path = os.path.join(os.path.dirname(__file__), "corium_theme.json")

# === Color Palette ===
TEXT_COLOR = "#000000"
SOFT_WHITE = "#ebebeb"        

SOFT_GRAY = "#dbdbdb"       
MID_GRAY = "#b3b3b3"  
DARK_GRAY = "#979da2"
DARKEST_GRAY = "#797e82"

DARK_PURPLE = "#563A9C"

HOVER_GRAY = "#c2c0c0"
HOVER_PURPLE = "#251254"
TEXTBOX_HOVER = "#E6DAF7"

TRANSPARENT = "transparent"

# === Theme Dictionary ===
theme = {
    "CTk": {
        "fg_color": HOVER_PURPLE,
        "bg_color": HOVER_PURPLE,
        "text_color": TEXT_COLOR,
        "corner_radius": 10
    },
    "CTkFont": {
        "family": "Helvetica",
        "size": 12,
        "weight": "normal"
    },
    "CTkToplevel": {
        "fg_color": HOVER_PURPLE,
        "bg_color": HOVER_PURPLE,
        "corner_radius": 10
    },
    "CTkLabel": {
        "fg_color": SOFT_GRAY,
        "text_color": TEXT_COLOR,
        "border_color": TRANSPARENT,
        "corner_radius": 0
    },
    "CTkButton": {
        "fg_color": DARK_PURPLE,
        "hover_color": HOVER_PURPLE,
        "text_color": SOFT_WHITE,
        "text_color_disabled": SOFT_WHITE,
        "border_color": TRANSPARENT,
        "border_width": 0,
        "corner_radius": 10
    },
    "CTkEntry": {
        "fg_color": SOFT_WHITE,
        "border_color": DARK_PURPLE,
        "text_color": TEXT_COLOR,
        "placeholder_text_color": DARKEST_GRAY,
        "corner_radius": 8,
        "border_width": 1
    },
    "CTkFrame": {
        "fg_color": SOFT_GRAY,
        "top_fg_color": SOFT_GRAY,
        "border_color": SOFT_GRAY,
        "border_width": 0,
        "corner_radius": 10
    },
    "CTkOptionMenu": {
        "fg_color": SOFT_WHITE,
        "button_color": SOFT_WHITE,
        "text_color": TEXT_COLOR,
        "corner_radius": 10
    },
    "CTkComboBox": {
        "fg_color": SOFT_WHITE,
        "border_color": DARK_PURPLE,
        "button_color": DARK_PURPLE,
        "button_hover_color": HOVER_PURPLE,
        "dropdown_fg_color": SOFT_WHITE,
        "text_color": TEXT_COLOR,
        "text_color_disabled": TEXT_COLOR,
        "placeholder_text_color": DARKEST_GRAY,
        "corner_radius": 8,
        "border_width": 1
    },
    "CTkSwitch": {
        "progress_color": DARK_PURPLE,
        "button_color": DARK_PURPLE,
        "text_color": TEXT_COLOR,
        "corner_radius": 10
    },
    "CTkProgressBar": {
        "progress_color": DARK_PURPLE,
        "fg_color": DARK_GRAY,
        "border_color": DARK_GRAY,
        "border_width": 0,
        "corner_radius": 10
    },
    "CTkSlider": {
        "progress_color": DARK_PURPLE,
        "button_color": DARK_PURPLE,
        "fg_color": SOFT_WHITE,
        "corner_radius": 10
    },
    "CTkTabview": {
        "fg_color": SOFT_GRAY,
        "segmented_button_fg_color": SOFT_GRAY,
        "selected_color": DARK_PURPLE,
        "unselected_color": DARK_PURPLE,
        "text_color": SOFT_WHITE,
        "corner_radius": 10
    },
    "CTkTextbox": {
        "fg_color": SOFT_WHITE,
        "text_color": TEXT_COLOR,
        "border_color": DARK_PURPLE,
        "border_width": 1,
        "corner_radius": 0,
        "scrollbar_button_color": DARK_PURPLE,
        "scrollbar_button_hover_color": HOVER_PURPLE
    },
    "CTkScrollableFrame": {
        "fg_color": SOFT_WHITE,
        "corner_radius": 10
    },
    "CTkScrollbar": {
        "fg_color": DARK_GRAY,
        "button_color": DARK_GRAY,
        "button_hover_color": HOVER_PURPLE,
        "hover_color": HOVER_PURPLE,
        "corner_radius": 10,
        "border_spacing": 0
    },
    "CTkCheckBox": {
        "fg_color": SOFT_WHITE,
        "border_color": HOVER_PURPLE,
        "check_color": DARK_PURPLE,
        "text_color": DARK_PURPLE,
        "corner_radius": 4
    },
    "CTkSegmentedButton": {
        "fg_color": DARKEST_GRAY,
        "selected_color": DARK_PURPLE,
        "unselected_color": DARKEST_GRAY,
        "selected_hover_color": HOVER_PURPLE,
        "unselected_hover_color": MID_GRAY,
        "text_color": SOFT_WHITE,
        "text_color_disabled": TEXT_COLOR,
        "border_color": HOVER_PURPLE,
        "border_width": 0,
        "corner_radius": 10
    },
    "DropdownMenu": {
        "fg_color": SOFT_WHITE,
        "hover_color": MID_GRAY,
        "text_color": TEXT_COLOR,
        "border_color": HOVER_PURPLE,
        "border_width": 0,
        "corner_radius": 6
    }
}

# === Write to JSON ===
with open(output_path, "w") as f:
    json.dump(theme, f, indent=2)

print(f"Theme written to {output_path}")
