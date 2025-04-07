import threading
from PIL import Image

class PdfRenderWorker:
    def __init__(self, callback):
        self.callback = callback  # Function to call with rendered image
        self.thread = None

    def render_async(self, pdf_path, display_width=464):
        if self.thread and self.thread.is_alive():
            return  # Avoid overlapping renders

        def task():
            try:
                from pdf2image import convert_from_path
                pages = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=1)

                if not pages:
                    print("⚠️ No pages found in PDF.")
                    return

                image = pages[0]
                aspect_ratio = image.height / image.width
                display_height = int(display_width * aspect_ratio)
                resized = image.resize((display_width, display_height), Image.LANCZOS)

                # Pass to UI callback
                self.callback(resized)

            except Exception as e:
                print(f"❌ Error rendering PDF: {e}")

        self.thread = threading.Thread(target=task)
        self.thread.start()
