import customtkinter as ctk
from tkinter import ttk
from tkinter import filedialog
from PIL import Image, ImageTk
from customtkinter import CTkImage
from class_elements.treeview_styling import style_treeview
import os

class PrescriptionsPage:
    def __init__(self, parent, conn, main_app):
        self.conn = conn
        self.cursor = conn.cursor()
        self.main_app = main_app        # Reference to main app
        self.client_id = None           # Store selected client ID
