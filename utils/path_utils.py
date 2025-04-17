import os
import sys

def resource_path(relative_path):
    """
    Get absolute path to a resource, works for development and PyInstaller bundle.
    """
    if getattr(sys, 'frozen', False):
        # Running in a PyInstaller bundle
        base_path = sys._MEIPASS
    else:
        # Running in a normal Python environment
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)
